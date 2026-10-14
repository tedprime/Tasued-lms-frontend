/** localStorage wrapper that never throws and falls back to memory (Node, private mode, quota errors). */
const memory = new Map<string, string>();

function local(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      const s = local();
      if (s) return s.getItem(key);
    } catch {
      /* fall through */
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string): boolean {
    try {
      const s = local();
      if (s) {
        s.setItem(key, value);
        return true;
      }
    } catch (e) {
      console.warn("[tasued-mocks] could not persist to localStorage", e);
      memory.set(key, value);
      return false;
    }
    memory.set(key, value);
    return true;
  },
  remove(key: string) {
    try {
      local()?.removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  },
};
