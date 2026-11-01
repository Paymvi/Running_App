// Automatic safety backups, kept in IndexedDB ("velo-backups"): a raw copy of every
// Velo localStorage key plus every photo, taken before upgrades and destructive actions.
//
// Retention: every pre-upgrade backup is kept (they are rare and are the only copy of
// the original format), plus the 10 newest other backups. Older ones are pruned
// after a new backup has been committed, never before.
import { idbRun } from "./idb.js";

const DB = "velo-backups";
const STORE = "backups";
export const KEEP_RECENT = 10;
const run = (mode, fn) => idbRun(DB, STORE, mode, fn, { autoIncrement: true });

export const isUpgradeBackup = (b) => String(b.reason || "").startsWith("before schema");

// Ids to delete so that all upgrade backups plus the `keep` newest others remain.
export function backupsToPrune(list, keep = KEEP_RECENT) {
  return list
    .filter((b) => !isUpgradeBackup(b))
    .sort((a, b) => b.id - a.id)
    .slice(keep)
    .map((b) => b.id);
}

// Resolves only after the backup is committed; rejects if it could not be stored.
export async function saveBackup({ reason, entries, media = {} }) {
  const id = await run("readwrite", (store) => store.add({ createdAt: new Date().toISOString(), reason, entries, media }));
  try {
    const all = await run("readonly", (store) => store.getAll());
    const doomed = backupsToPrune(all);
    if (doomed.length) await run("readwrite", (store) => doomed.map((k) => store.delete(k)));
  } catch {
    // pruning is housekeeping; the new backup is already safe
  }
  return id;
}

export async function listBackups() {
  const all = await run("readonly", (store) => store.getAll());
  return all.sort((a, b) => b.id - a.id);
}

export const clearBackups = () => run("readwrite", (store) => store.clear());
