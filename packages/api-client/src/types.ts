/**
 * TASFUED LMS — shared API contract (types).
 * Mirrors the NestJS OpenAPI contract. Both apps and the mock layer build against these.
 * Dates are ISO 8601 strings. Ids are opaque strings.
 */

export type ID = string;
export type ISODate = string;

/* ───────────────────────── Common ───────────────────────── */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

/* ───────────────────────── Identity & RBAC ───────────────────────── */

/**
 * Roles. Super admins run the whole platform; lecturers and teaching assistants are
 * assigned to specific courses (scope "course"). Students only use the student app.
 */
export type RoleKey = "super_admin" | "lecturer" | "teaching_assistant" | "student";

export type ScopeType = "global" | "course";

export interface RoleAssignment {
  id: ID;
  role: RoleKey;
  scopeType: ScopeType;
  /** null when scopeType is "global" */
  scopeId: ID | null;
  scopeName?: string;
}

export type Permission =
  | "courses.manage"
  | "people.manage"
  | "people.import"
  | "roles.manage"
  | "content.edit"
  | "content.publish"
  | "classes.schedule"
  | "recordings.manage"
  | "attendance.manage"
  | "attendance.finalise"
  | "assignments.manage"
  | "assignments.grade"
  | "quizzes.manage"
  | "quizzes.grade"
  | "grades.release"
  | "forum.moderate"
  | "announcements.send"
  | "reports.view"
  | "audit.view"
  | "integrations.view"
  | "settings.manage";

export type AccountStatus = "active" | "invited" | "suspended" | "deactivated";

/**
 * Students are invited by email: (1) an LMS invitation to set a platform password and
 * (2) a Microsoft Teams guest invitation to our tenant so they can join classes.
 */
export type InviteStatus = "not_sent" | "sent" | "accepted" | "expired" | 'queued' | 'retrying' | 'failed';

export interface User {
  id: ID;
  fullName: string;
  /** Students: the email TASFUED supplied (also their Teams guest identity). Staff: Microsoft 365 address. */
  email: string;
  matricNumber?: string; // students
  staffId?: string; // staff
  avatarUrl?: string;
  phone?: string;
  /** Students: department and level as supplied in TASFUED's list (plain details, nothing to manage). */
  department?: string;
  level?: number; // 100, 200 ...
  status: AccountStatus;
  /** How this person signs in to the LMS. Students use a platform password; staff use Microsoft. */
  authMethod: "password" | "microsoft";
  /** Students: has the LMS invitation been accepted (password set)? */
  lmsInvite?: { status: InviteStatus; sentAt?: ISODate; acceptedAt?: ISODate };
  /** Students: Teams guest invitation to our Microsoft 365 tenant. */
  teamsGuest?: { status: InviteStatus; sentAt?: ISODate; acceptedAt?: ISODate };
  roles: RoleAssignment[];
  createdAt: ISODate;
  lastSeenAt?: ISODate;
}

export interface Session {
  user: User;
  /** True after signing in with a temporary/admin-reset password: the app must force a password change. */
  mustChangePassword: boolean;
  permissions: Permission[];
  /** Course ids the user can see as staff (super admins: every course, read-only unless they also teach it). */
  staffCourseIds: ID[];
  /** Course ids the user lectures or assists on — teaching tools (content, classes, grading…) apply only here. */
  teachingCourseIds: ID[];
  preferences: UserPreferences;
}

export interface UserPreferences {
  lowDataMode: boolean;
  emailNotifications: boolean;
  playbackSpeed: number;
}

/* ───────────────────────── Courses ───────────────────────── */

export type CourseStatus = "draft" | "published" | "archived";

/**
 * A course (e.g. AIIE 111) with its staff, students and content: Course → Modules → Units.
 * There are no faculties, departments, sessions, semesters or offerings.
 */
