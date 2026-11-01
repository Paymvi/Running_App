// Minimal IndexedDB helper: one object store per database, keyPath "id".

function openDb(dbName, storeName, options) {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("IndexedDB is not available in this browser."));
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(storeName, { keyPath: "id", ...options });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Couldn't open browser database."));
    req.onblocked = () => reject(new Error("Browser database is blocked by another tab."));
  });
}

// Runs fn(store) in one transaction and resolves with the last request's result
// only after the transaction has committed.
export function idbRun(dbName, storeName, mode, fn, options) {
  return openDb(dbName, storeName, options).then(
    (db) =>
      new Promise((resolve, reject) => {
        let tx;
        try {
          tx = db.transaction(storeName, mode);
        } catch (e) {
          db.close();
          return reject(e);
        }
        const out = fn(tx.objectStore(storeName));
        const last = Array.isArray(out) ? out[out.length - 1] : out;
        tx.oncomplete = () => {
          db.close();
          resolve(last?.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error || new Error("Browser database transaction failed."));
        };
      })
  );
}
