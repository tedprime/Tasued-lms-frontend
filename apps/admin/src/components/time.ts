/**
 * datetime-local helpers anchored to Africa/Lagos (UTC+1, no DST), so staff in any
 * browser timezone schedule in campus time.
 */
const LAGOS_OFFSET_MIN = 60;

/** ISO → "YYYY-MM-DDTHH:mm" in Lagos time (for <input type="datetime-local">). */
export function toLagosInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + LAGOS_OFFSET_MIN * 60_000);
  return d.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (Lagos) → ISO UTC. */
export function fromLagosInput(v: string) {
  if (!v) return "";
  return new Date(`${v}:00+01:00`).toISOString();
}

/** ISO → "YYYY-MM-DD" (Lagos) for <input type="date">. */
export function toLagosDate(iso?: string | null) {
  return toLagosInput(iso).slice(0, 10);
}
export function fromLagosDate(v: string) {
  return v ? new Date(`${v}T00:00:00+01:00`).toISOString() : "";
}

/** Start of today / week in Lagos, as ISO. */
export function lagosDayRange(offsetDays = 0, lengthDays = 1) {
  const nowLagos = new Date(Date.now() + LAGOS_OFFSET_MIN * 60_000);
  const y = nowLagos.getUTCFullYear();
  const m = nowLagos.getUTCMonth();
  const d = nowLagos.getUTCDate() + offsetDays;
  const start = new Date(Date.UTC(y, m, d) - LAGOS_OFFSET_MIN * 60_000);
  const end = new Date(start.getTime() + lengthDays * 864e5);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** "mm:ss" or "h:mm:ss" → seconds (NaN when invalid). */
export function parseClock(s: string) {
  const parts = s.trim().split(":").map((p) => Number(p));
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function lagosWeekday(iso: string) {
  return new Date(new Date(iso).getTime() + LAGOS_OFFSET_MIN * 60_000).getUTCDay();
}