export interface Course {
  teamsSync?: {
    status: 'pending' | 'synced' | 'error';
    message?: string;
    lastSyncedAt?: string;
  };
  id: ID;
  code: string; // "AIIE 111"
  title: string;
  description: string;
  creditUnits?: number;
  level?: number;
  coverImageUrl?: string;
  status: CourseStatus;
  lecturers: Pick<User, "id" | "fullName" | "email" | "avatarUrl">[];
  assistants: Pick<User, "id" | "fullName" | "email" | "avatarUrl">[];
  enrolledCount: number;
  moduleCount: number;
  unitCount: number;
  /** Teams class code prefix used in meeting titles, e.g. "AIIE111" */
  classCodePrefix: string;
  createdAt: ISODate;
}

export interface CourseInput {
  code: string;
  title: string;
  description: string;
  creditUnits?: number;
  level?: number;
  classCodePrefix: string;
  lecturerIds: ID[];
  assistantIds: ID[];
  status?: CourseStatus;
}

export interface Enrolment {
  id: ID;
  courseId: ID;
  userId: ID;
  user?: Pick<User, "id" | "fullName" | "email" | "matricNumber" | "avatarUrl">;
  enrolledAt: ISODate;
  status: "active" | "dropped";
}

/* ───────────────────────── Content ───────────────────────── */

export type PublishState = "draft" | "published";

export interface Module {
  id: ID;
  courseId: ID;
  title: string;
  summary?: string;
  order: number;
  state: PublishState;
  units: UnitSummary[];
}

export interface UnitSummary {
  id: ID;
  moduleId: ID;
  title: string;
  order: number;
  state: PublishState;
  hasRecording: boolean;
  recordingCount: number;
  estimatedReadMinutes: number;
}

export interface Attachment {
  id: ID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  scanStatus: "pending" | "clean" | "infected" | "skipped";
}

/** Full unit page payload. Recording(s) first, course text underneath. */
export interface Unit extends UnitSummary {
  courseId: ID;
  objectives: string[];
  /** Course text (manual reading), stored as rich-text HTML rendered from the editor's JSON. */
  courseTextHtml: string;
  /** Editor state (Lexical JSON) for the admin editor. */
  courseTextJson?: string;
  attachments: Attachment[];
  recordings: Recording[];
  updatedAt: ISODate;
}

export interface UnitProgress {
  unitId: ID;
  readPercent: number; // 0-100
  watchedSeconds: number;
  completed: boolean;
  lastVisitedAt?: ISODate;
}

/* ───────────────────────── Live classes & recordings ───────────────────────── */

export type ClassSessionStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface ClassSession {
  id: ID;
  courseId: ID;
  courseCode: string;
  courseTitle: string;
  title: string;
  /** Unique class code placed in the Teams meeting title, e.g. "AIIE111-S07" */
  classCode: string;
  startsAt: ISODate;
  endsAt: ISODate;
  status: ClassSessionStatus;
  /** Units this class covers; the recording publishes under these. */
  unitIds: ID[];
  unitTitles: string[];
  moduleIds: ID[];
  lecturerId: ID;
  lecturerName: string;
  teamsJoinUrl: string;
  teamsMeetingId: string;
  autoRecord: boolean;
  /** Recurrence series id when created as part of a series */
  seriesId?: ID;
  recordingStatus: RecordingStatus | "none";
  attendanceStatus: AttendanceSheetStatus | "not_started";
}

export interface ClassSeriesInput {
  courseId: ID;
  title: string;
  firstStartsAt: ISODate;
  durationMinutes: number;
  /** weekly recurrence */
  weekdays: number[]; // 0=Sun..6=Sat
  occurrences: number; // e.g. 13
  unitIds: ID[];
  lecturerId: ID;
  autoRecord: boolean;
}

export interface ClassSessionInput {
  courseId: ID;
  title: string;
  startsAt: ISODate;
  endsAt: ISODate;
  unitIds: ID[];
  lecturerId: ID;
  autoRecord: boolean;
}

