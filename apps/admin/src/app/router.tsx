import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import type { ComponentType } from "react";
import type { Permission } from "@tasued/api-client";
import { RequireAuth, RequirePermission, RequireTeaching } from "./session";
import { RouteError } from "../components/RouteError";
import { NotFound } from "../components/NotFound";
import { AppShell } from "../layout/AppShell";
import { LegacyOfferingRedirect } from "./legacy";

/** Lazy route page: code-split by feature. */
function page<M>(loader: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await loader()) });
}

const guard = (perm: Permission | Permission[], children: RouteObject[], what?: string): RouteObject => ({
  element: <RequirePermission perm={perm} what={what} />,
  children,
});

/** Course pages only the course's lecturer and teaching assistants use. */
const teachingTabs: RouteObject[] = [
  guard(["classes.schedule", "attendance.manage"], [
    { path: "classes", lazy: page(() => import("../features/classes/ClassesTab"), (m) => m.ClassesTab) },
  ], "work with classes"),
  guard("attendance.manage", [
    { path: "classes/:classId/attendance", lazy: page(() => import("../features/attendance/AttendanceSheetPage"), (m) => m.AttendanceSheetPage) },
    { path: "attendance", lazy: page(() => import("../features/attendance/AttendanceTab"), (m) => m.AttendanceTab) },
  ], "manage attendance"),
  guard("recordings.manage", [
    { path: "recordings", lazy: page(() => import("../features/recordings/RecordingsTab"), (m) => m.RecordingsTab) },
  ], "manage recordings"),
  guard(["assignments.manage", "assignments.grade"], [
    { path: "assignments", lazy: page(() => import("../features/assignments/AssignmentsTab"), (m) => m.AssignmentsTab) },
    { path: "assignments/new", lazy: page(() => import("../features/assignments/AssignmentEditorPage"), (m) => m.AssignmentEditorPage) },
    { path: "assignments/:assignmentId", lazy: page(() => import("../features/assignments/AssignmentEditorPage"), (m) => m.AssignmentEditorPage) },
    { path: "assignments/:assignmentId/submissions", lazy: page(() => import("../features/assignments/SubmissionsPage"), (m) => m.SubmissionsPage) },
  ], "work with assignments"),
  guard(["quizzes.manage", "quizzes.grade"], [
    { path: "quizzes", lazy: page(() => import("../features/quizzes/QuizzesTab"), (m) => m.QuizzesTab) },
    { path: "quizzes/new", lazy: page(() => import("../features/quizzes/QuizEditorPage"), (m) => m.QuizEditorPage) },
    { path: "quizzes/:quizId", lazy: page(() => import("../features/quizzes/QuizEditorPage"), (m) => m.QuizEditorPage) },
    { path: "quizzes/:quizId/attempts", lazy: page(() => import("../features/quizzes/QuizAttemptsPage"), (m) => m.QuizAttemptsPage) },
    { path: "question-banks", lazy: page(() => import("../features/quizzes/QuestionBanksPage"), (m) => m.QuestionBanksPage) },
    { path: "question-banks/:bankId", lazy: page(() => import("../features/quizzes/QuestionBanksPage"), (m) => m.QuestionBanksPage) },
  ], "work with quizzes"),
  guard(["assignments.grade", "quizzes.grade", "grades.release"], [
    { path: "gradebook", lazy: page(() => import("../features/gradebook/GradebookTab"), (m) => m.GradebookTab) },
  ], "view the gradebook"),
  guard("forum.moderate", [
    { path: "forum", lazy: page(() => import("../features/forum/CourseForumTab"), (m) => m.CourseForumTab) },
  ], "moderate the forum"),
  guard("announcements.send", [
    { path: "announcements", lazy: page(() => import("../features/announcements/AnnouncementsPage"), (m) => m.CourseAnnouncementsTab) },
  ], "send announcements"),
];

/** Content (read-only unless you teach the course), students and the report are open to administrators too. */
const courseTabs: RouteObject[] = [
  { index: true, element: <Navigate to="content" replace /> },
  { path: "content", lazy: page(() => import("../features/content/ContentTab"), (m) => m.ContentTab) },
  { path: "units/:unitId", lazy: page(() => import("../features/content/UnitEditorPage"), (m) => m.UnitEditorPage) },
  { path: "students", lazy: page(() => import("../features/students/StudentsTab"), (m) => m.StudentsTab) },
  { element: <RequireTeaching />, children: teachingTabs },
  guard("reports.view", [
    { path: "report", lazy: page(() => import("../features/reports/CourseReportPanel"), (m) => m.CourseReportTab) },
  ], "view reports"),
];

