import type * as T from "@tasued/api-client";
import { isStaffFor, type Viewer } from "../../lib/auth";
import type { AnnouncementRow, DB, PostRow, ThreadRow } from "../schema";

export function roleLabelFor(db: DB, userId: string, courseId: string | null): T.ForumAuthor["roleLabel"] {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return undefined;
  const o = courseId ? db.courses.find((x) => x.id === courseId) : undefined;
  if (o?.lecturerIds.includes(userId)) return "Lecturer";
  if (o?.assistantIds.includes(userId)) return "TA";
  if (u.roles.some((r) => r.role === "super_admin")) return "Admin";
  if (u.roles.some((r) => r.role === "lecturer")) return "Lecturer";
  if (u.roles.some((r) => r.role === "teaching_assistant")) return "TA";
  return "Student";
}

export function authorView(db: DB, userId: string, courseId: string | null): T.ForumAuthor {
  const u = db.users.find((x) => x.id === userId);
  return { id: userId, fullName: u?.fullName ?? "Former user", avatarUrl: u?.avatarUrl, roleLabel: roleLabelFor(db, userId, courseId) };
}

export function canModerate(v: Viewer, courseId: string | null) {
  if (!v.permissions.includes("forum.moderate")) return false;
  return courseId === null ? v.isSuperAdmin || v.isStaff : isStaffFor(v, courseId);
}

export function threadView(db: DB, t: ThreadRow, v: Viewer): T.ForumThread {
  const posts = db.posts.filter((p) => p.threadId === t.id && !p.isHidden);
  const unit = t.unitId ? db.units.find((u) => u.id === t.unitId) : undefined;
  const reports = db.reports.filter((r) => r.threadId === t.id && r.status === "open").length;
  const anonymousForViewer = t.isAnonymous && t.authorId !== v.user.id && !canModerate(v, t.courseId);
  return {
    id: t.id,
    categoryId: t.categoryId,
    courseId: t.courseId,
    unitId: t.unitId,
    unitTitle: unit?.title,
    title: t.title,
    bodyHtml: t.bodyHtml,
    author: anonymousForViewer
      ? { id: "anonymous", fullName: "Anonymous student", roleLabel: "Student" }
      : authorView(db, t.authorId, t.courseId),
    createdAt: t.createdAt,
    lastActivityAt: t.lastActivityAt,
    replyCount: posts.length,
    upvotes: t.upvoterIds.length,
    viewerHasUpvoted: t.upvoterIds.includes(v.user.id),
    isPinned: t.isPinned,
    isLocked: t.isLocked,
    isResolved: t.isResolved,
    isAnonymous: t.isAnonymous,
    reportCount: reports,
    tags: t.tags,
    viewerIsSubscribed: t.subscriberIds.includes(v.user.id),
  };
}

export function postView(db: DB, p: PostRow, v: Viewer, courseId: string | null): T.ForumPost {
  return {
    id: p.id,
    threadId: p.threadId,
    parentId: p.parentId,
    bodyHtml: p.bodyHtml,
    author: authorView(db, p.authorId, courseId),
    createdAt: p.createdAt,
    editedAt: p.editedAt,
    upvotes: p.upvoterIds.length,
    viewerHasUpvoted: p.upvoterIds.includes(v.user.id),
    isAcceptedAnswer: p.isAcceptedAnswer,
    isHidden: p.isHidden,
    reportCount: db.reports.filter((r) => r.targetType === "post" && r.targetId === p.id && r.status === "open").length,
  };
}

export function announcementView(db: DB, a: AnnouncementRow, v: Viewer): T.Announcement {
  const code = a.courseId
    ? db.courses.find((c) => c.id === a.courseId)?.code
    : undefined;
  return {
    id: a.id,
    courseId: a.courseId,
    courseCode: code,
    title: a.title,
    bodyHtml: a.bodyHtml,
    author: authorView(db, a.authorId, a.courseId),
    publishedAt: a.publishedAt,
    sendEmail: a.sendEmail,
    isPinned: a.isPinned,
    readByViewer: a.readBy.includes(v.user.id),
  };
}
