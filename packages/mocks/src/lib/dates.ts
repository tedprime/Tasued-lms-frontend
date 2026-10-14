/** Date helpers in Africa/Lagos (UTC+1, no DST). All storage is ISO UTC. */
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const LAGOS_OFFSET = HOUR;

export const iso = (t: number | Date) => new Date(t).toISOString();
export const ms = (s: string) => new Date(s).getTime();

export function lagosParts(t: number) {
  const d = new Date(t + LAGOS_OFFSET);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** Lagos wall-clock time `hour:minute` on (Lagos day of `base`) + dayOffset, as epoch ms. */
export function lagosAt(base: number, dayOffset: number, hour: number, minute = 0) {
  const p = lagosParts(base);
  return Date.UTC(p.y, p.m, p.d + dayOffset, hour, minute) - LAGOS_OFFSET;
}

export const startOfLagosDay = (t: number) => lagosAt(t, 0, 0);

/** Monday 00:00 Lagos of the week containing t. */
export function startOfLagosWeek(t: number) {
  const diff = (lagosParts(t).weekday + 6) % 7;
  return lagosAt(t, -diff, 0);
}

export const sameLagosDay = (a: number, b: number) => startOfLagosDay(a) === startOfLagosDay(b);

export function fmtShort(t: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }).format(new Date(t));
}
