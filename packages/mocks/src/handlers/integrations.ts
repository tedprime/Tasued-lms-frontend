import { audit } from "../db/ops/common";
import { requirePerm } from "../lib/auth";
import { iso, MIN } from "../lib/dates";
import { newId } from "../lib/random";
import type { Router } from "../lib/route";

export function registerIntegrations(r: Router) {
  r.get("/integrations/health", (c) => {
    requirePerm(c.viewer, "integrations.view");
    return c.db.health;
  });
  r.post("/integrations/health/run", (c) => {
    requirePerm(c.viewer, "integrations.view");
    const h = c.db.health;
    h.checkedAt = iso(c.now);
    h.checks.forEach((ch) => ch.state === "ok" && (ch.lastSuccessAt = iso(c.now)));
    const stillDegraded = h.subscriptions.some((s) => s.state !== "ok") || h.checks.some((ch) => ch.state !== "ok");
    h.overall = h.checks.some((ch) => ch.state === "down") ? "down" : stillDegraded ? "degraded" : "ok";
    h.recentJobs.unshift({ id: newId("job"), type: "health.check", state: "succeeded", at: iso(c.now), detail: `${h.checks.filter((x) => x.state === "ok").length}/${h.checks.length} checks passing` });
    h.recentJobs = h.recentJobs.slice(0, 12);
    // Simulate the throttled renewal eventually succeeding when an admin re-runs checks.
    const sub = h.subscriptions.find((s) => s.state === "degraded");
    if (sub && Math.random() < 0.35) {
      sub.state = "ok";
      sub.expiresAt = iso(c.now + 3 * 24 * 60 * MIN);
      const chk = h.checks.find((x) => x.key === "change_notifications");
      if (chk) {
        chk.state = "ok";
        chk.detail = "All change-notification subscriptions are active.";
        chk.lastSuccessAt = iso(c.now);
      }
      h.overall = h.checks.every((x) => x.state === "ok") ? "ok" : "degraded";
      audit(c.db, c.viewer.user, "integration.subscription_renewed", "subscription", sub.id, `Renewed ${sub.resource}`, c.now);
    }
    return h;
  });
}
