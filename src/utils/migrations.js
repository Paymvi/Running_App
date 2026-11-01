// Schema migrations for stored activities. Order of operations:
// read -> transform in memory -> validate -> save backup (records + photos)
// -> copy photos to IndexedDB and verify them -> atomic localStorage write.
// Nothing in localStorage is changed if the data is unreadable, the backup cannot be
// saved, or the photos cannot be copied and verified.
//
// v1: dates, numbers, split totals, ids (see normalizeStoredActivity).
// v2: photos move from inline data URLs to IndexedDB (activity.photoId); records dated
//     after the upgrade day without a status are flagged needsReview "status"
//     (planned or completed is the user's call, not guessed).

import { KEYS, readActivities, readJSON, snapshotStorage, writeKeysAtomically } from "./storage.js";
import { normalizeStoredActivity } from "./activityModel.js";
import { todayYMD } from "./dateUtils.js";
import { defaultMediaApi, putPhotosVerified } from "./media.js";

export const SCHEMA_VERSION = 2;

// Pure transform of the stored array into schema v1. Exported for tests.
export function migrateActivitiesV1(list) {
  const activities = [];
  const quarantine = [];
  const seenIds = new Set();

  list.forEach((raw, index) => {
    const a = normalizeStoredActivity(raw);
    if (!a) {
      quarantine.push({ index, value: raw, reason: "not an activity object" });
      return;
    }
    if (seenIds.has(a.id)) {
      a.legacy = { ...(a.legacy || {}), id: a.id };
      a.id = crypto.randomUUID();
    }
    seenIds.add(a.id);
    activities.push(a);
  });

  if (activities.length + quarantine.length !== list.length) throw new Error("Migration lost records.");
  if (seenIds.size !== activities.length) throw new Error("Migration produced duplicate ids.");

  const needsReview = activities.filter((a) => a.needsReview).map((a) => ({ id: a.id, fields: a.needsReview }));
  return { activities, quarantine, needsReview };
}

// Pure transform v1 -> v2. Returns the new records and the photos to store.
export function migrateActivitiesV2(list, today = todayYMD()) {
  const photos = [];
  const unconfirmed = [];
  const activities = list.map((raw) => {
    const a = { ...raw };
    if (typeof a.photo === "string" && a.photo) {
      a.photoId = `legacy-${a.id}`;
      photos.push({ id: a.photoId, dataUrl: a.photo });
      delete a.photo;
    } else if (a.photo === null || a.photo === "") {
      delete a.photo;
    }
    if (a.status === undefined && typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.date > today) {
      a.needsReview = [...new Set([...(a.needsReview || []), "status"])];
      unconfirmed.push(a.id);
    }
    return a;
  });
  if (activities.length !== list.length) throw new Error("Migration lost records.");
  const withPhotos = list.filter((a) => typeof a.photo === "string" && a.photo).length;
  if (photos.length !== withPhotos) throw new Error("Migration lost photos.");
  return { activities, photos, unconfirmed };
}

export async function runMigrations({
  storage = globalThis.localStorage,
  saveBackup,
  media = defaultMediaApi,
  skipBackup = false,
  today = todayYMD(),
} = {}) {
  let version;
  try {
    version = Number(storage.getItem(KEYS.schema) || 0);
  } catch {
    return { status: "unavailable" };
  }
  if (version >= SCHEMA_VERSION) return { status: "current" };

  const { activities: list, raw, error } = readActivities(storage);
  if (error) return { status: "blocked", error };

  if (raw == null) {
    try {
      storage.setItem(KEYS.schema, String(SCHEMA_VERSION));
    } catch {
      // nothing to migrate; retry next load
    }
    return { status: "fresh" };
  }

  const v1 = version < 1 ? migrateActivitiesV1(list) : { activities: list, quarantine: [], needsReview: [] };
  const v2 = migrateActivitiesV2(v1.activities, today);
  const json = JSON.stringify(v2.activities);
  if (JSON.parse(json).length !== v2.activities.length) throw new Error("Migration output failed validation.");

  if (!skipBackup) {
    try {
      // The snapshot holds the original records with their inline photos.
      await saveBackup({ reason: `before schema v${SCHEMA_VERSION} upgrade`, entries: snapshotStorage(storage), media: await media.getPhotos() });
    } catch (e) {
      return { status: "backup-failed", error: String(e?.message || e) };
    }
  }

  try {
    await putPhotosVerified(v2.photos, media);
  } catch (e) {
    return { status: "media-failed", error: String(e?.message || e) };
  }

  const writes = { [KEYS.activities]: json, [KEYS.schema]: String(SCHEMA_VERSION) };
  if (v1.quarantine.length) {
    writes[KEYS.quarantine] = JSON.stringify([...readJSON(KEYS.quarantine, [], storage), ...v1.quarantine]);
  }
  try {
    writeKeysAtomically(writes, storage);
  } catch (e) {
    // Photos copied above are unreferenced until the next attempt reuses the same ids.
    return { status: "write-failed", error: String(e?.message || e) };
  }

  return {
    status: "migrated",
    count: v2.activities.length,
    quarantined: v1.quarantine.length,
    needsReview: v1.needsReview,
    unconfirmed: v2.unconfirmed.length,
    photosMoved: v2.photos.length,
  };
}

// Writes stay disabled while the stored data has not been safely upgraded.
export function blockedReasonFor(migration) {
  if (["backup-failed", "media-failed", "write-failed", "error"].includes(migration.status)) {
    return "Velo hasn't finished upgrading your saved data, so changes are paused. See the notice at the top of the page.";
  }
  return null;
}
