import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { owner, setOwner } from "../apps/admin/src/pwa/identity-store";
import { adminNotificationPath } from "../apps/admin/src/pwa/notification-path";
test("staff notification links use staff routes", () => {
  assert.equal(adminNotificationPath("/assignments/a"), "/assignments");
  assert.equal(adminNotificationPath("/forum/t"), "/forum/threads/t");
  assert.equal(adminNotificationPath("/forum/threads/t"), "/forum/threads/t");
  assert.equal(
    adminNotificationPath("/courses/c/grades"),
    "/courses/c/gradebook",
  );
  assert.equal(adminNotificationPath("/notifications"), "/");
  assert.equal(adminNotificationPath("https://evil.test"), "/");
});
test("admin worker suppresses other-account pushes, protects links and clears identity", async () => {
  await setOwner("staff");
  assert.equal(await owner(), "staff");
  const events: Record<string, Function> = {};
  const shown: any[] = [];
  const opened: string[] = [];
  const source = readFileSync("apps/admin/src/sw.js", "utf8").replace(
    /import[\s\S]*?from\s+["'][^"']+["'];/g,
    "",
  );
  vm.runInNewContext(source, {
    owner,
    adminNotificationPath,
    URL,
    precacheAndRoute() {},
    cleanupOutdatedCaches() {},
    registerRoute() {},
    createHandlerBoundToURL() {},
    NavigationRoute: class {},
    clientsClaim() {},
    self: {
      __WB_MANIFEST: [],
      location: { origin: "https://admin.example.test" },
      skipWaiting() {},
      addEventListener(name: string, fn: Function) {
        events[name] = fn;
      },
      registration: {
        async showNotification(title: string, data: unknown) {
          shown.push({ title, data });
        },
      },
      clients: {
        async openWindow(url: string) {
          opened.push(url);
        },
      },
    },
  });
  const dispatch = async (name: string, event: any) => {
    let work: Promise<unknown> | undefined;
    events[name]({
      ...event,
      waitUntil(p: Promise<unknown>) {
        work = p;
      },
    });
    await work;
  };
  await dispatch("push", { data: { json: () => ({ userId: "other" }) } });
  assert.equal(shown.length, 0);
  await dispatch("push", {
    data: {
      json: () => ({
        userId: "staff",
        notificationId: "n",
        link: "https://evil.test",
        body: "Private grade",
      }),
    },
  });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].data.data.link, "/");
  assert.ok(!JSON.stringify(shown).includes("Private grade"));
  await dispatch("push", {
    data: {
      json: () => ({ userId: "staff", notificationId: "n2", link: "/forum/t" }),
    },
  });
  assert.equal(shown[1].data.data.link, "/forum/threads/t");
  await setOwner(null);
  await dispatch("notificationclick", {
    notification: { close() {}, data: shown[1].data.data },
  });
  assert.equal(opened[0], "https://admin.example.test/sign-in");
  await dispatch("push", { data: { json: () => ({ userId: "staff" }) } });
  assert.equal(shown.length, 2);
  assert.equal(await setOwner(null), false);
});
