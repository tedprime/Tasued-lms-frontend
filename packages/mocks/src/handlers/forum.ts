import type { ForumReport, ForumThread } from "@tasued/api-client";
import { audit, find, notify } from "../db/ops/common";
import type { PostRow, ThreadRow } from "../db/schema";
import { canModerate, postView, threadView } from "../db/views/social";
import { asString, readableCourse } from "../lib/access";
import { iso } from "../lib/dates";
import { conflict, forbidden, notFound, validation } from "../lib/http";
import { matches, paginate } from "../lib/pagination";
import { newId } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

/** Forum courses visible by default: general + enrolled/scope. Filters do not bypass course access. */
function visibleCourseIds(c: Ctx): Set<string | null> {
  const ids = new Set<string | null>([null]);
  (c.viewer.isStaff ? c.viewer.staffCourseIds : c.viewer.enrolledCourseIds).forEach((id) => ids.add(id));
  return ids;
}

function readableThread(c: Ctx, id: string) {
  const t = find(c.db.threads, id, "thread");
  if (t.courseId) readableCourse(c, t.courseId);
  return t;
}

const excerpt = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

function toggle(arr: string[], id: string) {
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
}

export function registerForum(r: Router) {
  r.get("/forum/categories", (c) => {
    const cid = c.q("courseId");
    if (cid) readableCourse(c, cid);
    const vis = visibleCourseIds(c);
    return c.db.categories
      .filter((cat) => (cid ? cat.courseId === cid : vis.has(cat.courseId)))
      .map((cat) => ({ ...cat, threadCount: c.db.threads.filter((t) => t.categoryId === cat.id).length }))
      .sort((a, b) => Number(a.courseId !== null) - Number(b.courseId !== null) || a.name.localeCompare(b.name));
  });

  r.post("/forum/categories", async (c) => {
    const b = await c.json<{ courseId?: string | null; name?: string; description?: string }>();
    const courseId = b.courseId ?? null;
    if (!canModerate(c.viewer, courseId) || (courseId === null && !c.viewer.isSuperAdmin)) throw forbidden();
    const name = asString(b.name);
    if (!name) throw validation({ name: "Name is required" });
    const cat = { id: newId("cat"), courseId, name, description: asString(b.description) || undefined };
    c.db.categories.push(cat);
    return { ...cat, threadCount: 0 };
  });

  r.get("/forum/threads", (c) => {
    const cid = c.q("courseId");
    const cat = c.q("categoryId");
    const unit = c.q("unitId");
    const sort = c.q("sort") ?? "recent";
    const term = c.q("search");
    if (cid) readableCourse(c, cid);
    const vis = visibleCourseIds(c);
    let rows = c.db.threads.filter(
      (t) =>
        (cid ? t.courseId === cid : cat || unit ? true : vis.has(t.courseId)) &&
        (!cat || t.categoryId === cat) &&
        (!unit || t.unitId === unit) &&
        matches(term, t.title, excerpt(t.bodyHtml), ...t.tags),
    );
    rows = rows.filter((t) => !t.courseId || (c.viewer.enrolledCourseIds.has(t.courseId) && c.db.courses.some(o => o.id === t.courseId && o.status !== 'draft')) || c.viewer.staffCourseIds.has(t.courseId));
    const views = rows.map((t) => threadView(c.db, t, c.viewer));
    if (sort === "top") views.sort((a, b) => b.upvotes - a.upvotes || b.lastActivityAt.localeCompare(a.lastActivityAt));
    else if (sort === "unanswered") {
      const filtered = views.filter((t) => t.replyCount === 0 || !t.isResolved);
      filtered.sort((a, b) => a.replyCount - b.replyCount || b.createdAt.localeCompare(a.createdAt));
      return paginate(filtered, c.url);
    } else views.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.lastActivityAt.localeCompare(a.lastActivityAt));
    return paginate(views, c.url);
  });

  r.get("/forum/threads/:id", (c) => {
    const t = readableThread(c, c.params.id!);
    const mod = canModerate(c.viewer, t.courseId);
    const posts = c.db.posts
      .filter((p) => p.threadId === t.id && (mod || !p.isHidden))
      .sort((a, b) => Number(b.isAcceptedAnswer) - Number(a.isAcceptedAnswer) || a.createdAt.localeCompare(b.createdAt))
      .map((p) => postView(c.db, p, c.viewer, t.courseId));
    return { thread: threadView(c.db, t, c.viewer), posts };
  });

  r.post("/forum/threads", async (c) => {
    const b = await c.json<{ categoryId?: string; title?: string; bodyHtml?: string; unitId?: string; isAnonymous?: boolean; tags?: string[] }>();
    const cat = find(c.db.categories, b.categoryId, "category");
    if (cat.courseId) readableCourse(c, cat.courseId);
    const title = asString(b.title);
    const body = (b.bodyHtml ?? "").trim();
    const errs: Record<string, string> = {};
    if (title.length < 5) errs.title = "Give your question a title (at least 5 characters)";
    if (!body.replace(/<[^>]+>/g, "").trim()) errs.bodyHtml = "Write your question";
    if (b.unitId && !c.db.units.some((u) => u.id === b.unitId && u.courseId === cat.courseId)) errs.unitId = "That unit isn't part of this course";
    if (Object.keys(errs).length) throw validation(errs);
    const now = iso(c.now);
    const t: ThreadRow = {
      id: newId("thr"),
      categoryId: cat.id,
      courseId: cat.courseId,
      unitId: b.unitId || undefined,
      title,
      bodyHtml: body,
      authorId: c.viewer.user.id,
      createdAt: now,
      lastActivityAt: now,
      upvoterIds: [],
      subscriberIds: [c.viewer.user.id],
      isPinned: false,
      isLocked: false,
      isResolved: false,
      isAnonymous: !!b.isAnonymous && !c.viewer.isStaff,
      tags: Array.isArray(b.tags) ? b.tags.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 5) : [],
    };
    c.db.threads.push(t);
    return threadView(c.db, t, c.viewer);
  });

  r.post("/forum/threads/:id/posts", async (c) => {
    const t = readableThread(c, c.params.id!);
    const mod = canModerate(c.viewer, t.courseId);
    if (t.isLocked && !mod) throw conflict("THREAD_LOCKED", "This thread is locked and isn't accepting replies.");
    const b = await c.json<{ bodyHtml?: string; parentId?: string | null }>();
    const body = (b.bodyHtml ?? "").trim();
    if (!body.replace(/<[^>]+>/g, "").trim()) throw validation({ bodyHtml: "Write a reply" });
    if (b.parentId && !c.db.posts.some((p) => p.id === b.parentId && p.threadId === t.id)) throw validation({ parentId: "Invalid parent post" });
    const p: PostRow = { id: newId("pst"), threadId: t.id, parentId: b.parentId ?? null, bodyHtml: body, authorId: c.viewer.user.id, createdAt: iso(c.now), upvoterIds: [], isAcceptedAnswer: false, isHidden: false };
    c.db.posts.push(p);
    t.lastActivityAt = p.createdAt;
    const recipients = new Set([...t.subscriberIds, t.authorId]);
    recipients.delete(c.viewer.user.id);
    notify(c.db, recipients, { kind: "forum_reply", title: "New reply", body: `${c.viewer.user.fullName} replied to "${t.title}".`, link: `/forum/${t.id}` }, c.now);
    if (!t.subscriberIds.includes(c.viewer.user.id)) t.subscriberIds.push(c.viewer.user.id);
    return postView(c.db, p, c.viewer, t.courseId);
  });

  r.patch("/forum/posts/:id", async (c) => {
    const p = find(c.db.posts, c.params.id, "post");
    const t = readableThread(c, p.threadId);
    if (p.authorId !== c.viewer.user.id && !canModerate(c.viewer, t.courseId)) throw forbidden("You can only edit your own posts.");
    const body = ((await c.json<{ bodyHtml?: string }>()).bodyHtml ?? "").trim();
    if (!body.replace(/<[^>]+>/g, "").trim()) throw validation({ bodyHtml: "Post can't be empty" });
    p.bodyHtml = body;
    p.editedAt = iso(c.now);
    return postView(c.db, p, c.viewer, t.courseId);
  });

  r.post("/forum/threads/:id/upvote", (c) => {
    const t = readableThread(c, c.params.id!);
    toggle(t.upvoterIds, c.viewer.user.id);
    return threadView(c.db, t, c.viewer);
  });

  r.post("/forum/posts/:id/upvote", (c) => {
    const p = find(c.db.posts, c.params.id, "post");
    const t = readableThread(c, p.threadId);
    toggle(p.upvoterIds, c.viewer.user.id);
    return postView(c.db, p, c.viewer, t.courseId);
  });

  r.post("/forum/threads/:id/subscribe", async (c) => {
    const t = readableThread(c, c.params.id!);
    const { subscribed } = await c.json<{ subscribed?: boolean }>();
    t.subscriberIds = t.subscriberIds.filter((x) => x !== c.viewer.user.id);
    if (subscribed !== false) t.subscriberIds.push(c.viewer.user.id);
    return threadView(c.db, t, c.viewer);
  });

  r.post("/forum/reports", async (c) => {
    const b = await c.json<{ targetType?: "thread" | "post"; targetId?: string; reason?: string }>();
    const reason = asString(b.reason);
    if (!reason) throw validation({ reason: "Tell the moderators what's wrong" });
    let thread: ThreadRow;
    let text: string;
    if (b.targetType === "post") {
      const p = find(c.db.posts, b.targetId, "post");
      thread = readableThread(c, p.threadId);
      text = p.bodyHtml;
    } else if (b.targetType === "thread") {
      thread = readableThread(c, b.targetId ?? "");
      text = thread.bodyHtml;
    } else throw validation({ targetType: "Invalid target" });
    if (c.db.reports.some((x) => x.targetId === b.targetId && x.reporterId === c.viewer.user.id && x.status === "open")) return undefined;
    c.db.reports.push({ id: newId("rep"), targetType: b.targetType, targetId: b.targetId!, threadId: thread.id, threadTitle: thread.title, excerpt: excerpt(text), reason, reportedBy: c.viewer.user.fullName, reporterId: c.viewer.user.id, reportedAt: iso(c.now), status: "open" });
    return undefined;
  });

  r.post("/forum/threads/:id/accept", async (c) => {
    const t = readableThread(c, c.params.id!);
    if (t.authorId !== c.viewer.user.id && !canModerate(c.viewer, t.courseId)) throw forbidden("Only the person who asked, or a moderator, can accept an answer.");
    const { postId } = await c.json<{ postId?: string }>();
    const p = c.db.posts.find((x) => x.id === postId && x.threadId === t.id);
    if (!p) throw notFound("post");
    c.db.posts.forEach((x) => x.threadId === t.id && (x.isAcceptedAnswer = x.id === p.id));
    t.isResolved = true;
    if (p.authorId !== c.viewer.user.id) notify(c.db, [p.authorId], { kind: "forum_reply", title: "Your answer was accepted", body: `Your reply in "${t.title}" was marked as the answer.`, link: `/forum/${t.id}` }, c.now);
    return threadView(c.db, t, c.viewer);
  });

  r.post("/forum/threads/:id/moderate", async (c) => {
    const t = readableThread(c, c.params.id!);
    if (!canModerate(c.viewer, t.courseId)) throw forbidden();
    const b = await c.json<Partial<Pick<ForumThread, "isPinned" | "isLocked" | "isResolved">>>();
    if (typeof b.isPinned === "boolean") t.isPinned = b.isPinned;
    if (typeof b.isLocked === "boolean") t.isLocked = b.isLocked;
    if (typeof b.isResolved === "boolean") t.isResolved = b.isResolved;
    audit(c.db, c.viewer.user, "forum.thread_moderated", "thread", t.id, `Moderated "${t.title}" (${Object.entries(b).map(([k, v]) => `${k}=${v}`).join(", ")})`);
    return threadView(c.db, t, c.viewer);
  });

  r.post("/forum/posts/:id/hide", async (c) => {
    const p = find(c.db.posts, c.params.id, "post");
    const t = readableThread(c, p.threadId);
    if (!canModerate(c.viewer, t.courseId)) throw forbidden();
    const { hidden } = await c.json<{ hidden?: boolean }>();
    p.isHidden = hidden !== false;
    if (p.isHidden) c.db.reports.forEach((x) => x.targetId === p.id && x.status === "open" && (x.status = "actioned"));
    audit(c.db, c.viewer.user, p.isHidden ? "forum.post_hidden" : "forum.post_unhidden", "post", p.id, `${p.isHidden ? "Hid" : "Restored"} a post in "${t.title}"`);
    return postView(c.db, p, c.viewer, t.courseId);
  });

  r.delete("/forum/threads/:id", (c) => {
    const t = readableThread(c, c.params.id!);
    const own = t.authorId === c.viewer.user.id && !c.db.posts.some((p) => p.threadId === t.id);
    if (!own && !canModerate(c.viewer, t.courseId)) throw forbidden();
    c.db.threads = c.db.threads.filter((x) => x.id !== t.id);
    c.db.posts = c.db.posts.filter((x) => x.threadId !== t.id);
    c.db.reports.forEach((x) => x.threadId === t.id && x.status === "open" && (x.status = "actioned"));
    audit(c.db, c.viewer.user, "forum.thread_deleted", "thread", t.id, `Deleted thread "${t.title}"`);
  });

  r.get("/forum/reports", (c) => {
    if (!c.viewer.permissions.includes("forum.moderate")) throw forbidden();
    const status = (c.q("status") ?? "open") as ForumReport["status"];
    return c.db.reports
      .filter((x) => x.status === status)
      .filter((x) => {
        const cid = c.db.threads.find((t) => t.id === x.threadId)?.courseId ?? null;
        return canModerate(c.viewer, cid);
      })
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
      .map(({ reporterId: _r, ...x }) => x);
  });

  r.patch("/forum/reports/:id", async (c) => {
    const rep = find(c.db.reports, c.params.id, "report");
    const cid = c.db.threads.find((t) => t.id === rep.threadId)?.courseId ?? null;
    if (!canModerate(c.viewer, cid)) throw forbidden();
    const { status } = await c.json<{ status?: "dismissed" | "actioned" }>();
    if (status !== "dismissed" && status !== "actioned") throw validation({ status: "Choose dismissed or actioned" });
    rep.status = status;
    audit(c.db, c.viewer.user, `forum.report_${status}`, "report", rep.id, `Report on "${rep.threadTitle}" ${status}`);
    const { reporterId: _r, ...out } = rep;
    return out;
  });
}
