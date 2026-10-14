import type { Attachment, PublishState, Unit, UnitProgress } from "@tasued/api-client";
import { audit, find } from "../db/ops/common";
import type { ModuleRow, UnitRow } from "../db/schema";
import { moduleView, unitView } from "../db/views/core";
import { asString, readableCourse } from "../lib/access";
import { isStaffFor, requirePerm } from "../lib/auth";
import { iso } from "../lib/dates";
import { invalid, notFound, validation } from "../lib/http";
import { newId } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

export function blobUrl(file: Blob): string {
  try {
    if (typeof URL.createObjectURL === "function") return URL.createObjectURL(file);
  } catch {
    /* ignore */
  }
  return "#";
}

export async function fileFromForm(c: Ctx, field = "file"): Promise<File> {
  const fd = await c.form().catch(() => {
    throw invalid("BAD_FORM", "Upload a file using multipart/form-data.");
  });
  const f = fd.get(field);
  if (!f || typeof f === "string") throw validation({ [field]: "Choose a file to upload" });
  return f as File;
}

export function attachmentFromFile(file: File, maxMb: number): Attachment {
  if (file.size > maxMb * 1024 * 1024) throw invalid("FILE_TOO_LARGE", `That file is larger than ${maxMb} MB.`);
  return { id: newId("att"), name: file.name || "upload", mimeType: file.type || "application/octet-stream", sizeBytes: file.size, url: blobUrl(file), scanStatus: "clean" };
}

/** Unit readable by the viewer; students only see published units in published modules of readable courses. */
function readableUnit(c: Ctx, id: string) {
  const unit = find(c.db.units, id, "unit");
  const mod = find(c.db.modules, unit.moduleId, "module");
  readableCourse(c, unit.courseId);
  const staff = isStaffFor(c.viewer, unit.courseId);
  if (!staff && (unit.state !== "published" || mod.state !== "published")) throw notFound("unit");
  return { unit, mod, staff };
}

function requirePublishIfStateChange(c: Ctx, courseId: string, current: PublishState, next?: PublishState) {
  if (next && next !== current) requirePerm(c.viewer, "content.publish", courseId);
  if (next && next !== "draft" && next !== "published") throw validation({ state: "Invalid state" });
}

const words = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

