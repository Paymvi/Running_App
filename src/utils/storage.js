// Records and settings live in localStorage; photos live in IndexedDB (media.js).
// Reads are guarded; writes throw so callers can report failure instead of showing
// data that will vanish on refresh.
//
// localStorage and IndexedDB cannot be written in one atomic step. Every multi-store
// operation here writes photos first and records second, so a failure part-way leaves
// at most unreferenced photos (harmless), never records pointing at missing photos.
import { defaultMediaApi, putPhotosVerified } from "./media.js";

export const KEYS = {
  activities: "activities",
  quarantine: "activities_quarantine",
  trash: "activities_trash",
  schema: "velo_schema_version",
};

// Never copied into backups or backup files.
const EXCLUDED_KEYS = new Set(["strava_access_token", "jarDrop", "playActivitySound"]);

// Keys a backup file is allowed to restore.
export const BACKUP_KEYS = [
  KEYS.activities,
  KEYS.quarantine,
  KEYS.schema,
  KEYS.trash,
  "homeNoteCards",
  "homeNotes",
  "profileName",
  "profileTag",
  "profileAvatar",
  "weeklyScaleMode",
  "calendar_settings_v1",
  "velo_feedback",
  "velo_units",
  "velo_coach_alerts",
];
const isRestorableKey = (k) => BACKUP_KEYS.includes(k) || k.startsWith("activities_corrupt_");

export function isQuotaError(e) {
  return e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22;
}

export function describeWriteError(e) {
  return isQuotaError(e)
    ? "Browser storage is full, so nothing was saved. Remove large photos or download a backup and free space, then try again."
    : "Your browser refused to save, so nothing was changed. Try again; if it keeps failing, download a backup.";
}

export function readActivities(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(KEYS.activities);
  } catch {
    return { activities: [], raw: null, error: "unavailable" };
  }
  if (raw == null) return { activities: [], raw: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { activities: parsed, raw };
  } catch {
    // fall through
  }
  return { activities: [], raw, error: "corrupt" };
}

// Parsed JSON value of a key, or `fallback` when missing or unreadable.
export function readJSON(key, fallback, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Writes several keys as one unit: if any write fails, earlier ones are rolled back.
// `entries` maps key -> string value, or null to remove the key.
export function writeKeysAtomically(entries, storage = globalThis.localStorage) {
  const keys = Object.keys(entries);
  const previous = Object.fromEntries(keys.map((k) => [k, storage.getItem(k)]));
  const done = [];
  try {
    for (const k of keys) {
      if (entries[k] === null) storage.removeItem(k);
      else storage.setItem(k, entries[k]);
      done.push(k);
    }
  } catch (e) {
    for (const k of done.reverse()) {
      try {
        if (previous[k] === null) storage.removeItem(k);
        else storage.setItem(k, previous[k]);
      } catch {
        // best effort; the original error is what matters
      }
    }
    throw e;
  }
}

// Raw copy of every Velo key (credentials and transient flags excluded).
export function snapshotStorage(storage = globalThis.localStorage) {
  const entries = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k != null && !EXCLUDED_KEYS.has(k)) entries[k] = storage.getItem(k);
  }
  return entries;
}

// Everything needed to rebuild Velo in a browser: storage keys plus every photo.
export async function snapshotAll(storage = globalThis.localStorage, media = defaultMediaApi) {
  return { entries: snapshotStorage(storage), media: await media.getPhotos() };
}

// Version 2 adds `media` ({ photoId: dataUrl }). Version 1 files (photos inline) still restore.
export function buildBackupFile(entries, createdAt = new Date().toISOString(), media = {}) {
  const keys = Object.fromEntries(Object.entries(entries).filter(([k]) => isRestorableKey(k)));
  return JSON.stringify({ format: "velo-backup", version: 2, createdAt, keys, media }, null, 2);
}

// Validates a backup file's text. Returns { entries } or { error }.
export function parseBackupFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "This file is not valid JSON." };
  }
  if (data?.format !== "velo-backup" || ![1, 2].includes(data.version) || typeof data.keys !== "object" || !data.keys) {
    return { error: "This is not a Velo backup file." };
  }
  const entries = {};
  for (const [k, v] of Object.entries(data.keys)) {
    if (!isRestorableKey(k) || typeof v !== "string") return { error: `Unexpected entry "${k}" in backup.` };
    entries[k] = v;
  }
  if (entries[KEYS.activities] !== undefined) {
    try {
      if (!Array.isArray(JSON.parse(entries[KEYS.activities]))) throw new Error();
    } catch {
      return { error: "The activities in this backup are damaged." };
    }
  }
  const media = {};
  for (const [id, url] of Object.entries(data.media || {})) {
    if (typeof url !== "string" || !url.startsWith("data:image/")) return { error: `Photo "${id}" in this backup is damaged.` };
    media[id] = url;
  }
  return { entries, media, createdAt: data.createdAt };
}

// Replaces all restorable keys with the backup's contents (keys absent from the backup are cleared).
export function restoreBackupEntries(entries, storage = globalThis.localStorage) {
  const writes = {};
  for (const k of BACKUP_KEYS) writes[k] = entries[k] ?? null;
  for (const [k, v] of Object.entries(entries)) writes[k] = v;
  writeKeysAtomically(writes, storage);
}

// Photos first (verified), then records. Existing photos are not deleted, so a
// failure at either step leaves the current data usable.
export async function restoreBackup({ entries, media = {} }, storage = globalThis.localStorage, mediaApi = defaultMediaApi) {
  await putPhotosVerified(Object.entries(media).map(([id, dataUrl]) => ({ id, dataUrl })), mediaApi);
  restoreBackupEntries(entries, storage);
}

// Every Velo key, including set-aside corrupt copies.
export function veloKeys(storage = globalThis.localStorage) {
  const keys = new Set(BACKUP_KEYS);
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && isRestorableKey(k)) keys.add(k);
  }
  return [...keys];
}

// Removes every Velo record and setting, then every photo. Automatic backups are
// separate (backups.js) and kept unless the caller clears them too.
export async function resetAllData(storage = globalThis.localStorage, mediaApi = defaultMediaApi) {
  writeKeysAtomically(Object.fromEntries(veloKeys(storage).map((k) => [k, null])), storage);
  await mediaApi.clearPhotos();
}

export function downloadText(filename, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
