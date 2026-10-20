export interface SavedUnit {
  id: string;
  title: string;
  moduleTitle: string;
  text: string;
  objectives: string[];
}
export interface SavedCourse {
  accessPolicy?: "enrolled-v1";
  id: string;
  owner: string;
  title: string;
  code: string;
  savedAt: number;
  expiresAt: number;
  units: SavedUnit[];
}
const DB_NAME = "tasued-offline-v2";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("meta");
      req.result.createObjectStore("courses", { keyPath: "id" });
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
      const tx = db.transaction(["meta", "courses"], "readwrite");
      const meta = tx.objectStore("meta");
      const r = meta.get("owner");
      let changed = false;
      r.onsuccess = () => {
        changed = (r.result || null) !== userId;
        if (changed) {
          tx.objectStore("courses").clear();
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
export async function saveCourse(course: SavedCourse) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["meta", "courses"], "readwrite");
      const r = tx.objectStore("meta").get("owner");
      r.onsuccess = () => {
        if (r.result !== course.owner) {
          tx.abort();
          return;
        }
        tx.objectStore("courses").put({ ...course, accessPolicy: "enrolled-v1" });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(
          new Error("Account changed. Sign in and save the course again."),
        );
    });
  } finally {
    db.close();
  }
}
export async function savedCourses(): Promise<SavedCourse[]> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["meta", "courses"]);
      const who = tx.objectStore("meta").get("owner"),
        all = tx.objectStore("courses").getAll();
      tx.oncomplete = () =>
        resolve(
          (all.result as SavedCourse[]).filter(
            (c) => c.accessPolicy === "enrolled-v1" && c.owner === who.result && c.expiresAt > Date.now(),
          ),
        );
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function removeCourse(id: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("courses", "readwrite");
      tx.objectStore("courses").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
