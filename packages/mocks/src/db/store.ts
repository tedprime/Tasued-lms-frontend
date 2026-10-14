import { storage } from "../lib/storage";
import { sameLagosDay } from "../lib/dates";
import { DB_VERSION, type DB } from "./schema";
import { seedDatabase } from "./seed";

export const DB_KEY = "tasued-mock-db-v7";

let cache: DB | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function load(): DB | null {
  const raw = storage.get(DB_KEY);
  if (!raw) return null;
  try {
    const db = JSON.parse(raw) as DB;
    if (db.version !== DB_VERSION) return null;
    // Seed dates are relative to "now": reseed on a new Lagos day so the demo always has
    // today's classes, due-soon work and an open quiz.
    if (!sameLagosDay(new Date(db.seededAt).getTime(), Date.now())) return null;
    return db;
  } catch {
    return null;
  }
}

export function getDb(): DB {
  if (!cache) {
    cache = load();
    if (!cache) {
      cache = seedDatabase(Date.now());
      saveNow();
    }
  }
  return cache;
}

export function saveNow() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (cache) storage.set(DB_KEY, JSON.stringify(cache));
}

export function scheduleSave() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(saveNow, 250);
  (timer as { unref?: () => void }).unref?.();
}

/** Wipe and reseed. */
export function resetDb(): DB {
  storage.remove(DB_KEY);
  cache = seedDatabase(Date.now());
  saveNow();
  return cache;
}
