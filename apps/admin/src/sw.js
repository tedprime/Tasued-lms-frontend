import { adminNotificationPath } from "./pwa/notification-path";
import {
  precacheAndRoute,
  createHandlerBoundToURL,
  cleanupOutdatedCaches,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";
import { owner } from "./pwa/identity-store";
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//],
  }),
);
self.skipWaiting();
clientsClaim();
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (
          ["api-session", "api-offerings", "api-units", "api-modules"].includes(
            name,
          )
        )
          await caches.delete(name);
    })(),
  ),
);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data?.json();
      } catch {
        return;
      }
      if (!data || (await owner()) !== data.userId) return;
      let link = "/";
      try {
        const url = new URL(data.link, self.location.origin);
        if (url.origin === self.location.origin)
          link = adminNotificationPath(url.pathname) + url.search;
      } catch {}
      await self.registration.showNotification("TASFUED LMS Staff", {
        body: "You have a new LMS notification.",
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        tag: String(data.notificationId || "lms"),
        data: { link, userId: data.userId },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data;
      const path = (await owner()) === data?.userId ? data.link : "/sign-in";
      await self.clients.openWindow(new URL(path, self.location.origin).href);
    })(),
  );
});
