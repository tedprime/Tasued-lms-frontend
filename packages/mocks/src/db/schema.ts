import type * as T from "@tasued/api-client";

type ID = T.ID;
type ISODate = T.ISODate;

/** Stored rows. Derived fields (counts, names, statuses) are computed in ./views on read. */
export type UserRow = T.User;

/** Course → Modules → Units. Holds its staff, Teams class code prefix and status. */
export interface CourseRow {
  id: ID;
  code: string;
  title: string;
  description: string;
  creditUnits?: number;
  level?: number;
  coverImageUrl?: string;
  status: T.CourseStatus;
  lecturerIds: ID[];
  assistantIds: ID[];
  classCodePrefix: string;
  createdAt: ISODate;
}

export type EnrolmentRow = Omit<T.Enrolment, "user">;
export type ModuleRow = Omit<T.Module, "units">;

export interface UnitRow {
  id: ID;
  moduleId: ID;
  courseId: ID;
  title: string;
  order: number;
  state: T.PublishState;
  estimatedReadMinutes: number;
  objectives: string[];
  courseTextHtml: string;
  courseTextJson?: string;
  attachments: T.Attachment[];
  updatedAt: ISODate;
}

export interface ProgressRow extends T.UnitProgress {
  userId: ID;
}

export interface ClassRow {
  id: ID;
  courseId: ID;
  title: string;
  classCode: string;
  seq: number;
  startsAt: ISODate;
  endsAt: ISODate;
  cancelled: boolean;
  cancelReason?: string;
  unitIds: ID[];
  lecturerId: ID;
  teamsJoinUrl: string;
  teamsMeetingId: string;
  autoRecord: boolean;
  seriesId?: ID;
  /** Set once the "class ended → look for the recording in OneDrive" step has been triggered. */
  recordingTriggered: boolean;
}

export interface RecordingRow extends T.Recording {
  /** When set (and status pending), the recording becomes ready RECORDING_LOOKUP_AFTER_MS after this (evaluated on read). */
  pipelineStartedAt?: ISODate;
  views: number;
  avgWatchPercent: number;
}

export interface PositionRow extends T.PlaybackPosition {
  userId: ID;
}

export type SheetRow = Omit<T.AttendanceSheet, "classSession">;

export type AssignmentRow = Omit<T.Assignment, "courseCode" | "submissionCount" | "gradedCount">;
export type SubmissionRow = Omit<T.Submission, "studentName" | "matricNumber" | "extensionDueAt">;
export type ExtensionRow = T.Extension;

export type BankRow = Omit<T.QuestionBank, "questionCount">;
export type QuestionRow = T.Question;
export type QuizRow = Omit<T.Quiz, "courseCode" | "attemptCount">;

export interface AttemptQuestionRow {
  questionId: ID;
  /** option ids in display order (shuffled if the quiz shuffles options) */
  optionOrder: ID[];
  answer?: T.QuizAnswer;
  /** null => awaiting manual marking (or not yet marked) */
  awarded: number | null;
  correct: boolean | null;
}

export interface AttemptRow {
  id: ID;
  quizId: ID;
  userId: ID;
  state: T.AttemptState;
  startedAt: ISODate;
  deadlineAt: ISODate;
  submittedAt?: ISODate;
  questions: AttemptQuestionRow[];
}

export type GradeItemRow = T.GradebookItem;
export interface GradeCellRow {
  itemId: ID;
  userId: ID;
  score: number | null;
}
export interface GradeChangeRow extends T.GradeChange {
  courseId: ID;
}

export interface CategoryRow {
  id: ID;
  courseId: ID | null;
  name: string;
  description?: string;
}

export interface ThreadRow {
  id: ID;
  categoryId: ID;
  courseId: ID | null;
  unitId?: ID;
  title: string;
  bodyHtml: string;
  authorId: ID;
  createdAt: ISODate;
  lastActivityAt: ISODate;
  upvoterIds: ID[];
  subscriberIds: ID[];
  isPinned: boolean;
  isLocked: boolean;
  isResolved: boolean;
  isAnonymous: boolean;
  tags: string[];
}

export interface PostRow {
  id: ID;
  threadId: ID;
  parentId: ID | null;
  bodyHtml: string;
  authorId: ID;
  createdAt: ISODate;
  editedAt?: ISODate;
  upvoterIds: ID[];
  isAcceptedAnswer: boolean;
  isHidden: boolean;
}

export interface ReportRow extends T.ForumReport {
  reporterId: ID;
}

export interface AnnouncementRow {
  id: ID;
  courseId: ID | null;
  title: string;
  bodyHtml: string;
  authorId: ID;
  publishedAt: ISODate;
  sendEmail: boolean;
  isPinned: boolean;
  readBy: ID[];
}

export interface NotificationRow extends T.AppNotification {
  userId: ID;
}

export interface ImportRowData extends T.ImportRowResult {
  level?: number;
  department?: string;
  existingUserId?: ID;
}

export interface ImportJob {
  id: ID;
  kind: "students" | "staff";
  courseId?: ID;
  rows: ImportRowData[];
  committed: boolean;
  createdAt: ISODate;
}

/** Mock-only credentials, kept apart from UserRow so they never leak through userView. */
export interface CredentialRow {
  /** see lib/password.ts — SHA-256, mock only */
  passwordHash: string;
  /** set by an admin-issued temporary password; the app forces a change */
  mustChangePassword: boolean;
  updatedAt: ISODate;
}

/** One-time links emailed to students: LMS invitation (set password) or password reset. */
export interface AuthTokenRow {
  token: string;
  kind: "invite" | "reset";
  userId: ID;
  createdAt: ISODate;
  expiresAt: ISODate;
  usedAt?: ISODate;
}

export interface DB {
  version: number;
  seededAt: ISODate;
  users: UserRow[];
  credentials: Record<ID, CredentialRow>;
  authTokens: AuthTokenRow[];
  preferences: Record<ID, T.UserPreferences>;
  courses: CourseRow[];
  enrolments: EnrolmentRow[];
  modules: ModuleRow[];
  units: UnitRow[];
  progress: ProgressRow[];
  classes: ClassRow[];
  recordings: RecordingRow[];
  positions: PositionRow[];
  sheets: SheetRow[];
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
  extensions: ExtensionRow[];
  banks: BankRow[];
  questions: QuestionRow[];
  quizzes: QuizRow[];
  attempts: AttemptRow[];
  gradeItems: GradeItemRow[];
  gradeCells: GradeCellRow[];
  gradeChanges: GradeChangeRow[];
  categories: CategoryRow[];
  threads: ThreadRow[];
  posts: PostRow[];
  reports: ReportRow[];
  announcements: AnnouncementRow[];
  notifications: NotificationRow[];
  audit: T.AuditEntry[];
  health: T.IntegrationHealth;
  settings: T.PlatformSettings;
  imports: ImportJob[];
}

export const DEFAULT_PREFERENCES: T.UserPreferences = {
  lowDataMode: false,
  emailNotifications: true,
  playbackSpeed: 1,
};

export const DB_VERSION = 6;
