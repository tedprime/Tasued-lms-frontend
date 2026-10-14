import { DAY, iso, startOfLagosWeek } from "../../lib/dates";
import type { DB } from "../schema";
import { HANDOUT } from "./content";
import { AIIE_ASSISTANT_IDS, AIIE_COURSE_ID, AIIE_LECTURER_IDS, AIIE_PREFIX, WEEKS_ELAPSED } from "./ids";

/**
 * One course for now: AIIE 111, described by the "About this course" text of the student handout.
 * (Course → Modules → Units; there are no faculties, departments, sessions, semesters or offerings.)
 * Staff role assignments and enrolments are added by seedPeople.
 */
export function seedCourses(db: DB, now: number) {
  db.courses = [
    {
      id: AIIE_COURSE_ID,
      code: HANDOUT.course.code,
      title: HANDOUT.course.title,
      description: HANDOUT.course.description,
      creditUnits: 2,
      level: 100,
      status: "published",
      lecturerIds: [...AIIE_LECTURER_IDS],
      assistantIds: [...AIIE_ASSISTANT_IDS],
      classCodePrefix: AIIE_PREFIX,
      createdAt: iso(now - 50 * DAY),
    },
  ];
}

/** Monday 00:00 (Lagos) of teaching week 1 (the class timetable started WEEKS_ELAPSED weeks ago). */
export const teachingStart = (now: number) => startOfLagosWeek(now) - WEEKS_ELAPSED * 7 * DAY;
