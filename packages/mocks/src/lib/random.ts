/** Random helpers. Seeding uses a deterministic PRNG so seeded ids/names are stable across reseeds. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const URLSAFE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function makeRandom(next: Rng) {
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  return {
    next,
    int,
    float: (min: number, max: number) => next() * (max - min) + min,
    chance: (p: number) => next() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!,
    shuffle: <T>(arr: readonly T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
    sample<T>(arr: readonly T[], n: number): T[] {
      return this.shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
    },
    alnum: (n: number) => Array.from({ length: n }, () => ALNUM[Math.floor(next() * ALNUM.length)]).join(""),
    token: (n: number) => Array.from({ length: n }, () => URLSAFE[Math.floor(next() * URLSAFE.length)]).join(""),
  };
}

export type Random = ReturnType<typeof makeRandom>;

/** Runtime randomness (non-deterministic). */
export const rand = makeRandom(Math.random);

let counter = 0;
export function newId(prefix: string) {
  counter = (counter + 1) % 1296;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36).padStart(2, "0")}${rand.token(3).toLowerCase()}`;
}
