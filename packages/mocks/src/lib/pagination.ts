import type { Paginated } from "@tasued/api-client";

export function listQuery(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const search = (url.searchParams.get("search") ?? "").trim();
  return { page, pageSize, search };
}

export function paginate<T>(items: T[], url: URL): Paginated<T> {
  const { page, pageSize } = listQuery(url);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

/** Case-insensitive "contains" across any of the given fields. Empty term matches everything. */
export function matches(term: string | undefined | null, ...fields: (string | number | undefined | null)[]) {
  const t = (term ?? "").trim().toLowerCase();
  if (!t) return true;
  return fields.some((f) => f !== undefined && f !== null && String(f).toLowerCase().includes(t));
}

export const byString = <T>(get: (x: T) => string) => (a: T, b: T) => get(a).localeCompare(get(b));
