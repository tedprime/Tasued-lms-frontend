import type { Session, UserPreferences } from "@tasued/api-client";
import { audit, find } from "../db/ops/common";
import { DEFAULT_PREFERENCES, type DB } from "../db/schema";
import { DEMO_STAFF_IDS, DEMO_STUDENT_IDS } from "../db/seed";
import { userView } from "../db/views/core";
import { buildViewer, clearSession, setSessionUserId, type Viewer } from "../lib/auth";
import type { BaseCtx } from "../lib/route";
import type { UserRow } from "../db/schema";
import { iso } from "../lib/dates";
import { HttpError, forbidden, invalid, noContent, unauthenticated } from "../lib/http";
import { verifyPassword } from "../lib/password";
import { isStudent, issueToken, logEmailLink, lookupToken, setPassword, weakPassword } from "../db/ops/accounts";
import type { Router } from "../lib/route";
import { HttpResponse } from "msw";

export function sessionView(db: DB, v: Viewer): Session {
  return {
    user: userView(db, v.user),
    mustChangePassword: db.credentials[v.user.id]?.mustChangePassword ?? false,
    permissions: v.permissions,
    staffCourseIds: [...v.staffCourseIds],
    teachingCourseIds: [...v.teachingCourseIds],
    preferences: db.preferences[v.user.id] ?? { ...DEFAULT_PREFERENCES },
  };
}

const useMicrosoft = () => new HttpError(403, "USE_MICROSOFT", "Staff sign in with Microsoft.");
const deactivated = () => new HttpError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated. Contact the ICT helpdesk.");
const inviteGone = () => new HttpError(410, "INVITE_EXPIRED", "This invitation link has expired or was already used. Ask the LMS admin to resend it.");
const resetGone = () => new HttpError(410, "RESET_LINK_EXPIRED", "This reset link has expired or was already used. Request a new one.");

/** Start a session in this app for a student who just proved their password. */
function signIn(c: BaseCtx, user: UserRow, how: string) {
  setSessionUserId(c.app, user.id);
  user.lastSeenAt = iso(c.now);
  audit(c.db, user, "auth.signed_in", "user", user.id, `Signed in to the ${c.app} app (${how})`, c.now);
  return sessionView(c.db, buildViewer(c.db, user));
}

function registerPasswordAuth(r: Router) {
  /* Students sign in with email + password. Staff use Microsoft; the staff app never accepts passwords. */
  r.public.post("/auth/login", async (c) => {
    const b = await c.json<{ email?: string; password?: string }>();
    if (c.app === "admin") throw useMicrosoft();
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!email || !password) throw invalid("VALIDATION_FAILED", "Enter your email and password.", { ...(!email ? { email: "Required" } : {}), ...(!password ? { password: "Required" } : {}) });
    const user = c.db.users.find((u) => u.email.toLowerCase() === email);
    const bad = () => new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (!user) throw bad();
    if (!isStudent(user)) throw useMicrosoft();
    const cred = c.db.credentials[user.id];
    if (user.lmsInvite?.status !== "accepted" || !cred) {
      throw new HttpError(423, "ACCOUNT_NOT_ACTIVATED", "Finish setting up your account from the invitation email first.");
    }
    if (!verifyPassword(password, cred.passwordHash)) throw bad();
    if (user.status === "deactivated" || user.status === "suspended") throw deactivated();
    return signIn(c, user, "password");
  });

  r.public.get("/auth/invites/:token", (c) => {
    const t = lookupToken(c.db, "invite", c.params.token, c.now);
    if (t.state === "missing") throw new HttpError(404, "INVITE_NOT_FOUND", "This invitation link isn't valid. Check you copied the whole link.");
    if (t.state === "expired" || t.user!.lmsInvite?.status === "accepted") throw inviteGone();
    return { email: t.user!.email, fullName: t.user!.fullName, expiresAt: t.row!.expiresAt };
  });

  r.public.post("/auth/invites/accept", async (c) => {
    const b = await c.json<{ token?: string; password?: string }>();
    const t = lookupToken(c.db, "invite", b.token, c.now);
    if (t.state === "missing") throw new HttpError(404, "INVITE_NOT_FOUND", "This invitation link isn't valid. Check you copied the whole link.");
    if (t.state === "expired" || t.user!.lmsInvite?.status === "accepted") throw inviteGone();
    const weak = weakPassword(c.db, b.password);
    if (weak) throw weak;
    const user = t.user!;
    if (user.status === "deactivated" || user.status === "suspended") throw deactivated();
    setPassword(c.db, user.id, b.password!, c.now);
    t.row!.usedAt = iso(c.now);
    user.lmsInvite = { status: "accepted", sentAt: user.lmsInvite?.sentAt, acceptedAt: iso(c.now) };
    if (user.status === "invited") user.status = "active";
    audit(c.db, user, "invite.accepted", "user", user.id, `${user.fullName} accepted the LMS invitation and set a password`, c.now);
    return signIn(c, user, "invitation accepted");
  });

  r.public.post("/auth/password/forgot", async (c) => {
    const b = await c.json<{ email?: string }>();
    const email = String(b.email ?? "").trim().toLowerCase();
    const user = email ? c.db.users.find((u) => u.email.toLowerCase() === email) : undefined;
    // Always 204 so the response never reveals whether the email exists.
    if (user && isStudent(user) && user.lmsInvite?.status === "accepted" && user.status !== "deactivated" && user.status !== "suspended") {
      const t = issueToken(c.db, "reset", user.id, c.now);
      logEmailLink("reset", user, t.token);
      audit(c.db, user, "password.reset_requested", "user", user.id, `${user.fullName} requested a password reset email`, c.now);
    }
    return noContent();
  });

  r.public.post("/auth/password/reset", async (c) => {
    const b = await c.json<{ token?: string; password?: string }>();
    const t = lookupToken(c.db, "reset", b.token, c.now);
    if (t.state !== "ok") throw resetGone();
    const weak = weakPassword(c.db, b.password);
    if (weak) throw weak;
    setPassword(c.db, t.user!.id, b.password!, c.now);
    t.row!.usedAt = iso(c.now);
    audit(c.db, t.user!, "password.reset", "user", t.user!.id, `${t.user!.fullName} reset their password from the email link`, c.now);
    return noContent();
  });

  r.post("/auth/password/change", async (c) => {
    const b = await c.json<{ currentPassword?: string; newPassword?: string }>();
    const user = c.viewer.user;
    if (!isStudent(user)) throw useMicrosoft();
    const cred = c.db.credentials[user.id];
    if (!cred || !verifyPassword(String(b.currentPassword ?? ""), cred.passwordHash)) {
      throw new HttpError(400, "WRONG_PASSWORD", "Your current password is incorrect.", { currentPassword: "Incorrect password" });
    }
    const weak = weakPassword(c.db, b.newPassword);
    if (weak) throw new HttpError(weak.status, weak.code, weak.message, { newPassword: weak.details!.password! });
    setPassword(c.db, user.id, b.newPassword!, c.now, false);
    audit(c.db, user, "password.changed", "user", user.id, `${user.fullName} changed their password`, c.now);
    return sessionView(c.db, c.viewer);
  });
}

