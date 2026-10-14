import { iso } from "../../lib/dates";
import { makeRandom, mulberry32 } from "../../lib/random";
import { DEFAULT_ORGANISER_EMAIL } from "../ops/recordings";
import { DB_VERSION, type DB } from "../schema";
import { seedAssignments } from "./assignments";
import { seedClasses } from "./classes";
import { makeHealth, seedAnnouncements, seedAudit, seedManualGrades, seedNotifications } from "./comms";
import { seedContent, seedProgress } from "./content";
import { seedForum } from "./forum";
import { seedPeople } from "./people";
import { seedQuizzes } from "./quizzes";
import { seedCourses } from "./courses";

export { DEMO_INVITE_TOKEN, DEMO_STAFF_IDS, DEMO_STUDENT_IDS, EXPIRED_INVITE_TOKEN, INVITED_DEMO_STUDENT_ID } from "./ids";

export function seedDatabase(now: number): DB {
  const r = makeRandom(mulberry32(20262027));
  const db: DB = {
    version: DB_VERSION,
    seededAt: iso(now),
    users: [], credentials: {}, authTokens: [], preferences: {}, courses: [],
    enrolments: [], modules: [], units: [], progress: [], classes: [], recordings: [], positions: [], sheets: [],
    assignments: [], submissions: [], extensions: [], banks: [], questions: [], quizzes: [], attempts: [],
    gradeItems: [], gradeCells: [], gradeChanges: [], categories: [], threads: [], posts: [], reports: [],
    announcements: [], notifications: [], audit: [], imports: [],
    health: makeHealth(now),
    settings: {
      institutionName: "Tai Solarin University of Education, Ijebu-Ode",
      attendanceRule: { presentThresholdPercent: 75, lateAfterMinutes: 10 },
      defaultLatePolicy: "accepted_with_penalty",
      maxUploadMb: 50,
      organiserAccountEmail: DEFAULT_ORGANISER_EMAIL,
      minPasswordLength: 8,
      supportEmail: "lms-support@tasued.edu.ng",
    },
  };
  seedCourses(db, now);
  seedPeople(db, now, r);
  seedContent(db, now, r);
  seedProgress(db, now, r);
  seedClasses(db, now, r);
  seedAssignments(db, now, r);
  seedQuizzes(db, now, r);
  seedManualGrades(db, now, r);
  seedForum(db, now, r);
  seedAnnouncements(db, now);
  seedNotifications(db, now);
  seedAudit(db, now, r);
  return db;
}