export function createAppRouter() {
  const routes: RouteObject[] = [
    { path: "/sign-in", lazy: page(() => import("../features/auth/SignInPage"), (m) => m.SignInPage), errorElement: <RouteError /> },
    {
      element: <RequireAuth />,
      errorElement: <RouteError />,
      children: [
        {
          element: <AppShell />,
          errorElement: <RouteError />,
          children: [
            { index: true, lazy: page(() => import("../features/dashboard/DashboardPage"), (m) => m.DashboardPage) },
            { path: "courses", lazy: page(() => import("../features/courses/CoursesPage"), (m) => m.CoursesPage) },
            {
              path: "courses/:courseId",
              lazy: page(() => import("../features/courses/CourseLayout"), (m) => m.CourseLayout),
              children: courseTabs,
            },
            // Old offering links keep working.
            { path: "offerings/*", element: <LegacyOfferingRedirect /> },
            guard(["classes.schedule", "attendance.manage"], [
              { path: "classes", lazy: page(() => import("../features/classes/ClassesGlobalPage"), (m) => m.ClassesGlobalPage) },
            ], "work with classes"),
            guard("recordings.manage", [
              { path: "recordings", lazy: page(() => import("../features/recordings/RecordingsGlobalPage"), (m) => m.RecordingsGlobalPage) },
            ], "manage recordings"),
            guard("attendance.manage", [
              { path: "attendance", lazy: page(() => import("../features/attendance/AttendanceGlobalPage"), (m) => m.AttendanceGlobalPage) },
            ], "manage attendance"),
            guard(["assignments.manage", "assignments.grade"], [
              { path: "assignments", lazy: page(() => import("../features/assignments/AssignmentsGlobalPage"), (m) => m.AssignmentsGlobalPage) },
            ]),
            guard(["quizzes.manage", "quizzes.grade"], [
              { path: "quizzes", lazy: page(() => import("../features/quizzes/QuizzesGlobalPage"), (m) => m.QuizzesGlobalPage) },
            ]),
            guard(["assignments.grade", "quizzes.grade", "grades.release"], [
              { path: "gradebook", lazy: page(() => import("../features/gradebook/GradebookGlobalPage"), (m) => m.GradebookGlobalPage) },
            ]),
            guard("forum.moderate", [
              { path: "forum", lazy: page(() => import("../features/forum/ForumModerationPage"), (m) => m.ForumModerationPage) },
              { path: "forum/threads/:threadId", lazy: page(() => import("../features/forum/ThreadPage"), (m) => m.ThreadPage) },
            ], "moderate the forum"),
            guard("announcements.send", [
              { path: "announcements", lazy: page(() => import("../features/announcements/AnnouncementsPage"), (m) => m.AnnouncementsGlobalPage) },
            ], "send announcements"),
            guard("people.manage", [
              { path: "people", lazy: page(() => import("../features/people/PeoplePage"), (m) => m.PeoplePage) },
              { path: "people/:userId", lazy: page(() => import("../features/people/UserDetailPage"), (m) => m.UserDetailPage) },
            ], "manage people"),
            guard("people.import", [
              { path: "people/import", lazy: page(() => import("../features/people/ImportPage"), (m) => m.ImportPage) },
            ], "import people"),
            guard("roles.manage", [
              { path: "roles", lazy: page(() => import("../features/roles/RolesPage"), (m) => m.RolesPage) },
            ], "view roles and permissions"),
            guard("reports.view", [
              { path: "reports", lazy: page(() => import("../features/reports/ReportsPage"), (m) => m.ReportsPage) },
            ], "view reports"),
            guard("audit.view", [{ path: "audit", lazy: page(() => import("../features/audit/AuditPage"), (m) => m.AuditPage) }], "view the audit log"),
            guard("integrations.view", [
              { path: "integrations", lazy: page(() => import("../features/integrations/IntegrationsPage"), (m) => m.IntegrationsPage) },
            ], "view integration health"),
            guard("settings.manage", [
              { path: "settings", lazy: page(() => import("../features/settings/SettingsPage"), (m) => m.SettingsPage) },
            ], "change platform settings"),
            { path: "profile", lazy: page(() => import("../features/profile/ProfilePage"), (m) => m.ProfilePage) },
            { path: "*", element: <NotFound /> },
          ],
        },
      ],
    },
  ];
  return createBrowserRouter(routes);
}