/**
 * Recordings are NOT copied or transcoded. The MP4 stays in the organiser's OneDrive and is
 * streamed to students through short-lived links the API issues after checking access.
 *  pending — class ended, waiting for Teams to save the recording to OneDrive
 *  ready   — file found in OneDrive and linked to the class
 *  failed  — file not found / moved / deleted (lecturer can upload the file instead)
 */
export type RecordingStatus = "pending" | "ready" | "failed";
/** lecturer_upload: lecturer uploaded the MP4 through the LMS; the API stores it in the organiser's OneDrive. */
export type RecordingSource = "teams_onedrive" | "lecturer_upload";

export interface OneDriveFileRef {
  driveId: ID;
  itemId: ID;
  fileName: string;
  /** Organiser account whose OneDrive holds the file */
  ownerEmail: string;
  /** Staff-only link to open the file in OneDrive */
  webUrl?: string;
}

/** Issued per play request. Pre-authenticated, expires within minutes — the player re-requests on expiry. */
export interface PlaybackLink {
  url: string;
  mimeType: string; // "video/mp4"
  expiresAt: ISODate;
}

export interface Chapter {
  id: ID;
  title: string;
  startSeconds: number;
}

export interface Recording {
  id: ID;
  classSessionId?: ID;
  courseId: ID;
  title: string;
  recordedAt: ISODate;
  durationSeconds: number;
  status: RecordingStatus;
  source: RecordingSource;
  failureReason?: string;
  /** Where the file lives. Present when status is "ready". */
  oneDrive?: OneDriveFileRef;
  posterUrl?: string;
  sizeBytes?: number;
  unitIds: ID[];
  chapters: Chapter[];
  published: boolean;
  createdAt: ISODate;
}

export interface PlaybackPosition {
  recordingId: ID;
  positionSeconds: number;
  updatedAt: ISODate;
}

/* ───────────────────────── Attendance ───────────────────────── */

export type AttendanceMark = "present" | "late" | "absent" | "excused";
export type AttendanceSheetStatus = "pending_import" | "imported" | "in_review" | "finalised";

export interface AttendanceRule {
  /** minimum % of class time attended to count as present */
  presentThresholdPercent: number;
  /** joined later than this many minutes after start => late */
  lateAfterMinutes: number;
}

export interface AttendanceRecord {
  id: ID;
  classSessionId: ID;
  userId: ID;
  studentName: string;
  matricNumber?: string;
  mark: AttendanceMark;
  minutesAttended: number;
  joinedAt?: ISODate;
  leftAt?: ISODate;
  source: "teams" | "manual";
  note?: string;
}

export interface AttendanceSheet {
  classSessionId: ID;
  classSession: ClassSession;
  status: AttendanceSheetStatus;
  mode: "teams" | "manual";
  rule: AttendanceRule;
  records: AttendanceRecord[];
  /** Teams participants that couldn't be matched to an enrolled student */
  unmatched: { displayName: string; email?: string; minutesAttended: number }[];
  importedAt?: ISODate;
  finalisedAt?: ISODate;
  finalisedBy?: string;
}

export interface StudentAttendanceSummary {
  courseId: ID;
  courseCode: string;
  courseTitle: string;
  totalClasses: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  percent: number;
  records: (Pick<AttendanceRecord, "mark" | "minutesAttended"> & {
    classSessionId: ID;
    title: string;
    startsAt: ISODate;
  })[];
}

/* ───────────────────────── Assignments (single, strictly final submission) ───────────────────────── */

export type LatePolicy = "not_accepted" | "accepted_with_penalty" | "accepted_no_penalty";

