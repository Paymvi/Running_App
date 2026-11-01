// Activity photos live in IndexedDB ("velo-media"), keyed by photoId; activities only
// reference them. Photos are resized JPEG data URLs (see image.js), so the backup file
// can carry them as text.
import { idbRun } from "./idb.js";

const DB = "velo-media";
const STORE = "photos";
const run = (mode, fn) => idbRun(DB, STORE, mode, fn);

// Stores every photo in one transaction; rejects (nothing committed) if any fails.
export function putPhotos(photos) {
  if (!photos.length) return Promise.resolve();
  const createdAt = new Date().toISOString();
  return run("readwrite", (store) => photos.map((p) => store.put({ id: p.id, dataUrl: p.dataUrl, createdAt })));
}

export async function getPhoto(id) {
  const rec = await run("readonly", (store) => store.get(id));
  return rec?.dataUrl ?? null;
}

// { id: dataUrl } for the given ids (or all photos when ids is omitted).
export async function getPhotos(ids) {
  const all = await run("readonly", (store) => store.getAll());
  const wanted = ids ? new Set(ids) : null;
  return Object.fromEntries((all || []).filter((r) => !wanted || wanted.has(r.id)).map((r) => [r.id, r.dataUrl]));
}

export function deletePhotos(ids) {
  if (!ids.length) return Promise.resolve();
  return run("readwrite", (store) => ids.map((id) => store.delete(id)));
}

export const clearPhotos = () => run("readwrite", (store) => store.clear());

// Writes then reads back every photo; rejects unless all copies match exactly.
export async function putPhotosVerified(photos, api = { putPhotos, getPhotos }) {
  await api.putPhotos(photos);
  const back = await api.getPhotos(photos.map((p) => p.id));
  const bad = photos.filter((p) => back[p.id] !== p.dataUrl);
  if (bad.length) throw new Error(`${bad.length} photo(s) failed verification after saving.`);
}

export const defaultMediaApi = { putPhotos, getPhotos, deletePhotos, clearPhotos };
