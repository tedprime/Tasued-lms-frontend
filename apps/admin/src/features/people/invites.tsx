import type { InviteStatus, User } from "@tasued/api-client";
import { Badge, type Tone } from "../../components/ui";

/** Students sign in to the LMS with a platform password and join Teams classes as guests of our organisation. */
export const isStudent = (u: Pick<User, "roles">) => u.roles.some((r) => r.role === "student");

/** Filter values used in the People list (and in links from the dashboard). */
export type LmsFilter = "" | "invited" | "active" | "expired";
export type TeamsFilter = "" | "invited" | "accepted" | "expired";

const LMS_LABEL: Record<InviteStatus, string> = { not_sent: "Not queued", queued: "Queued", retrying: "Retrying", failed: "Failed", sent: "Invited", accepted: "Active", expired: "Invite expired" };
const TEAMS_LABEL: Record<InviteStatus, string> = { not_sent: "Not queued", queued: "Queued", retrying: "Retrying", failed: "Failed", sent: "Invited", accepted: "Accepted", expired: "Expired" };
const TONE: Record<InviteStatus, Tone> = { not_sent: "neutral", queued: "blue", retrying: "amber", failed: "amber", sent: "blue", accepted: "green", expired: "amber" };

export const lmsInviteStatus = (u: User): InviteStatus => u.lmsInvite?.status ?? (u.status === "active" ? "accepted" : "not_sent");
export const teamsGuestStatus = (u: User): InviteStatus => u.teamsGuest?.status ?? "not_sent";

export function LmsAccountPill({ user, withLabel }: { user: User; withLabel?: boolean }) {
  const s = lmsInviteStatus(user);
  return <Badge tone={TONE[s]} dot>{withLabel ? `LMS account: ${LMS_LABEL[s]}` : LMS_LABEL[s]}</Badge>;
}

export function TeamsGuestPill({ user, withLabel }: { user: User; withLabel?: boolean }) {
  const s = teamsGuestStatus(user);
  return <Badge tone={TONE[s]} dot>{withLabel ? `Teams guest: ${TEAMS_LABEL[s]}` : TEAMS_LABEL[s]}</Badge>;
}
