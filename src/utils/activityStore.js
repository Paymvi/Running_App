// The one place activities are held and written. Pages read it with useActivities();
// every change goes through commit(), which persists first and only then updates the UI.
//
// Deleting moves records to the trash (KEYS.trash) for TRASH_DAYS; only purgeTrash()
// (explicit, or expiry on load) removes them and their photos for good.
//
// Concurrency (browser-local, best effort): other tabs' writes arrive via the storage
// event and reload this tab. Before every write the stored text is compared with what
// this tab last saw; if another tab changed it, the write is refused and the list
// reloaded. Two writes landing in the same instant can still race (localStorage has no
// compare-and-swap), in which case the later one wins.

import { useSyncExternalStore } from "react";
import { KEYS, describeWriteError, readActivities, writeKeysAtomically } from "./storage.js";
import { activityMiles, activityMinutes, compareActivitiesNewestFirst, normalizeStoredActivity } from "./activityModel.js";
import { defaultMediaApi } from "./media.js";

export const TRASH_DAYS = 30;
const DAY_MS = 86400000;

let storage = null;
let media = defaultMediaApi;
let state = { activities: [], trash: [], loadError: null, blockedReason: null };
let lastRaw = { activities: null, trash: null };
const listeners = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function readRaw(key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function readTrash() {
  try {
    const parsed = JSON.parse(readRaw(KEYS.trash) || "[]");
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.activity && t.deletedAt) : [];
  } catch {
    return [];
  }
}

function load() {
  const { activities, raw, error } = readActivities(storage);
  const list = activities
    .map(normalizeStoredActivity)
    .filter(Boolean)
    .sort(compareActivitiesNewestFirst);
  lastRaw = { activities: raw, trash: readRaw(KEYS.trash) };
  emit({ activities: list, trash: readTrash(), loadError: error || null });
}

let storageListener = null;

// blockedReason: when set, writes are refused (e.g. the pre-upgrade backup failed).
export function initActivityStore({
  storage: s = globalThis.localStorage,
  blockedReason = null,
  media: m = defaultMediaApi,
  now = Date.now(),
} = {}) {
  storage = s;
  media = m;
  state = { activities: [], trash: [], loadError: null, blockedReason };
  load();
  if (!blockedReason && !state.loadError) purgeExpiredTrash(now);

  if (globalThis.window && !storageListener) {
    storageListener = (e) => {
      if (e.key === KEYS.activities || e.key === KEYS.trash || e.key === null) load();
    };
    window.addEventListener("storage", storageListener);
  }
}

export const reloadActivities = () => load();
export const getActivityState = () => state;
export const setBlockedReason = (blockedReason) => emit({ blockedReason });

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActivities() {
  return useSyncExternalStore(subscribe, getActivityState);
}

const CHANGED_ELSEWHERE =
  "Your activities were changed in another tab or window. The list has been refreshed; please check it and try again.";

