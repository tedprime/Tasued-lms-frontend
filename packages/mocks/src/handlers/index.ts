import type { App } from "../lib/auth";
import { createRouter } from "../lib/route";
import { registerAnnouncements } from "./announcements";
import { registerAssignments } from "./assignments";
import { registerAttendance } from "./attendance";
import { registerAudit } from "./audit";
import { registerAuth } from "./auth";
import { registerClasses } from "./classes";
import { registerContent } from "./content";
import { registerCourses } from "./courses";
import { registerDashboards } from "./dashboards";
import { registerForum } from "./forum";
import { registerGrades } from "./grades";
import { registerIntegrations } from "./integrations";
import { registerNotifications } from "./notifications";
import { registerPeople } from "./people";
import { registerQuizzes } from "./quizzes";
import { registerRecordings } from "./recordings";
import { registerReports } from "./reports";
import { registerSearch } from "./search";
import { registerSettings } from "./settings";

/**
 * Build every MSW handler for one app. Order matters where paths overlap
 * (e.g. /courses/catalogue before /courses/:id, *.csv before /:id) — each register* call
 * already declares its own specific paths first.
 */
export function createHandlers(opts: { app: App; latency?: boolean }) {
  const r = createRouter(opts);
  registerAuth(r);
  registerDashboards(r);
  registerCourses(r);
  registerContent(r);
  registerAttendance(r); // before classes: /classes/:id/attendance.csv
  registerClasses(r);
  registerRecordings(r);
  registerAssignments(r);
  registerQuizzes(r);
  registerGrades(r);
  registerForum(r);
  registerAnnouncements(r);
  registerNotifications(r);
  registerPeople(r);
  registerReports(r);
  registerAudit(r);
  registerIntegrations(r);
  registerSettings(r);
  registerSearch(r);
  r.notFoundFallback();
  return r.handlers;
}
