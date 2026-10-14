import { notFound } from "../lib/http";
import type { Router } from "../lib/route";

export function registerNotifications(r: Router) {
  r.get("/me/notifications", (c) =>
    c.db.notifications
      .filter((n) => n.userId === c.viewer.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100)
      .map(({ userId: _u, ...n }) => n),
  );
  r.post("/me/notifications/read-all", (c) => {
    c.db.notifications.forEach((n) => n.userId === c.viewer.user.id && (n.read = true));
  });
  r.post("/me/notifications/:id/read", (c) => {
    const n = c.db.notifications.find((x) => x.id === c.params.id && x.userId === c.viewer.user.id);
    if (!n) throw notFound("notification");
    n.read = true;
  });
}
