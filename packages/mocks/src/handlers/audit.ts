import { requirePerm } from "../lib/auth";
import { matches, paginate } from "../lib/pagination";
import type { Router } from "../lib/route";

export function registerAudit(r: Router) {
  r.get("/audit", (c) => {
    requirePerm(c.viewer, "audit.view");
    const action = c.q("action");
    const actorId = c.q("actorId");
    const term = c.q("search");
    const rows = c.db.audit
      .filter((e) => (!action || e.action === action || e.action.startsWith(`${action}.`)) && (!actorId || e.actorId === actorId) && matches(term, e.actor, e.action, e.summary, e.targetId))
      .sort((a, b) => b.at.localeCompare(a.at));
    return paginate(rows, c.url);
  });
}
