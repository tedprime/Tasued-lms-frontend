/** Stable seed ids (so demo accounts and deep links survive a reseed). */
export const DEMO_STUDENT_IDS = ["stu-adaeze", "stu-tunde", "stu-chiamaka"] as const;
export const DEMO_STAFF_IDS = ["stf-super", "stf-ogunleye", "stf-nwosu"] as const;

/** Seeded student whose LMS invitation is outstanding — open /set-password?token=demo-invite-token */
export const INVITED_DEMO_STUDENT_ID = "stu-ifeoluwa";
export const DEMO_INVITE_TOKEN = "demo-invite-token";
export const EXPIRED_INVITE_TOKEN = "expired-invite-token";

/**
 * The platform currently runs ONE course: AIIE 111 — Foundation of Artificial Intelligence and
 * Digital Productivity, with the course text of the student handout (see aiie111-content.json).
 */
export const AIIE_COURSE_ID = "crs-aiie111";
export const AIIE_PREFIX = "AIIE111";
export const AIIE_LECTURER_IDS = ["stf-ogunleye"] as const;
export const AIIE_ASSISTANT_IDS = ["stf-nwosu"] as const;

/** The class timetable runs 13 teaching weeks and started 4 weeks before the current (Lagos) week. */
export const SEMESTER_WEEKS = 13;
export const WEEKS_ELAPSED = 4;

/** Two 2-hour classes a day, three days a week (Lagos time): Mon/Wed/Fri 10:00–12:00 and 14:00–16:00. */
export const CLASS_SLOTS = [
  { weekday: 1, hour: 10 },
  { weekday: 1, hour: 14 },
  { weekday: 3, hour: 10 },
  { weekday: 3, hour: 14 },
  { weekday: 5, hour: 10 },
  { weekday: 5, hour: 14 },
] as const;
export const CLASS_HOURS = 2;


/** Unit id for handout unit "m.u", e.g. unitId("1.1") → "unt-aiie111-1-1". */
export const unitId = (code: string) => `unt-aiie111-${code.replace(".", "-")}`;
export const moduleId = (n: number) => `mod-aiie111-${n}`;