export function registerAuth(r: Router) {
  r.public.get('/auth/password-policy', c => ({ minLength: c.db.settings.minPasswordLength, maxBytes: 72 }));
  registerPasswordAuth(r);
  const demoIds = (): readonly string[] => (r.app === "student" ? DEMO_STUDENT_IDS : DEMO_STAFF_IDS);

  r.public.get("/auth/session", (c) => {
    if (!c.viewer) throw unauthenticated();
    return sessionView(c.db, c.viewer);
  });

  r.public.get("/auth/dev-accounts", (c) =>
    demoIds()
      .map((id) => c.db.users.find((u) => u.id === id))
      .filter((u) => !!u)
      .map((u) => {
        const full = userView(c.db, u!);
        return { id: full.id, fullName: full.fullName, email: full.email, roles: full.roles };
      }),
  );

  r.public.post("/auth/dev-login", async (c) => {
    const body = await c.json<{ userId?: string }>();
    if (!body.userId) throw invalid("VALIDATION_FAILED", "Choose an account to sign in with.", { userId: "Required" });
    const user = find(c.db.users, body.userId, "account");
    if (user.status === "deactivated" || user.status === "suspended") throw deactivated();
    const v = buildViewer(c.db, user);
    if (c.app === "admin" && !v.isStaff) throw forbidden("This account doesn't have access to the staff portal.");
    setSessionUserId(c.app, user.id);
    user.lastSeenAt = iso(c.now);
    if (user.status === "invited") user.status = "active";
    audit(c.db, user, "auth.signed_in", "user", user.id, `Signed in to the ${c.app} app (demo account)`, c.now);
    return sessionView(c.db, v);
  });

  /** Real flow is a full-page redirect to Entra ID; in mock mode sign in as the first demo account. */
  r.public.get("/auth/microsoft/login", (c) => {
    const first = demoIds()[0];
    if (first) setSessionUserId(c.app, first);
    const returnTo = c.q("returnTo") ?? "/";
    return new HttpResponse(null, { status: 302, headers: { Location: returnTo } });
  });

  r.public.post("/auth/logout", (c) => {
    clearSession(c.app);
    return undefined;
  });

  r.patch("/me/preferences", async (c) => {
    const b = await c.json<Partial<UserPreferences>>();
    const cur = c.db.preferences[c.viewer.user.id] ?? { ...DEFAULT_PREFERENCES };
    const next: UserPreferences = { ...cur };
    if (typeof b.lowDataMode === "boolean") next.lowDataMode = b.lowDataMode;
    if (typeof b.emailNotifications === "boolean") next.emailNotifications = b.emailNotifications;
    if (typeof b.playbackSpeed === "number") {
      if (b.playbackSpeed < 0.5 || b.playbackSpeed > 2) throw invalid("VALIDATION_FAILED", "Playback speed must be between 0.5× and 2×.", { playbackSpeed: "Out of range" });
      next.playbackSpeed = b.playbackSpeed;
    }
    c.db.preferences[c.viewer.user.id] = next;
    return next;
  });

  r.patch("/me/profile", async (c) => {
    const b = await c.json<{ phone?: string }>();
    if (b.phone !== undefined) {
      const phone = String(b.phone).trim();
      if (phone && !/^\+?[0-9\s-]{7,18}$/.test(phone)) throw invalid("VALIDATION_FAILED", "Enter a valid phone number, e.g. +234 803 123 4567.", { phone: "Invalid phone number" });
      c.viewer.user.phone = phone || undefined;
    }
    return userView(c.db, c.viewer.user);
  });
}