export interface Assignment {
  id: ID;
  courseId: ID;
  courseCode: string;
  title: string;
  instructionsHtml: string;
  attachments: Attachment[];
  unitIds: ID[];
  opensAt: ISODate;
  dueAt: ISODate;
  /** Hard close for late submissions (when late accepted) */
  closesAt?: ISODate;
  latePolicy: LatePolicy;
  latePenaltyPercentPerDay?: number;
  maxScore: number;
  weightPercent: number;
  allowText: boolean;
  allowFiles: boolean;
  allowedFileTypes: string[]; // ["pdf","docx"]
  maxFileSizeMb: number;
  state: PublishState;
  submissionCount?: number;
  gradedCount?: number;
  createdAt: ISODate;
}

export type SubmissionState = "not_started" | "draft" | "submitted";

/**
 * A submission is FINAL once state === "submitted". There is no update or reopen path —
 * the API rejects any write after submission with 409 SUBMISSION_FINAL.
 */
export interface Submission {
  id: ID;
  assignmentId: ID;
  userId: ID;
  studentName?: string;
  matricNumber?: string;
  state: SubmissionState;
  textHtml?: string;
  files: Attachment[];
  submittedAt?: ISODate;
  isLate: boolean;
  /** Receipt shown and emailed after final submission */
  receiptCode?: string;
  extensionDueAt?: ISODate;
  grade?: SubmissionGrade;
}

export interface SubmissionGrade {
  score: number;
  maxScore: number;
  latePenaltyApplied: number;
  feedbackHtml?: string;
  gradedBy: string;
  gradedAt: ISODate;
  released: boolean;
}

export interface Extension {
  id: ID;
  assignmentId: ID;
  userId: ID;
  studentName: string;
  newDueAt: ISODate;
  reason: string;
  grantedBy: string;
  grantedAt: ISODate;
}

/* ───────────────────────── Quizzes (separate from assignments) ───────────────────────── */

export type QuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay";

export interface QuestionOption {
  id: ID;
  text: string;
  isCorrect?: boolean; // staff only
}

export interface Question {
  id: ID;
  bankId: ID;
  type: QuestionType;
  promptHtml: string;
  options: QuestionOption[];
  /** For short_answer auto-marking (case-insensitive) */
  acceptedAnswers?: string[];
  points: number;
  explanation?: string;
  tags: string[];
}

export interface QuestionBank {
  id: ID;
  courseId: ID;
  name: string;
  questionCount: number;
}

export interface Quiz {
  id: ID;
  courseId: ID;
  courseCode: string;
  title: string;
  descriptionHtml: string;
  unitIds: ID[];
  /** Draw `drawCount` random questions from these banks */
  bankIds: ID[];
  drawCount: number;
  timeLimitMinutes: number;
  attemptsAllowed: number;
  opensAt: ISODate;
  closesAt: ISODate;
  shuffleOptions: boolean;
  showResults: "immediately" | "after_close" | "manual";
  maxScore: number;
  weightPercent: number;
  state: PublishState;
  attemptCount?: number;
  createdAt: ISODate;
}

export type AttemptState = "in_progress" | "submitted" | "auto_submitted" | "marked";

export interface QuizAttemptQuestion {
  questionId: ID;
  type: QuestionType;
  promptHtml: string;
  options: Pick<QuestionOption, "id" | "text">[];
  points: number;
  answer?: QuizAnswer;
  /** present after results are visible */
  result?: { awarded: number; correct: boolean | null; correctOptionIds?: ID[]; explanation?: string };
}

export interface QuizAnswer {
  optionIds?: ID[];
  text?: string;
}

export interface QuizAttempt {
  id: ID;
  quizId: ID;
  userId: ID;
  studentName?: string;
  state: AttemptState;
  startedAt: ISODate;
  /** Server-authoritative deadline; client timer counts down to this */
  deadlineAt: ISODate;
  submittedAt?: ISODate;
  questions: QuizAttemptQuestion[];
  score?: number;
  maxScore: number;
  /** essay / short answers awaiting manual marking */
  pendingManualMarks: number;
}

/* ───────────────────────── Gradebook ───────────────────────── */

