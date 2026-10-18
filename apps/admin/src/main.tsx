import "./pwa/install";
import "./index.css";
import { configureApi } from "@tasued/api-client";

async function boot() {
  configureApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1" });
  // Download the app while the mock API starts, instead of one after the other.
  const app = import("./app/render");
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMocks } = await import("@tasued/mocks");
    await startMocks({ app: "admin" });
  }
  const { renderApp } = await app;
  renderApp(document.getElementById("root")!);
}

void boot();
