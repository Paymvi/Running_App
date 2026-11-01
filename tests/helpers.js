// In-memory stand-in for window.localStorage. `failWrites` simulates a full/blocked store.
export function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    failWrites: false,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      if (this.failWrites) {
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

export const run = (over = {}) => ({
  id: over.id ?? crypto.randomUUID(),
  title: "Run",
  type: "run",
  intensity: "easy",
  feel: "easy",
  date: "2026-10-01",
  time: "07:00",
  mode: "timeMiles",
  miles: 3,
  duration: 30,
  splits: [],
  notes: "",
  ...over,
});

// In-memory stand-in for the IndexedDB photo store (media.js API).
// `failPut` rejects writes; `corrupt` returns altered data on read (verification must catch it).
export function fakeMedia(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    failPut: false,
    corrupt: false,
    map,
    async putPhotos(photos) {
      if (this.failPut) throw new Error("photo store full");
      for (const p of photos) map.set(p.id, p.dataUrl);
    },
    async getPhotos(ids) {
      const keys = ids || [...map.keys()];
      return Object.fromEntries(keys.filter((k) => map.has(k)).map((k) => [k, this.corrupt ? "x" : map.get(k)]));
    },
    async deletePhotos(ids) {
      ids.forEach((id) => map.delete(id));
    },
    async clearPhotos() {
      map.clear();
    },
  };
}
