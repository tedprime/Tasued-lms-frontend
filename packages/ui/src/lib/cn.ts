/** Joins class names, skipping falsy values. */
export function cn(...parts: unknown[]) {
  return parts.filter((p) => typeof p === "string" && p).join(" ");
}
