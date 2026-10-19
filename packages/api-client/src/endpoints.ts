import { request } from "./client";
import type * as T from "./types";

/**
 * Every REST endpoint the two apps use, grouped by area.
 * Paths are relative to the API base (default /api/v1).
 * The mock layer (@tasued/mocks) implements exactly these paths.
 */

const q = (o: object) => o as Record<string, string | number | boolean | undefined | null>;

/* ── Auth ─────────────────────────────────────────────── */
export const auth = {
  /* ── Students: platform email + password ── */
  passwordLogin: (b: { email: string; password: string }) => request<T.Session>("/auth/login", { method: "POST", body: b }),
  /** Details for the "set your password" page opened from the invitation email. */
  inviteInfo: (token: string) => request<{ email: string; fullName: string; expiresAt: T.ISODate }>(`/auth/invites/${encodeURIComponent(token)}`),
  acceptInvite: (b: { token: string; password: string }) => request<T.Session>("/auth/invites/accept", { method: "POST", body: b }),
  /** Always 204 (doesn't reveal whether the email exists). */
  requestPasswordReset: (b: { email: string }) => request<void>("/auth/password/forgot", { method: "POST", body: b }),
  resetPassword: (b: { token: string; password: string }) => request<void>("/auth/password/reset", { method: "POST", body: b }),
  changePassword: (b: { currentPassword: string; newPassword: string }) =>
    request<T.Session>("/auth/password/change", { method: "POST", body: b }),

  /* ── Staff: Microsoft Entra ID ── */
  /** Full-page redirect target for Microsoft Entra ID sign-in (OIDC + PKCE handled by the API). */
  microsoftLoginUrl: (base: string, returnTo: string) =>
    `${base}/auth/microsoft/login?returnTo=${encodeURIComponent(returnTo)}`,
  session: () => request<T.Session>("/auth/session"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  /** Mock / local development only — signs in as a seeded demo account. */
  devLogin: (userId: T.ID) => request<T.Session>("/auth/dev-login", { method: "POST", body: { userId } }),
  devAccounts: () => request<Pick<T.User, "id" | "fullName" | "email" | "roles">[]>("/auth/dev-accounts"),
  updatePreferences: (p: Partial<T.UserPreferences>) =>
    request<T.UserPreferences>("/me/preferences", { method: "PATCH", body: p }),
  updateProfile: (p: Pick<T.User, "phone">) => request<T.User>("/me/profile", { method: "PATCH", body: p }),
};

/* ── Dashboards ───────────────────────────────────────── */
export const dashboards = {
  student: () => request<T.StudentDashboard>("/me/dashboard"),
  admin: () => request<T.AdminDashboard>("/admin/dashboard"),
};

/* ── Courses (Course → Modules → Units), enrolment, staff ── */
export const courses = {
  /** Students: courses they're enrolled in. Staff: courses they teach (super admins: all). */
  list: (p: T.ListQuery & { status?: T.CourseStatus } = {}) => request<T.Paginated<T.Course>>("/courses", { query: q(p) }),
  /** Students: every published course (any course, any time). */
  catalogue: (p: T.ListQuery = {}) => request<T.Paginated<T.Course>>("/courses/catalogue", { query: q(p) }),
  get: (id: T.ID) => request<T.Course>(`/courses/${id}`),
  create: (b: T.CourseInput) => request<T.Course>("/courses", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<T.CourseInput>) => request<T.Course>(`/courses/${id}`, { method: "PATCH", body: b }),
  delete: (id: T.ID) => request<void>(`/courses/${id}`, { method: "DELETE" }),
  enrolments: (id: T.ID, p: T.ListQuery = {}) => request<T.Paginated<T.Enrolment>>(`/courses/${id}/enrolments`, { query: q(p) }),
  enrol: (id: T.ID, userIds: T.ID[]) => request<{ added: number }>(`/courses/${id}/enrolments`, { method: "POST", body: { userIds } }),
  unenrol: (id: T.ID, userId: T.ID) => request<void>(`/courses/${id}/enrolments/${userId}`, { method: "DELETE" }),
  progress: (id: T.ID) => request<T.UnitProgress[]>(`/courses/${id}/progress`),
};

/* ── Content: modules & units ─────────────────────────── */
export const content = {
  modules: (courseId: T.ID) => request<T.Module[]>(`/courses/${courseId}/modules`),
  createModule: (courseId: T.ID, b: Pick<T.Module, "title" | "summary">) =>
    request<T.Module>(`/courses/${courseId}/modules`, { method: "POST", body: b }),
  updateModule: (id: T.ID, b: Partial<Pick<T.Module, "title" | "summary" | "state">>) =>
    request<T.Module>(`/modules/${id}`, { method: "PATCH", body: b }),
  deleteModule: (id: T.ID) => request<void>(`/modules/${id}`, { method: "DELETE" }),
  reorderModules: (courseId: T.ID, ids: T.ID[]) =>
    request<void>(`/courses/${courseId}/modules/order`, { method: "PUT", body: { ids } }),

  unit: (id: T.ID) => request<T.Unit>(`/units/${id}`),
  createUnit: (moduleId: T.ID, b: Pick<T.Unit, "title">) => request<T.Unit>(`/modules/${moduleId}/units`, { method: "POST", body: b }),
  updateUnit: (
    id: T.ID,
    b: Partial<Pick<T.Unit, "title" | "objectives" | "courseTextHtml" | "courseTextJson" | "state" | "estimatedReadMinutes">>,
  ) => request<T.Unit>(`/units/${id}`, { method: "PATCH", body: b }),
  deleteUnit: (id: T.ID) => request<void>(`/units/${id}`, { method: "DELETE" }),
  reorderUnits: (moduleId: T.ID, ids: T.ID[]) => request<void>(`/modules/${moduleId}/units/order`, { method: "PUT", body: { ids } }),
  uploadAttachment: (unitId: T.ID, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T.Attachment>(`/units/${unitId}/attachments`, { method: "POST", body: fd });
  },
  deleteAttachment: (unitId: T.ID, attachmentId: T.ID) =>
    request<void>(`/units/${unitId}/attachments/${attachmentId}`, { method: "DELETE" }),
  saveProgress: (unitId: T.ID, b: Partial<Pick<T.UnitProgress, "readPercent" | "watchedSeconds" | "completed">>) =>
    request<T.UnitProgress>(`/units/${unitId}/progress`, { method: "PUT", body: b }),
};

/* ── Classes (Teams meetings) ─────────────────────────── */
export const classes = {
  list: (p: { courseId?: T.ID; from?: T.ISODate; to?: T.ISODate; status?: T.ClassSessionStatus } = {}) =>
    request<T.ClassSession[]>("/classes", { query: q(p) }),
  get: (id: T.ID) => request<T.ClassSession>(`/classes/${id}`),
  /** Creates the Teams calendar meeting (auto-record on, class code in title). */
  create: (b: T.ClassSessionInput) => request<T.ClassSession>("/classes", { method: "POST", body: b }),
  createSeries: (b: T.ClassSeriesInput) => request<T.ClassSession[]>("/classes/series", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<T.ClassSessionInput>) => request<T.ClassSession>(`/classes/${id}`, { method: "PATCH", body: b }),
  cancel: (id: T.ID, reason?: string) => request<T.ClassSession>(`/classes/${id}/cancel`, { method: "POST", body: { reason } }),
};

/* ── Recordings ───────────────────────────────────────── */
export const recordings = {
  list: (p: { courseId?: T.ID; status?: T.RecordingStatus; unitId?: T.ID } = {}) =>
    request<T.Recording[]>("/recordings", { query: q(p) }),
  get: (id: T.ID) => request<T.Recording>(`/recordings/${id}`),
  /** Short-lived OneDrive link for playback. Call again when it expires. */
  playback: (id: T.ID) => request<T.PlaybackLink>(`/recordings/${id}/playback`),
  /** Re-scan the organiser's OneDrive for a pending/failed recording. */
  relink: (id: T.ID) => request<T.Recording>(`/recordings/${id}/relink`, { method: "POST" }),
  update: (id: T.ID, b: Partial<Pick<T.Recording, "title" | "unitIds" | "chapters" | "published">>) =>
    request<T.Recording>(`/recordings/${id}`, { method: "PATCH", body: b }),
  /** Fallback when the recording can't be found: lecturer uploads the MP4; the API stores it in the organiser's OneDrive. */
  upload: (b: { courseId: T.ID; classSessionId?: T.ID; title: string; unitIds: T.ID[]; file: File }) => {
    const fd = new FormData();
    fd.append("courseId", b.courseId);
    if (b.classSessionId) fd.append("classSessionId", b.classSessionId);
    fd.append("title", b.title);
    b.unitIds.forEach((u) => fd.append("unitIds", u));
    fd.append("file", b.file);
    return request<T.Recording>("/recordings/upload", { method: "POST", body: fd });
  },
  delete: (id: T.ID) => request<void>(`/recordings/${id}`, { method: "DELETE" }),
  position: (id: T.ID) => request<T.PlaybackPosition | null>(`/recordings/${id}/position`),
  savePosition: (id: T.ID, positionSeconds: number) =>
    request<T.PlaybackPosition>(`/recordings/${id}/position`, { method: "PUT", body: { positionSeconds } }),
};

/* ── Attendance ───────────────────────────────────────── */
export const attendance = {
  sheet: (classSessionId: T.ID) => request<T.AttendanceSheet>(`/classes/${classSessionId}/attendance`),
  /** Re-fetch the Teams attendance report and re-apply rules. */
  importFromTeams: (classSessionId: T.ID) =>
    request<T.AttendanceSheet>(`/classes/${classSessionId}/attendance/import`, { method: "POST" }),
  switchToManual: (classSessionId: T.ID) =>
    request<T.AttendanceSheet>(`/classes/${classSessionId}/attendance/manual`, { method: "POST" }),
  mark: (classSessionId: T.ID, userId: T.ID, b: { mark: T.AttendanceMark; note?: string }) =>
    request<T.AttendanceRecord>(`/classes/${classSessionId}/attendance/${userId}`, { method: "PUT", body: b }),
  matchUnmatched: (classSessionId: T.ID, b: { displayName: string; userId: T.ID }) =>
    request<T.AttendanceSheet>(`/classes/${classSessionId}/attendance/match`, { method: "POST", body: b }),
  finalise: (classSessionId: T.ID) => request<T.AttendanceSheet>(`/classes/${classSessionId}/attendance/finalise`, { method: "POST" }),
  exportCsvUrl: (base: string, classSessionId: T.ID) => `${base}/classes/${classSessionId}/attendance.csv`,
  mine: () => request<T.StudentAttendanceSummary[]>("/me/attendance"),
};

/* ── Assignments & submissions ────────────────────────── */
export const assignments = {
  list: (p: { courseId?: T.ID; state?: T.PublishState } = {}) => request<T.Assignment[]>("/assignments", { query: q(p) }),
  get: (id: T.ID) => request<T.Assignment>(`/assignments/${id}`),
  create: (b: Omit<T.Assignment, "id" | "courseCode" | "attachments" | "createdAt" | "submissionCount" | "gradedCount">) =>
    request<T.Assignment>("/assignments", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<Omit<T.Assignment, "id" | "courseId" | "courseCode" | "createdAt">>) =>
    request<T.Assignment>(`/assignments/${id}`, { method: "PATCH", body: b }),
  delete: (id: T.ID) => request<void>(`/assignments/${id}`, { method: "DELETE" }),

  /* student */
  mySubmission: (id: T.ID) => request<T.Submission>(`/assignments/${id}/submission`),
  saveDraft: (id: T.ID, b: { textHtml?: string }) => request<T.Submission>(`/assignments/${id}/submission/draft`, { method: "PUT", body: b }),
  uploadDraftFile: (id: T.ID, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T.Attachment>(`/assignments/${id}/submission/files`, { method: "POST", body: fd });
  },
  removeDraftFile: (id: T.ID, fileId: T.ID) => request<void>(`/assignments/${id}/submission/files/${fileId}`, { method: "DELETE" }),
  /** One-way: after this the submission can never be changed (409 SUBMISSION_FINAL). */
  submitFinal: (id: T.ID, b: { confirm: true }) => request<T.Submission>(`/assignments/${id}/submission/final`, { method: "POST", body: b }),

  /* staff */
  submissions: (id: T.ID) => request<T.Submission[]>(`/assignments/${id}/submissions`),
  grade: (id: T.ID, submissionId: T.ID, b: { score: number; feedbackHtml?: string }) =>
    request<T.Submission>(`/assignments/${id}/submissions/${submissionId}/grade`, { method: "PUT", body: b }),
  releaseGrades: (id: T.ID) => request<{ released: number }>(`/assignments/${id}/release`, { method: "POST" }),
  extensions: (id: T.ID) => request<T.Extension[]>(`/assignments/${id}/extensions`),
  grantExtension: (id: T.ID, b: { userId: T.ID; newDueAt: T.ISODate; reason: string }) =>
    request<T.Extension>(`/assignments/${id}/extensions`, { method: "POST", body: b }),
};

/* ── Quizzes ──────────────────────────────────────────── */
export const quizzes = {
  list: (p: { courseId?: T.ID; state?: T.PublishState } = {}) => request<T.Quiz[]>("/quizzes", { query: q(p) }),
  get: (id: T.ID) => request<T.Quiz>(`/quizzes/${id}`),
  create: (b: Omit<T.Quiz, "id" | "courseCode" | "createdAt" | "attemptCount">) => request<T.Quiz>("/quizzes", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<Omit<T.Quiz, "id" | "courseId" | "courseCode" | "createdAt">>) =>
    request<T.Quiz>(`/quizzes/${id}`, { method: "PATCH", body: b }),
  delete: (id: T.ID) => request<void>(`/quizzes/${id}`, { method: "DELETE" }),

  banks: (courseId: T.ID) => request<T.QuestionBank[]>(`/courses/${courseId}/question-banks`),
  createBank: (courseId: T.ID, name: string) =>
    request<T.QuestionBank>(`/courses/${courseId}/question-banks`, { method: "POST", body: { name } }),
  questions: (bankId: T.ID) => request<T.Question[]>(`/question-banks/${bankId}/questions`),
  createQuestion: (bankId: T.ID, b: Omit<T.Question, "id" | "bankId">) =>
    request<T.Question>(`/question-banks/${bankId}/questions`, { method: "POST", body: b }),
  updateQuestion: (id: T.ID, b: Partial<Omit<T.Question, "id" | "bankId">>) =>
    request<T.Question>(`/questions/${id}`, { method: "PATCH", body: b }),
  deleteQuestion: (id: T.ID) => request<void>(`/questions/${id}`, { method: "DELETE" }),

  /* student */
  myAttempts: (id: T.ID) => request<T.QuizAttempt[]>(`/quizzes/${id}/attempts/mine`),
  start: (id: T.ID) => request<T.QuizAttempt>(`/quizzes/${id}/attempts`, { method: "POST" }),
  attempt: (attemptId: T.ID) => request<T.QuizAttempt>(`/quiz-attempts/${attemptId}`),
  /** Autosave a single answer. */
  answer: (attemptId: T.ID, questionId: T.ID, answer: T.QuizAnswer) =>
    request<void>(`/quiz-attempts/${attemptId}/answers/${questionId}`, { method: "PUT", body: answer }),
  submit: (attemptId: T.ID) => request<T.QuizAttempt>(`/quiz-attempts/${attemptId}/submit`, { method: "POST" }),

  /* staff */
  attempts: (id: T.ID) => request<T.QuizAttempt[]>(`/quizzes/${id}/attempts`),
  /** Manual marking queue (essay / short answer). */
  markingQueue: (id: T.ID) => request<T.QuizAttempt[]>(`/quizzes/${id}/marking-queue`),
  markAnswer: (attemptId: T.ID, questionId: T.ID, b: { awarded: number }) =>
    request<T.QuizAttempt>(`/quiz-attempts/${attemptId}/marks/${questionId}`, { method: "PUT", body: b }),
};

/* ── Gradebook ────────────────────────────────────────── */
export const grades = {
  gradebook: (courseId: T.ID) => request<T.Gradebook>(`/courses/${courseId}/gradebook`),
  addManualItem: (courseId: T.ID, b: Pick<T.GradebookItem, "title" | "maxScore" | "weightPercent">) =>
    request<T.GradebookItem>(`/courses/${courseId}/gradebook/items`, { method: "POST", body: b }),
  setCell: (courseId: T.ID, b: { itemId: T.ID; userId: T.ID; score: number | null; reason: string }) =>
    request<T.GradeCell>(`/courses/${courseId}/gradebook/cells`, { method: "PUT", body: b }),
  releaseItem: (courseId: T.ID, itemId: T.ID, released: boolean) =>
    request<T.GradebookItem>(`/courses/${courseId}/gradebook/items/${itemId}/release`, { method: "POST", body: { released } }),
  history: (courseId: T.ID) => request<T.GradeChange[]>(`/courses/${courseId}/gradebook/history`),
  exportXlsxUrl: (base: string, courseId: T.ID) => `${base}/courses/${courseId}/gradebook.xlsx`,
  mine: () => request<T.StudentGradeRow[]>("/me/grades"),
};

/* ── Forum ────────────────────────────────────────────── */
export const forum = {
  categories: (courseId?: T.ID) => request<T.ForumCategory[]>("/forum/categories", { query: q({ courseId }) }),
  createCategory: (b: Pick<T.ForumCategory, "courseId" | "name" | "description">) =>
    request<T.ForumCategory>("/forum/categories", { method: "POST", body: b }),
  threads: (p: T.ListQuery & { courseId?: T.ID; categoryId?: T.ID; unitId?: T.ID; sort?: "recent" | "top" | "unanswered" } = {}) =>
    request<T.Paginated<T.ForumThread>>("/forum/threads", { query: q(p) }),
  thread: (id: T.ID) => request<{ thread: T.ForumThread; posts: T.ForumPost[] }>(`/forum/threads/${id}`),
  createThread: (b: { categoryId: T.ID; title: string; bodyHtml: string; unitId?: T.ID; isAnonymous?: boolean; tags?: string[] }) =>
    request<T.ForumThread>("/forum/threads", { method: "POST", body: b }),
  reply: (threadId: T.ID, b: { bodyHtml: string; parentId?: T.ID | null }) =>
    request<T.ForumPost>(`/forum/threads/${threadId}/posts`, { method: "POST", body: b }),
  editPost: (postId: T.ID, bodyHtml: string) => request<T.ForumPost>(`/forum/posts/${postId}`, { method: "PATCH", body: { bodyHtml } }),
  upvoteThread: (id: T.ID) => request<T.ForumThread>(`/forum/threads/${id}/upvote`, { method: "POST" }),
  upvotePost: (id: T.ID) => request<T.ForumPost>(`/forum/posts/${id}/upvote`, { method: "POST" }),
  subscribe: (id: T.ID, subscribed: boolean) =>
    request<T.ForumThread>(`/forum/threads/${id}/subscribe`, { method: "POST", body: { subscribed } }),
  report: (b: { targetType: "thread" | "post"; targetId: T.ID; reason: string }) =>
    request<void>("/forum/reports", { method: "POST", body: b }),
  acceptAnswer: (threadId: T.ID, postId: T.ID) =>
    request<T.ForumThread>(`/forum/threads/${threadId}/accept`, { method: "POST", body: { postId } }),
  /* moderation */
  moderateThread: (id: T.ID, b: Partial<Pick<T.ForumThread, "isPinned" | "isLocked" | "isResolved">>) =>
    request<T.ForumThread>(`/forum/threads/${id}/moderate`, { method: "POST", body: b }),
  hidePost: (id: T.ID, hidden: boolean) => request<T.ForumPost>(`/forum/posts/${id}/hide`, { method: "POST", body: { hidden } }),
  deleteThread: (id: T.ID) => request<void>(`/forum/threads/${id}`, { method: "DELETE" }),
  reports: (status: T.ForumReport["status"] = "open") => request<T.ForumReport[]>("/forum/reports", { query: q({ status }) }),
  resolveReport: (id: T.ID, status: "dismissed" | "actioned") =>
    request<T.ForumReport>(`/forum/reports/${id}`, { method: "PATCH", body: { status } }),
};

/* ── Announcements & notifications ────────────────────── */
export const announcements = {
  list: (p: { courseId?: T.ID } = {}) => request<T.Announcement[]>("/announcements", { query: q(p) }),
  create: (b: Pick<T.Announcement, "courseId" | "title" | "bodyHtml" | "sendEmail" | "isPinned">) =>
    request<T.Announcement>("/announcements", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<Pick<T.Announcement, "title" | "bodyHtml" | "isPinned">>) =>
    request<T.Announcement>(`/announcements/${id}`, { method: "PATCH", body: b }),
  delete: (id: T.ID) => request<void>(`/announcements/${id}`, { method: "DELETE" }),
  markRead: (id: T.ID) => request<void>(`/announcements/${id}/read`, { method: "POST" }),
};

export const notifications = {
  list: () => request<T.AppNotification[]>("/me/notifications"),
  markRead: (id: T.ID) => request<void>(`/me/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<void>("/me/notifications/read-all", { method: "POST" }),
};

/* ── People & roles ───────────────────────────────────── */
export const people = {
  list: (
    p: T.ListQuery & {
      role?: T.RoleKey;
      status?: T.AccountStatus;
      /** Students only: LMS invite state (invited = sent or not sent yet) */
      lmsInvite?: "invited" | "active" | "expired";
      /** Students only: Teams guest invite state */
      teamsGuest?: "invited" | "accepted" | "expired";
    } = {},
  ) => request<T.Paginated<T.User>>("/users", { query: q(p) }),
  get: (id: T.ID) => request<T.User>(`/users/${id}`),
  create: (b: Pick<T.User, "fullName" | "email" | "matricNumber" | "staffId" | "department" | "level"> & { roles: Omit<T.RoleAssignment, "id" | "scopeName">[] }) =>
    request<T.User>("/users", { method: "POST", body: b }),
  update: (id: T.ID, b: Partial<Pick<T.User, "fullName" | "phone" | "department" | "level" | "status">>) =>
    request<T.User>(`/users/${id}`, { method: "PATCH", body: b }),
  /** Deactivating blocks LMS sign-in and removes the Teams guest account. */
  deleteUnused: (id: T.ID) => request<void>(`/users/${id}`, { method: "DELETE" }),
  deactivate: (id: T.ID) => request<T.User>(`/users/${id}/deactivate`, { method: "POST" }),
  reactivate: (id: T.ID) => request<T.User>(`/users/${id}/reactivate`, { method: "POST" }),
  assignRole: (id: T.ID, b: Omit<T.RoleAssignment, "id" | "scopeName">) =>
    request<T.User>(`/users/${id}/roles`, { method: "POST", body: b }),
  removeRole: (id: T.ID, roleAssignmentId: T.ID) => request<T.User>(`/users/${id}/roles/${roleAssignmentId}`, { method: "DELETE" }),
  /** Students: resend the LMS set-password email and/or the Teams guest invitation. */
  resendInvites: (id: T.ID, b: { lms?: boolean; teams?: boolean }) => request<T.User>(`/users/${id}/invites/resend`, { method: "POST", body: b }),
  /** Admin-issued password reset email for a student. */
  sendPasswordReset: (id: T.ID) => request<void>(`/users/${id}/password-reset`, { method: "POST" }),
  rolePermissions: () => request<Record<T.RoleKey, T.Permission[]>>("/roles/permissions"),

  /**
   * CSV import: preview first (validates, no writes), then commit.
   * Students: creates LMS accounts, emails a set-password invitation and sends a Teams guest invitation.
   */
  importPreview: (kind: "students" | "staff", file: File, courseId?: T.ID) => {
    const fd = new FormData();
    fd.append("kind", kind);
    if (courseId) fd.append("courseId", courseId);
    fd.append("file", file);
    return request<T.ImportPreview>("/imports/preview", { method: "POST", body: fd });
  },
  importCommit: (importId: T.ID) => request<T.ImportResult>(`/imports/${importId}/commit`, { method: "POST" }),
};

/* ── Reports, audit, integrations, settings ───────────── */
export const reports = {
  course: (courseId: T.ID) => request<T.CourseReport>(`/reports/courses/${courseId}`),
  exportCsvUrl: (base: string, courseId: T.ID) => `${base}/reports/courses/${courseId}.csv`,
};

export const audit = {
  list: (p: T.ListQuery & { action?: string; actorId?: T.ID } = {}) => request<T.Paginated<T.AuditEntry>>("/audit", { query: q(p) }),
};

export const integrations = {
  health: () => request<T.IntegrationHealth>("/integrations/health"),
  runCheck: () => request<T.IntegrationHealth>("/integrations/health/run", { method: "POST" }),
};

export const settings = {
  get: () => request<T.PlatformSettings>("/settings"),
  update: (b: Partial<T.PlatformSettings>) => request<T.PlatformSettings>("/settings", { method: "PATCH", body: b }),
};

/* ── Search ───────────────────────────────────────────── */
export interface SearchHit {
  type: "course" | "unit" | "recording" | "thread" | "assignment" | "quiz";
  id: T.ID;
  title: string;
  subtitle?: string;
  link: string;
}
export const search = {
  query: (term: string) => request<SearchHit[]>("/search", { query: { q: term } }),
};
