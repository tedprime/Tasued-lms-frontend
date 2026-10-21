import { refreshDefaults } from "@tasued/ui";
import { clearDevice } from "../pwa/device";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { configureApi, isApiError } from "@tasued/api-client";
import { ToastProvider } from "@tasued/ui";
import { createAppRouter } from "./router";
import { SESSION_KEY } from "./session";

export function renderApp(rootEl: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        ...refreshDefaults,
        retry: (count, e) => !(isApiError(e) && e.status >= 400 && e.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });

  // A 401 anywhere means the cookie session has expired → drop to signed-out; RequireAuth redirects to /sign-in.
  configureApi({
    portal: 'admin',
    onUnauthorized: () => {
      void clearDevice(false).catch(()=>undefined);
      if (!window.location.pathname.startsWith("/sign-in") && queryClient.getQueryData(SESSION_KEY)) {
        queryClient.setQueryData(SESSION_KEY, null);
      }
    },
  });

  if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('lms-admin-account');channel.onmessage=()=>{queryClient.clear();location.replace('/sign-in');};}
  const router = createAppRouter();

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