function commit({ activities = state.activities, trash = state.trash }) {
  if (state.loadError) {
    return {
      ok: false,
      error: "Saved activity data couldn't be read, so changes are disabled to avoid overwriting it. Use the recovery options at the top of the page.",
    };
  }
  if (state.blockedReason) return { ok: false, error: state.blockedReason };

  if (readRaw(KEYS.activities) !== lastRaw.activities || readRaw(KEYS.trash) !== lastRaw.trash) {
    load();
    return { ok: false, error: CHANGED_ELSEWHERE, conflict: true };
  }

  const sorted = [...activities].sort(compareActivitiesNewestFirst);
  const writes = { [KEYS.activities]: JSON.stringify(sorted) };
  if (trash !== state.trash) writes[KEYS.trash] = trash.length ? JSON.stringify(trash) : null;
  try {
    writeKeysAtomically(writes, storage);
  } catch (e) {
    return { ok: false, error: describeWriteError(e) };
  }
  lastRaw = { activities: writes[KEYS.activities], trash: KEYS.trash in writes ? writes[KEYS.trash] : lastRaw.trash };
  emit({ activities: sorted, trash });
  return { ok: true };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Create or update. Returns { ok, error?, id, created }.
// `expected` is the record as it was when editing began; if the stored record has
// changed (or been deleted) since, the save is refused instead of overwriting it.
export function saveActivity(activity, { expected } = {}) {
  const id = activity.id || crypto.randomUUID();
  const current = state.activities.find((a) => a.id === id);
  if (expected && !current) {
    return { ok: false, conflict: true, id, created: false, error: "This activity was deleted (perhaps in another tab). Close the editor; your changes were not saved." };
  }
  if (expected && !same(current, expected)) {
    return { ok: false, conflict: true, id, created: false, error: "This activity was changed elsewhere since you opened it. Close and reopen it to see the latest version; your changes were not saved." };
  }
  const next = current
    ? state.activities.map((a) => (a.id === id ? { ...a, ...activity, id } : a))
    : [{ ...activity, id }, ...state.activities];
  return { ...commit({ activities: next }), id, created: !current };
}

// Moves the given activities to the trash.
export function deleteActivities(ids, now = Date.now()) {
  const doomed = new Set(ids);
  const moving = state.activities.filter((a) => doomed.has(a.id));
  if (!moving.length) return { ok: true, count: 0 };
  const deletedAt = new Date(now).toISOString();
  const result = commit({
    activities: state.activities.filter((a) => !doomed.has(a.id)),
    trash: [...moving.map((activity) => ({ deletedAt, activity })), ...state.trash],
  });
  return { ...result, count: result.ok ? moving.length : 0 };
}

export const deleteActivity = (id, now) => deleteActivities([id], now);
export const deleteAllActivities = (now) => deleteActivities(state.activities.map((a) => a.id), now);

// Puts trashed activities back. Ids that already exist again are left in the trash.
export function restoreFromTrash(ids) {
  const wanted = new Set(ids);
  const existing = new Set(state.activities.map((a) => a.id));
  const back = state.trash.filter((t) => wanted.has(t.activity.id) && !existing.has(t.activity.id));
  if (!back.length) return { ok: true, restored: 0, skipped: ids.length };
  const result = commit({
    activities: [...back.map((t) => t.activity), ...state.activities],
    trash: state.trash.filter((t) => !back.includes(t)),
  });
  return { ...result, restored: result.ok ? back.length : 0, skipped: ids.length - back.length };
}

// Permanently removes trashed activities, then their photos.
export async function purgeTrash(ids) {
  const doomed = new Set(ids);
  const purged = state.trash.filter((t) => doomed.has(t.activity.id));
  if (!purged.length) return { ok: true, purged: 0 };
  const result = commit({ trash: state.trash.filter((t) => !doomed.has(t.activity.id)) });
  if (!result.ok) return { ...result, purged: 0 };
  const stillUsed = new Set([...state.activities, ...state.trash.map((t) => t.activity)].map((a) => a.photoId));
  const photoIds = purged.map((t) => t.activity.photoId).filter((p) => p && !stillUsed.has(p));
  try {
    await media.deletePhotos(photoIds);
  } catch {
    // the records are gone; an unreferenced photo is harmless and removed by Reset
  }
  return { ok: true, purged: purged.length };
}

export function purgeExpiredTrash(now = Date.now()) {
  const expired = state.trash.filter((t) => now - Date.parse(t.deletedAt) > TRASH_DAYS * DAY_MS);
  return expired.length ? purgeTrash(expired.map((t) => t.activity.id)) : Promise.resolve({ ok: true, purged: 0 });
}

// Saves a photo before the record that references it; removes the replaced photo only
// after the record was saved. `photo`: a new data URL, null to remove, undefined to keep.
export async function saveActivityWithPhoto(activity, { photo, expected } = {}) {
  const oldPhotoId = expected?.photoId ?? null;
  let photoId = activity.photoId ?? null;
  let newPhotoId = null;
  if (typeof photo === "string") {
    newPhotoId = crypto.randomUUID();
    try {
      await media.putPhotos([{ id: newPhotoId, dataUrl: photo }]);
    } catch (e) {
      return { ok: false, error: `The photo couldn't be saved (${e?.message || "browser storage refused it"}). Nothing was changed.` };
    }
    photoId = newPhotoId;
  } else if (photo === null) {
    photoId = null;
  }

  const record = { ...activity };
  delete record.photo;
  if (photoId) record.photoId = photoId;
  else delete record.photoId;

  const result = saveActivity(record, { expected });
  try {
    if (!result.ok && newPhotoId) await media.deletePhotos([newPhotoId]);
    if (result.ok && oldPhotoId && oldPhotoId !== photoId) await media.deletePhotos([oldPhotoId]);
  } catch {
    // leftover photo is unreferenced; harmless
  }
  return result;
}

const sourceKey = (a) => (a.source && a.sourceId ? `${a.source}:${a.sourceId}` : null);

// Splits incoming records into new ones and duplicates of `current` (same id or same provider id).
export function partitionImport(incoming, current) {
  const ids = new Set(current.map((a) => a.id));
  const sources = new Set(current.map(sourceKey).filter(Boolean));
  const added = [];
  let duplicates = 0;
  for (const a of incoming) {
    const sk = sourceKey(a);
    if (ids.has(a.id) || (sk && sources.has(sk))) {
      duplicates += 1;
      continue;
    }
    ids.add(a.id);
    if (sk) sources.add(sk);
    added.push(a);
  }
  return { added, duplicates };
}

// Rows with no id in the file that look like an existing activity: same date and type,
// distance within 0.01 mi and duration within 0.1 min (blank must match blank).
// These are only reported; they are never merged automatically.
export function findPossibleDuplicates(incoming, current, idlessIds) {
  const close = (x, y, tol) => (x > 0 || y > 0 ? Math.abs(x - y) <= tol : true);
  return incoming.filter(
    (a) =>
      idlessIds.has(a.id) &&
      current.some(
        (c) =>
          c.date === a.date &&
          (c.type || "run") === (a.type || "run") &&
          close(activityMiles(c), activityMiles(a), 0.01) &&
          close(activityMinutes(c), activityMinutes(a), 0.1)
      )
  );
}

export function previewImport(incoming, idlessIds = new Set()) {
  const { added, duplicates } = partitionImport(incoming, state.activities);
  return { added, duplicates, possible: findPossibleDuplicates(added, state.activities, idlessIds) };
}

// Merges against the CURRENT state at call time, so a slow import can't overwrite
// changes (or resurrect deletions) made while it was running. `skipIds` drops rows
// the user chose not to import (e.g. possible duplicates).
export function mergeImported(incoming, skipIds = new Set()) {
  const { added, duplicates } = partitionImport(incoming.filter((a) => !skipIds.has(a.id)), state.activities);
  if (!added.length) return { ok: true, added: 0, duplicates };
  const result = commit({ activities: [...added, ...state.activities] });
  return { ...result, added: result.ok ? added.length : 0, duplicates };
}
