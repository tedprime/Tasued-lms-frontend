import { refreshDefaults } from "@tasued/ui";
import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@tasued/api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...refreshDefaults,
      // Always attempt the request so the service worker can answer from cache when offline.
      networkMode: "offlineFirst",
      retry: (count, err) => {
        // Never retry client errors (401/403/404/409/422); retry flaky network twice.
        if (isApiError(err) && err.status >= 400 && err.status < 500) return false;
        return count < 2;
      },
    },
    mutations: { retry: false, networkMode: "always" },
  },
});
