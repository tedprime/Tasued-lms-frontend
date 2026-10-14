import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PageLoader } from "@tasued/ui";
import { RequireAuth } from "./session";
import { AppShell } from "../layout/AppShell";
import { RouteErrorPage } from "../features/system/RouteErrorPage";

/* Route pages are code-split per feature. */
const page = (factory: () => Promise<{ default: ComponentType }>) => {
  const C: LazyExoticComponent<ComponentType> = lazy(factory);
  return (
    <Suspense fallback={<PageLoader />}>
      <C />
    </Suspense>
  );
};

const SignInPage = () => import("../features/auth/SignInPage");
const SetPasswordPage = () => import("../features/auth/SetPasswordPage");
const ForgotPasswordPage = () => import("../features/auth/ForgotPasswordPage");
const ResetPasswordPage = () => import("../features/auth/ResetPasswordPage");
const ChangePasswordPage = () => import("../features/auth/ChangePasswordPage");
const WelcomePage = () => import("../features/auth/WelcomePage");
const DashboardPage = () => import("../features/dashboard/DashboardPage");
const MyCoursesPage = () => import("../features/courses/MyCoursesPage");
const BrowseCoursesPage = () => import("../features/courses/BrowseCoursesPage");
const CourseLayout = () => import("../features/courses/CourseLayout");
const CourseOverviewTab = () => import("../features/courses/tabs/OverviewTab");
const CourseClassesTab = () => import("../features/courses/tabs/ClassesTab");
const CourseRecordingsTab = () => import("../features/courses/tabs/RecordingsTab");
const CourseAssignmentsTab = () => import("../features/courses/tabs/AssignmentsTab");
const CourseQuizzesTab = () => import("../features/courses/tabs/QuizzesTab");
const CourseForumTab = () => import("../features/courses/tabs/ForumTab");
const CourseGradesTab = () => import("../features/courses/tabs/GradesTab");
const CourseAttendanceTab = () => import("../features/courses/tabs/AttendanceTab");
const CourseAnnouncementsTab = () => import("../features/courses/tabs/AnnouncementsTab");
const UnitPage = () => import("../features/units/UnitPage");
const ClassesPage = () => import("../features/classes/ClassesPage");
const AssignmentsPage = () => import("../features/assignments/AssignmentsPage");
const AssignmentDetailPage = () => import("../features/assignments/AssignmentDetailPage");
const QuizzesPage = () => import("../features/quizzes/QuizzesPage");
const QuizDetailPage = () => import("../features/quizzes/QuizDetailPage");
const QuizAttemptPage = () => import("../features/quizzes/QuizAttemptPage");
const GradesPage = () => import("../features/grades/GradesPage");
const AttendancePage = () => import("../features/attendance/AttendancePage");
const ForumPage = () => import("../features/forum/ForumPage");
const NewThreadPage = () => import("../features/forum/NewThreadPage");
const ThreadPage = () => import("../features/forum/ThreadPage");
const AnnouncementsPage = () => import("../features/announcements/AnnouncementsPage");
const NotificationsPage = () => import("../features/notifications/NotificationsPage");
const SearchPage = () => import("../features/search/SearchPage");
const ProfilePage = () => import("../features/profile/ProfilePage");
const SettingsPage = () => import("../features/settings/SettingsPage");
const NotFoundPage = () => import("../features/system/NotFoundPage");

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/sign-in", element: page(SignInPage) },
      { path: "/set-password", element: page(SetPasswordPage) },
      { path: "/forgot-password", element: page(ForgotPasswordPage) },
      { path: "/reset-password", element: page(ResetPasswordPage) },
      // Focused, signed-in pages without the app shell.
      { path: "/change-password", element: <RequireAuth>{page(ChangePasswordPage)}</RequireAuth> },
      { path: "/welcome", element: <RequireAuth>{page(WelcomePage)}</RequireAuth> },
      {
        // Full-screen quiz takeover (no sidebar), as in SLAN's AssessmentView.
        path: "/quizzes/attempts/:attemptId",
        element: <RequireAuth>{page(QuizAttemptPage)}</RequireAuth>,
      },
      {
        path: "/",
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          {
            errorElement: <RouteErrorPage inline />,
            children: [
              { index: true, element: page(DashboardPage) },
              { path: "courses", element: page(MyCoursesPage) },
              { path: "courses/browse", element: page(BrowseCoursesPage) },
              { path: "courses/:courseId/units/:unitId", element: page(UnitPage) },
              {
                path: "courses/:courseId",
                element: page(CourseLayout),
                children: [
                  { index: true, element: page(CourseOverviewTab) },
                  { path: "classes", element: page(CourseClassesTab) },
                  { path: "recordings", element: page(CourseRecordingsTab) },
                  { path: "assignments", element: page(CourseAssignmentsTab) },
                  { path: "quizzes", element: page(CourseQuizzesTab) },
                  { path: "forum", element: page(CourseForumTab) },
                  { path: "grades", element: page(CourseGradesTab) },
                  { path: "attendance", element: page(CourseAttendanceTab) },
                  { path: "announcements", element: page(CourseAnnouncementsTab) },
                ],
              },
              { path: "classes", element: page(ClassesPage) },
              { path: "assignments", element: page(AssignmentsPage) },
              { path: "assignments/:assignmentId", element: page(AssignmentDetailPage) },
              { path: "quizzes", element: page(QuizzesPage) },
              { path: "quizzes/:quizId", element: page(QuizDetailPage) },
              { path: "grades", element: page(GradesPage) },
              { path: "attendance", element: page(AttendancePage) },
              { path: "forum", element: page(ForumPage) },
              { path: "forum/new", element: page(NewThreadPage) },
              { path: "forum/:threadId", element: page(ThreadPage) },
              { path: "announcements", element: page(AnnouncementsPage) },
              { path: "notifications", element: page(NotificationsPage) },
              { path: "search", element: page(SearchPage) },
              { path: "profile", element: page(ProfilePage) },
              { path: "settings", element: page(SettingsPage) },
              { path: "*", element: page(NotFoundPage) },
            ],
          },
        ],
      },
    ],
  },
]);