export function registerContent(r: Router) {
  r.get("/courses/:id/modules", (c) => {
    const o = readableCourse(c, c.params.id);
    const staff = isStaffFor(c.viewer, o.id);
    return c.db.modules
      .filter((m) => m.courseId === o.id && (staff || m.state === "published"))
      .sort((a, b) => a.order - b.order)
      .map((m) => moduleView(c.db, m, staff));
  });

  r.post("/courses/:id/modules", async (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "content.edit", o.id);
    const b = await c.json<{ title?: string; summary?: string }>();
    const title = asString(b.title);
    if (!title) throw validation({ title: "Module title is required" });
    const order = Math.max(0, ...c.db.modules.filter((m) => m.courseId === o.id).map((m) => m.order)) + 1;
    const m: ModuleRow = { id: newId("mod"), courseId: o.id, title, summary: asString(b.summary) || undefined, order, state: "draft" };
    c.db.modules.push(m);
    audit(c.db, c.viewer.user, "content.module_created", "module", m.id, `Created module "${title}"`);
    return moduleView(c.db, m, true);
  });

  r.patch("/modules/:id", async (c) => {
    const m = find(c.db.modules, c.params.id, "module");
    requirePerm(c.viewer, "content.edit", m.courseId);
    const b = await c.json<{ title?: string; summary?: string; state?: PublishState }>();
    requirePublishIfStateChange(c, m.courseId, m.state, b.state);
    if (b.title !== undefined) m.title = asString(b.title) || m.title;
    if (b.summary !== undefined) m.summary = asString(b.summary) || undefined;
    if (b.state && b.state !== m.state) {
      m.state = b.state;
      audit(c.db, c.viewer.user, b.state === "published" ? "content.published" : "content.unpublished", "module", m.id, `${b.state === "published" ? "Published" : "Unpublished"} module "${m.title}"`);
    }
    return moduleView(c.db, m, true);
  });

  r.delete("/modules/:id", (c) => {
    const m = find(c.db.modules, c.params.id, "module");
    requirePerm(c.viewer, "content.edit", m.courseId);
    const unitIds = new Set(c.db.units.filter((u) => u.moduleId === m.id).map((u) => u.id));
    c.db.units = c.db.units.filter((u) => !unitIds.has(u.id));
    c.db.modules = c.db.modules.filter((x) => x.id !== m.id);
    audit(c.db, c.viewer.user, "content.module_deleted", "module", m.id, `Deleted module "${m.title}"`);
  });

  r.put("/courses/:id/modules/order", async (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "content.edit", o.id);
    const b = await c.json<{ ids?: string[] }>();
    reorder(c.db.modules.filter((m) => m.courseId === o.id), b.ids);
  });

  r.get("/units/:id", (c) => {
    const { unit, staff } = readableUnit(c, c.params.id);
    return unitView(c.db, unit, staff);
  });

  r.post("/modules/:id/units", async (c) => {
    const m = find(c.db.modules, c.params.id, "module");
    requirePerm(c.viewer, "content.edit", m.courseId);
    const b = await c.json<{ title?: string }>();
    const title = asString(b.title);
    if (!title) throw validation({ title: "Unit title is required" });
    const order = Math.max(0, ...c.db.units.filter((u) => u.moduleId === m.id).map((u) => u.order)) + 1;
    const unit: UnitRow = {
      id: newId("unt"),
      moduleId: m.id,
      courseId: m.courseId,
      title,
      order,
      state: "draft",
      estimatedReadMinutes: 5,
      objectives: [],
      courseTextHtml: "<p></p>",
      attachments: [],
      updatedAt: iso(c.now),
    };
    c.db.units.push(unit);
    audit(c.db, c.viewer.user, "content.unit_created", "unit", unit.id, `Created unit "${title}"`);
    return unitView(c.db, unit, true);
  });

  r.patch("/units/:id", async (c) => {
    const unit = find(c.db.units, c.params.id, "unit");
    requirePerm(c.viewer, "content.edit", unit.courseId);
    const b = await c.json<Partial<Pick<Unit, "title" | "objectives" | "courseTextHtml" | "courseTextJson" | "state" | "estimatedReadMinutes">>>();
    requirePublishIfStateChange(c, unit.courseId, unit.state, b.state);
    if (b.title !== undefined) unit.title = asString(b.title) || unit.title;
    if (Array.isArray(b.objectives)) unit.objectives = b.objectives.map((x) => String(x).trim()).filter(Boolean);
    if (typeof b.courseTextHtml === "string") {
      unit.courseTextHtml = b.courseTextHtml;
      if (b.estimatedReadMinutes === undefined) unit.estimatedReadMinutes = Math.max(1, Math.ceil(words(b.courseTextHtml) / 180));
    }
    if (typeof b.courseTextJson === "string") unit.courseTextJson = b.courseTextJson;
    if (typeof b.estimatedReadMinutes === "number" && b.estimatedReadMinutes > 0) unit.estimatedReadMinutes = Math.round(b.estimatedReadMinutes);
    if (b.state && b.state !== unit.state) {
      unit.state = b.state;
      audit(c.db, c.viewer.user, b.state === "published" ? "content.published" : "content.unpublished", "unit", unit.id, `${b.state === "published" ? "Published" : "Unpublished"} "${unit.title}"`);
    } else if (b.courseTextHtml !== undefined) {
      audit(c.db, c.viewer.user, "content.updated", "unit", unit.id, `Updated course text for "${unit.title}"`);
    }
    unit.updatedAt = iso(c.now);
    return unitView(c.db, unit, true);
  });

  r.delete("/units/:id", (c) => {
    const unit = find(c.db.units, c.params.id, "unit");
    requirePerm(c.viewer, "content.edit", unit.courseId);
    c.db.units = c.db.units.filter((u) => u.id !== unit.id);
    c.db.recordings.forEach((rec) => (rec.unitIds = rec.unitIds.filter((x) => x !== unit.id)));
    audit(c.db, c.viewer.user, "content.unit_deleted", "unit", unit.id, `Deleted unit "${unit.title}"`);
  });

  r.put("/modules/:id/units/order", async (c) => {
    const m = find(c.db.modules, c.params.id, "module");
    requirePerm(c.viewer, "content.edit", m.courseId);
    const b = await c.json<{ ids?: string[] }>();
    reorder(c.db.units.filter((u) => u.moduleId === m.id), b.ids);
  });

  r.post("/units/:id/attachments", async (c) => {
    const unit = find(c.db.units, c.params.id, "unit");
    requirePerm(c.viewer, "content.edit", unit.courseId);
    const file = await fileFromForm(c);
    const att = attachmentFromFile(file, c.db.settings.maxUploadMb);
    unit.attachments.push(att);
    unit.updatedAt = iso(c.now);
    return att;
  });

  r.delete("/units/:id/attachments/:attachmentId", (c) => {
    const unit = find(c.db.units, c.params.id, "unit");
    requirePerm(c.viewer, "content.edit", unit.courseId);
    if (!unit.attachments.some((a) => a.id === c.params.attachmentId)) throw notFound("attachment");
    unit.attachments = unit.attachments.filter((a) => a.id !== c.params.attachmentId);
  });

  r.put("/units/:id/progress", async (c) => {
    const { unit } = readableUnit(c, c.params.id);
    const b = await c.json<Partial<UnitProgress>>();
    let p = c.db.progress.find((x) => x.userId === c.viewer.user.id && x.unitId === unit.id);
    if (!p) {
      p = { userId: c.viewer.user.id, unitId: unit.id, readPercent: 0, watchedSeconds: 0, completed: false };
      c.db.progress.push(p);
    }
    if (typeof b.readPercent === "number") p.readPercent = Math.max(p.readPercent, Math.min(100, Math.max(0, Math.round(b.readPercent))));
    if (typeof b.watchedSeconds === "number") p.watchedSeconds = Math.max(p.watchedSeconds, Math.max(0, Math.round(b.watchedSeconds)));
    if (typeof b.completed === "boolean") p.completed = b.completed;
    if (p.readPercent >= 100) p.completed = true;
    p.lastVisitedAt = iso(c.now);
    const { userId: _u, ...out } = p;
    return out;
  });
}

function reorder<T extends { id: string; order: number }>(rows: T[], ids: unknown) {
  if (!Array.isArray(ids)) throw validation({ ids: "Provide the new order as a list of ids" });
  const set = new Set(rows.map((x) => x.id));
  if (ids.length !== rows.length || !ids.every((id) => typeof id === "string" && set.has(id))) {
    throw validation({ ids: "The list must contain each item exactly once" });
  }
  ids.forEach((id, i) => {
    rows.find((x) => x.id === id)!.order = i + 1;
  });
}
