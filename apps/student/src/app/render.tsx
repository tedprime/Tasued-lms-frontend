import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { configureApi } from "@tasued/api-client";
import { ToastProvider } from "@tasued/ui";
import { queryClient } from "./queryClient";
import { router } from "./router";
import { SESSION_KEY } from "./session";

export function renderApp(rootEl: HTMLElement) {
  // Any 401 from any endpoint means the cookie session has gone: drop it so the guard redirects.
  configureApi({
    onUnauthorized: () => {
      if (queryClient.getQueryData(SESSION_KEY)) queryClient.setQueryData(SESSION_KEY, null);
    },
  });

  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
