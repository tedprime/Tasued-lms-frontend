import "./index.css";
import { configureApi } from "@tasued/api-client";

async function boot() {
  configureApi({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1" });
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMocks } = await import("@tasued/mocks");
    await startMocks({ app: "admin" });
  }
  const { renderApp } = await import("./app/render");
  renderApp(document.getElementById("root")!);
}

void boot();
