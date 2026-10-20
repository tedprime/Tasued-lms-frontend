import type { InviteStatus } from "@tasued/api-client";
import { DAY, HOUR, iso } from "../../lib/dates";
import { HttpError } from "../../lib/http";
import { hashPassword } from "../../lib/password";
import { rand } from "../../lib/random";
import type { AuthTokenRow, DB, UserRow } from "../schema";

export const INVITE_TTL_MS = 7 * DAY;
export const RESET_TTL_MS = 1 * HOUR;

export const isStudent = (u: UserRow) => u.authMethod === "password";

export function weakPassword(db: DB, password: unknown): HttpError | null {
  const min = db.settings.minPasswordLength;
  if (typeof password !== "string" || password.length < min) {
    return new HttpError(422, "WEAK_PASSWORD", `Use at least ${min} characters.`, { password: `At least ${min} characters` });
  }
  if (new TextEncoder().encode(password).length > 72) return new HttpError(422, "WEAK_PASSWORD", "This password is too long. Shorten it; emoji and some special characters take more space.");
  return null;
}

export function setPassword(db: DB, userId: string, password: string, now: number, mustChangePassword = false) {
  db.credentials[userId] = { passwordHash: hashPassword(password), mustChangePassword, updatedAt: iso(now) };
}

/** Issue a one-time link; earlier unused links of the same kind for the user stop working. */
export function issueToken(db: DB, kind: AuthTokenRow["kind"], userId: string, now: number, token = rand.token(40)): AuthTokenRow {
  for (const t of db.authTokens) if (t.userId === userId && t.kind === kind && !t.usedAt) t.usedAt = iso(now);
  const row: AuthTokenRow = { token, kind, userId, createdAt: iso(now), expiresAt: iso(now + (kind === "invite" ? INVITE_TTL_MS : RESET_TTL_MS)) };
  db.authTokens.push(row);
  return row;
}

export type TokenState = "ok" | "missing" | "expired";
export function lookupToken(db: DB, kind: AuthTokenRow["kind"], token: unknown, now: number): { state: TokenState; row?: AuthTokenRow; user?: UserRow } {
  const row = typeof token === "string" ? db.authTokens.find((t) => t.token === token && t.kind === kind) : undefined;
  const user = row && db.users.find((u) => u.id === row.userId);
  if (!row || !user) return { state: "missing" };
  if (row.usedAt || new Date(row.expiresAt).getTime() <= now) return { state: "expired", row, user };
  return { state: "ok", row, user };
}

/** What a real API would email. The mock logs the link so testers can open it. */
export function logEmailLink(kind: "invite" | "reset", user: UserRow, token: string) {
  const path = kind === "invite" ? `/set-password?token=${token}` : `/reset-password?token=${token}`;
  console.info(`[tasued-mocks] ${kind === "invite" ? "LMS invitation" : "Password reset"} email to ${user.email}: ${path}`);
}

/** Mark an invite as (re)sent unless already accepted. */
export function markSent(inv: { status: InviteStatus; sentAt?: string; acceptedAt?: string } | undefined, now: number) {
  if (inv?.status === "accepted") return inv;
  return { status: "sent" as const, sentAt: iso(now) };
}

/** Send the LMS set-password invitation (new token) and/or the Teams guest invitation. */
export function sendInvites(db: DB, u: UserRow, now: number, opts: { lms: boolean; teams: boolean }) {
  let lms = 0;
  let teams = 0;
  if (opts.lms && u.lmsInvite?.status !== "accepted") {
    u.lmsInvite = markSent(u.lmsInvite, now);
    const t = issueToken(db, "invite", u.id, now);
    logEmailLink("invite", u, t.token);
    lms = 1;
  }
  if (opts.teams && u.teamsGuest?.status !== "accepted") {
    u.teamsGuest = markSent(u.teamsGuest, now);
    teams = 1;
  }
  return { lms, teams };
}
