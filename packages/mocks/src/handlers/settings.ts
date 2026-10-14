import type { PlatformSettings } from "@tasued/api-client";
import { audit } from "../db/ops/common";
import { requirePerm } from "../lib/auth";
import { validation } from "../lib/http";
import type { Router } from "../lib/route";

export function registerSettings(r: Router) {
  r.get("/settings", (c) => c.db.settings);
  r.patch("/settings", async (c) => {
    requirePerm(c.viewer, "settings.manage");
    const b = await c.json<Partial<PlatformSettings>>();
    const s = c.db.settings;
    const errs: Record<string, string> = {};
    if (b.institutionName !== undefined) {
      if (!String(b.institutionName).trim()) errs.institutionName = "Required";
      else s.institutionName = String(b.institutionName).trim();
    }
    if (b.attendanceRule) {
      const p = Number(b.attendanceRule.presentThresholdPercent ?? s.attendanceRule.presentThresholdPercent);
      const l = Number(b.attendanceRule.lateAfterMinutes ?? s.attendanceRule.lateAfterMinutes);
      if (!(p >= 1 && p <= 100)) errs["attendanceRule.presentThresholdPercent"] = "Must be 1–100%";
      else if (!(l >= 0 && l <= 120)) errs["attendanceRule.lateAfterMinutes"] = "Must be 0–120 minutes";
      else s.attendanceRule = { presentThresholdPercent: p, lateAfterMinutes: l };
    }
    if (b.defaultLatePolicy !== undefined) {
      if (!["not_accepted", "accepted_with_penalty", "accepted_no_penalty"].includes(b.defaultLatePolicy)) errs.defaultLatePolicy = "Invalid policy";
      else s.defaultLatePolicy = b.defaultLatePolicy;
    }
    if (b.maxUploadMb !== undefined) {
      if (!(b.maxUploadMb >= 1 && b.maxUploadMb <= 500)) errs.maxUploadMb = "Must be 1–500 MB";
      else s.maxUploadMb = b.maxUploadMb;
    }
    if (b.organiserAccountEmail !== undefined) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.organiserAccountEmail))) errs.organiserAccountEmail = "Enter a valid Microsoft 365 account email";
      else s.organiserAccountEmail = String(b.organiserAccountEmail).trim().toLowerCase();
    }
    if (b.minPasswordLength !== undefined) {
      const n = Number(b.minPasswordLength);
      if (!Number.isInteger(n) || n < 8 || n > 64) errs.minPasswordLength = "Must be 8–64 characters";
      else s.minPasswordLength = n;
    }
    if (b.supportEmail !== undefined) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.supportEmail)) errs.supportEmail = "Enter a valid email";
      else s.supportEmail = b.supportEmail;
    }
    if (Object.keys(errs).length) throw validation(errs);
    audit(c.db, c.viewer.user, "settings.updated", "settings", "platform", `Updated platform settings (${Object.keys(b).join(", ")})`);
    return s;
  });
}
