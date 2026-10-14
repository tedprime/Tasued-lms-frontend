import type { Permission, RoleKey, Session } from "./types";

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: "Super admin",
  lecturer: "Lecturer",
  teaching_assistant: "Teaching assistant",
  student: "Student",
};

export function can(session: Session | null | undefined, p: Permission) {
  return !!session?.permissions.includes(p);
}

export function isStaff(session: Session | null | undefined) {
  return !!session?.user.roles.some((r) => r.role !== "student");
}

export function hasRole(session: Session | null | undefined, role: RoleKey) {
  return !!session?.user.roles.some((r) => r.role === role);
}

const tz = "Africa/Lagos";

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", { timeZone: tz, ...opts }).format(new Date(iso));
}

export function fmtDateTime(iso?: string | null) {
  return fmtDate(iso, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(iso?: string | null) {
  return fmtDate(iso, { hour: "numeric", minute: "2-digit" });
}

export function fmtDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** "in 3 days", "2 hours ago" */
export function fromNow(iso?: string | null) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