export interface GradebookItem {
  id: ID;
  courseId: ID;
  kind: "assignment" | "quiz" | "manual";
  refId?: ID;
  title: string;
  maxScore: number;
  weightPercent: number;
  released: boolean;
}

export interface GradeCell {
  itemId: ID;
  userId: ID;
  score: number | null;
  released: boolean;
}

export interface Gradebook {
  courseId: ID;
  items: GradebookItem[];
  students: Pick<User, "id" | "fullName" | "matricNumber">[];
  cells: GradeCell[];
}

export interface GradeChange {
  id: ID;
  itemId: ID;
  userId: ID;
  from: number | null;
  to: number | null;
  reason: string;
  changedBy: string;
  changedAt: ISODate;
}

export interface StudentGradeRow {
  courseId: ID;
  courseCode: string;
  courseTitle: string;
  items: { itemId: ID; title: string; kind: GradebookItem["kind"]; score: number | null; maxScore: number; weightPercent: number }[];
  /** weighted total over released items, 0-100 */
  runningTotalPercent: number | null;
}

/* ───────────────────────── Forum ───────────────────────── */

export interface ForumCategory {
  id: ID;
  courseId: ID | null; // null => General forum (not tied to a course)
  name: string;
  description?: string;
  threadCount: number;
}

export interface ForumAuthor {
  id: ID;
  fullName: string;
  avatarUrl?: string;
  roleLabel?: "Lecturer" | "TA" | "Admin" | "Student";
}

export interface ForumThread {
  id: ID;
  categoryId: ID;
  courseId: ID | null;
  unitId?: ID;
  unitTitle?: string;
  title: string;
  bodyHtml: string;
  author: ForumAuthor;
  createdAt: ISODate;
  lastActivityAt: ISODate;
  replyCount: number;
  upvotes: number;
  viewerHasUpvoted?: boolean;
  isPinned: boolean;
  isLocked: boolean;
  isResolved: boolean;
  isAnonymous: boolean;
  reportCount: number;
  tags: string[];
  viewerIsSubscribed?: boolean;
}

export interface ForumPost {
  id: ID;
  threadId: ID;
  parentId: ID | null;
  bodyHtml: string;
  author: ForumAuthor;
  createdAt: ISODate;
  editedAt?: ISODate;
  upvotes: number;
  viewerHasUpvoted?: boolean;
  isAcceptedAnswer: boolean;
  isHidden: boolean;
  reportCount: number;
}

export interface ForumReport {
  id: ID;
  targetType: "thread" | "post";
  targetId: ID;
  threadId: ID;
  threadTitle: string;
  excerpt: string;
  reason: string;
  reportedBy: string;
  reportedAt: ISODate;
  status: "open" | "dismissed" | "actioned";
}

/* ───────────────────────── Announcements & notifications ───────────────────────── */

export interface Announcement {
  id: ID;
  /** null => all students */
  courseId: ID | null;
  courseCode?: string;
  title: string;
  bodyHtml: string;
  author: ForumAuthor;
  publishedAt: ISODate;
  sendEmail: boolean;
  isPinned: boolean;
  readByViewer?: boolean;
}

export type NotificationKind =
  | "recording_ready"
  | "class_reminder"
  | "class_changed"
  | "assignment_published"
  | "assignment_due_soon"
  | "submission_receipt"
  | "grade_released"
  | "quiz_open"
  | "forum_reply"
  | "announcement";

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  /** in-app route to open */
  link: string;
  createdAt: ISODate;
  read: boolean;
}

/* ───────────────────────── Dashboards ───────────────────────── */

export interface StudentDashboard {
  upcomingClasses: ClassSession[];
  latestRecordings: (Recording & { courseCode: string; unitTitle?: string; unitId?: ID })[];
  dueSoon: (Pick<Assignment, "id" | "title" | "dueAt" | "courseCode" | "courseId"> & { submissionState: SubmissionState })[];
  openQuizzes: Pick<Quiz, "id" | "title" | "closesAt" | "courseCode" | "courseId">[];
  announcements: Announcement[];
  continueLearning: { courseId: ID; courseCode: string; unitId: ID; unitTitle: string; readPercent: number }[];
  attendancePercent: number | null;
}

