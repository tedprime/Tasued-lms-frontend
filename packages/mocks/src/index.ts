import type { App } from "./lib/auth";
import { createHandlers } from "./handlers";
import { resetDb, getDb } from "./db/store";

export { createHandlers } from "./handlers";
export { resetDb } from "./db/store";
export { API_PREFIX } from "./lib/route";
export { DEMO_INVITE_TOKEN, DEMO_STAFF_IDS, DEMO_STUDENT_IDS, EXPIRED_INVITE_TOKEN, INVITED_DEMO_STUDENT_ID } from "./db/seed";
export { DEMO_STUDENT_PASSWORD } from "./lib/password";

declare global {
  interface Window {
    __tasuedMockReset?: () => void;
  }
}

/**
 * Start the MSW browser worker with the full TASFUED mock API.
 * Requests to `/api/v1/...` are answered from an in-memory DB persisted to localStorage
 * (`tasued-mock-db-v7`); the signed-in demo account is kept per app (`tasued-mock-session-${app}`).
 */
export async function startMocks(opts: { app: App }): Promise<void> {
  const { setupWorker } = await import("msw/browser");
  getDb(); // seed (or load) eagerly so the first request is fast
  const worker = setupWorker(...createHandlers({ app: opts.app }));
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
    quiet: true,
  });
  if (typeof window !== "undefined") {
    window.__tasuedMockReset = () => {
      resetDb();
      console.info("[tasued-mocks] database wiped and reseeded");
    };
  }
}
