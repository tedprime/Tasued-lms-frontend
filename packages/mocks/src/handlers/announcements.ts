import { activeStudentIds, audit, courseOf, find, notify } from "../db/ops/common";
import type { AnnouncementRow } from "../db/schema";
import { announcementView } from "../db/views/social";
import { asString, readableCourse } from "../lib/access";
import { requirePerm } from "../lib/auth";
import { iso } from "../lib/dates";
import { forbidden, validation } from "../lib/http";
import { newId } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

function requireCanSend(c: Ctx, courseId: string | null) {
  if (courseId === null) {
    requirePerm(c.viewer, "announcements.send");
    if (!c.viewer.isSuperAdmin) throw forbidden("Only administrators can send announcements to all students.");
  } else requirePerm(c.viewer, "announcements.send", courseId);
}

export function registerAnnouncements(r: Router) {
  r.get("/announcements", (c) => {
    const cid = c.q("courseId");
    if (cid) readableCourse(c, cid);
    const scope = c.viewer.isStaff ? c.viewer.staffCourseIds : c.viewer.enrolledCourseIds;
    return c.db.announcements
      .filter((a) => (cid ? a.courseId === cid || a.courseId === null : a.courseId === null || scope.has(a.courseId)))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt))
      .map((a) => announcementView(c.db, a, c.viewer));
  });

  r.post("/announcements", async (c) => {
    const b = await c.json<{ courseId?: string | null; title?: string; bodyHtml?: string; sendEmail?: boolean; isPinned?: boolean }>();
    const courseId = b.courseId || null;
    if (courseId) find(c.db.courses, courseId, "course");
    requireCanSend(c, courseId);
    const title = asString(b.title);
    const body = (b.bodyHtml ?? "").trim();
    const errs: Record<string, string> = {};
    if (!title) errs.title = "Title is required";
    if (!body.replace(/<[^>]+>/g, "").trim()) errs.bodyHtml = "Write your announcement";
    if (Object.keys(errs).length) throw validation(errs);
    const a: AnnouncementRow = { id: newId("ann"), courseId, title, bodyHtml: body, authorId: c.viewer.user.id, publishedAt: iso(c.now), sendEmail: !!b.sendEmail, isPinned: !!b.isPinned, readBy: [c.viewer.user.id] };
    c.db.announcements.push(a);
    const recipients = courseId
      ? activeStudentIds(c.db, courseId)
      : c.db.users.filter((u) => u.roles.some((x) => x.role === "student") && u.status === "active").map((u) => u.id);
    notify(c.db, recipients, { kind: "announcement", title: courseId ? `${courseOf(c.db, courseId).code}: ${title}` : title, body: `${c.viewer.user.fullName} posted an announcement.`, link: "/announcements" }, c.now);
    audit(c.db, c.viewer.user, "announcement.sent", "announcement", a.id, `Sent "${title}" to ${courseId ? courseOf(c.db, courseId).code : "all students"} (${recipients.length} recipients${a.sendEmail ? ", with email" : ""})`);
    return announcementView(c.db, a, c.viewer);
  });

  r.patch("/announcements/:id", async (c) => {
    const a = find(c.db.announcements, c.params.id, "announcement");
    requireCanSend(c, a.courseId);
    const b = await c.json<{ title?: string; bodyHtml?: string; isPinned?: boolean }>();
    if (b.title !== undefined) a.title = asString(b.title) || a.title;
    if (b.bodyHtml !== undefined && b.bodyHtml.trim()) a.bodyHtml = b.bodyHtml.trim();
    if (typeof b.isPinned === "boolean") a.isPinned = b.isPinned;
    return announcementView(c.db, a, c.viewer);
  });

  r.delete("/announcements/:id", (c) => {
    const a = find(c.db.announcements, c.params.id, "announcement");
    requireCanSend(c, a.courseId);
    c.db.announcements = c.db.announcements.filter((x) => x.id !== a.id);
    audit(c.db, c.viewer.user, "announcement.deleted", "announcement", a.id, `Deleted "${a.title}"`);
  });

  r.post("/announcements/:id/read", (c) => {
    const a = find(c.db.announcements, c.params.id, "announcement");
    if (!a.readBy.includes(c.viewer.user.id)) a.readBy.push(c.viewer.user.id);
  });
}