export interface AdminDashboard {
  counts: { students: number; staff: number; courses: number; classesThisWeek: number };
  todayClasses: ClassSession[];
  recordingQueue: { pending: number; failed: number; readyThisWeek: number };
  /** Students who haven't finished onboarding */
  invitations: { lmsPending: number; teamsPending: number; expired: number };
  attendanceToReview: ClassSession[];
  submissionsToGrade: { assignmentId: ID; title: string; courseCode: string; ungraded: number }[];
  openReports: number;
  integrationOk: boolean;
}

/* ───────────────────────── People import ───────────────────────── */

export interface ImportRowResult {
  row: number;
  fullName: string;
  email: string;
  matricNumber?: string;
  action: "create" | "update" | "skip" | "error";
  message?: string;
}

export interface ImportPreview {
  importId: ID;
  kind: "students" | "staff";
  rows: ImportRowResult[];
  summary: { create: number; update: number; skip: number; error: number };
}

export interface ImportResult {
  importId: ID;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  /** Students: emails inviting them to set their LMS password */
  lmsInvitesSent: number;
  /** Students: Microsoft Teams guest invitations to our tenant */
  teamsGuestInvitesSent: number;
}

/* ───────────────────────── Reports, audit, integrations ───────────────────────── */

export interface CourseReport {
  courseId: ID;
  courseCode: string;
  courseTitle: string;
  enrolled: number;
  averageAttendancePercent: number;
  recordingViews: number;
  averageWatchPercent: number;
  assignmentSubmissionRate: number;
  quizCompletionRate: number;
  forumThreads: number;
  atRiskStudents: { userId: ID; fullName: string; matricNumber?: string; attendancePercent: number; missingSubmissions: number }[];
  weekly: { weekLabel: string; attendancePercent: number; recordingViews: number }[];
}

export interface AuditEntry {
  id: ID;
  at: ISODate;
  actor: string;
  actorId: ID;
  action: string; // "grade.changed", "submission.finalised", ...
  targetType: string;
  targetId: ID;
  summary: string;
  ip?: string;
}

export type HealthState = "ok" | "degraded" | "down" | "unknown" | "waiting" | "disabled";

export interface IntegrationHealth {
  checkedAt: ISODate;
  overall: HealthState;
  checks: {
    key:
      | "graph_auth"
      | "meeting_creation"
      | "change_notifications"
      | "recording_lookup"
      | "recording_playback"
      | "attendance_import"
      | "guest_invitations"
      | "email_delivery";
    label: string;
    state: HealthState;
    detail: string;
    lastSuccessAt?: ISODate;
  }[];
  subscriptions: { id: ID; resource: string; expiresAt: ISODate; state: HealthState }[];
  recentJobs: { id: ID; type: string; state: "queued" | "running" | "succeeded" | "failed"; at: ISODate; detail?: string }[];
}

export interface PlatformSettings {
  institutionName: string;
  attendanceRule: AttendanceRule;
  defaultLatePolicy: LatePolicy;
  maxUploadMb: number;
  /** Organiser account that owns class meetings, so recordings land in one OneDrive */
  organiserAccountEmail: string;
  minPasswordLength: number;
  supportEmail: string;
}

export interface TeamsSetup {
 status: 'preparing' | 'action_required' | 'connected' | 'unavailable';
 invitationUrl?: string;
 checkedAt?: string;
}

export interface QuestionImportPreview {
  rows: {row: number; prompt: string; type: string; status: 'ready' | 'duplicate' | 'error'; errors: string[]}[];
  readyCount: number;
  duplicateCount: number;
  errorCount: number;
  importedCount: number;
}
