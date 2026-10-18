import "./pwa/install";
import { removeLegacyCaches } from "./pwa/device";
import "./index.css";
import { configureApi } from "@tasued/api-client";

async function boot() {
  await removeLegacyCaches().catch(() => undefined);
  configureApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1" });
  // Download the app while the mock API starts, instead of one after the other.
  const app = import("./app/render");
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMocks } = await import("@tasued/mocks");
    await startMocks({ app: "student" });
  }
  const { renderApp } = await app;
  renderApp(document.getElementById("root")!);
}

function showBootError() {
  const root = document.getElementById("root");
  if (!root) return;

  const state = document.createElement("main");
  state.className = "boot-screen";
  state.setAttribute("role", "alert");

  const message = document.createElement("p");
  message.textContent =
    "TASFUED LMS could not start. Check your connection and try again.";

  const retry = document.createElement("button");
  retry.className = "boot-retry";
  retry.textContent = "Reload";
  retry.addEventListener("click", () => window.location.reload());

  state.append(message, retry);
  root.replaceChildren(state);
}

void boot().catch(showBootError);
