import { api, request } from "@tasued/api-client";
import { owner, setOwner, saveCourse } from "./offline-store";
let accountGeneration = 0;
export const supportedPush = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
export async function removeLegacyCaches() {
  if ("caches" in window)
    await Promise.all(
      (await caches.keys())
        .filter((k) =>
          ["api-session", "api-offerings", "api-units", "api-modules"].includes(
            k,
          ),
        )
        .map((k) => caches.delete(k)),
    );
}
export async function disablePush(notifyServer = true) {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) {
    try {
      if (notifyServer)
        await request("/push/subscription", {
          method: "DELETE",
          body: { endpoint: sub.endpoint },
          signal: AbortSignal.timeout(8000),
        });
    } catch {
      /* Browser revocation also makes the endpoint unusable. */
    }
    await sub.unsubscribe();
  }
  for (const notification of (await reg?.getNotifications()) || [])
    notification.close();
}
export async function clearDevice(notifyServer = true) {
  accountGeneration++;
  const changed = await setOwner(null);
  await removeLegacyCaches();
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("lms-account")
      : null;
  if (changed) channel?.postMessage("clear");
  channel?.close();
  await disablePush(notifyServer);
}
export async function activateAccount(id: string) {
  const generation = ++accountGeneration;
  const previous = await owner();
  if (generation !== accountGeneration) return;
  if (previous !== id) {
    await setOwner(id);
    await disablePush(false);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lms-account")
        : null;
    channel?.postMessage("changed");
    channel?.close();
  }
}
export async function enablePush() {
  if (!supportedPush())
    throw new Error(
      "Push is unavailable in this browser. On supported iPhones, install the app to your Home Screen first.",
    );
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Notification permission was not granted. You can change it in browser settings.",
    );
  const config = await request<{ enabled: boolean; publicKey: string }>(
    "/push/configuration",
  );
  if (!config.enabled)
    throw new Error(
      "Push notifications have not been configured by the administrator.",
    );
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.active)
    throw new Error("The app is still installing. Reload once and try again.");
  const raw = atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }));
  try {
    await request("/push/subscription", { method: "PUT", body: sub.toJSON() });
  } catch (error) {
    await sub.unsubscribe();
    throw error;
  }
}
export async function downloadCourse(
  id: string,
  userId: string,
  onProgress: (text: string) => void,
) {
  if (!navigator.onLine)
    throw new Error("Connect to the internet to save course text.");
  if (
    (await api.auth.session()).user.id !== userId ||
    (await owner()) !== userId
  )
    throw new Error("Your account changed. Reload before saving.");
  const course = await api.courses.get(id);
  const modules = await api.content.modules(id);
  const items = modules.flatMap((m) =>
    m.units.map((u) => ({ id: u.id, moduleTitle: m.title })),
  );
  const units = [];
  for (const [index, item] of items.entries()) {
    onProgress(`Saving ${index + 1} of ${items.length} units…`);
    const u = await api.content.unit(item.id);
    const html = new DOMParser().parseFromString(u.courseTextHtml, "text/html");
    html
      .querySelectorAll(
        "img,video,audio,iframe,object,embed,script,style,source,link",
      )
      .forEach((node) => node.remove());
    units.push({
      id: u.id,
      title: u.title,
      moduleTitle: item.moduleTitle,
      text: html.body.innerHTML,
      objectives: u.objectives,
    });
  }
  await saveCourse({
    id,
    owner: userId,
    title: course.title,
    code: course.code,
    savedAt: Date.now(),
    expiresAt: Date.now() + 30 * 86400000,
    units,
  });
  await navigator.storage?.persist?.();
}
