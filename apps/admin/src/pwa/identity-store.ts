const DB_NAME = "tasued-admin-push-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function owner(): Promise<string | null> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction("meta").objectStore("meta").get("owner");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function setOwner(userId: string | null): Promise<boolean> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["meta"], "readwrite");
      const meta = tx.objectStore("meta");
      const r = meta.get("owner");
      let changed = false;
      r.onsuccess = () => {
        changed = (r.result || null) !== userId;
        if (changed) {
          if (userId) meta.put(userId, "owner");
          else meta.delete("owner");
        }
      };
      tx.oncomplete = () => resolve(changed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
