import { apiBaseUrl } from "@tasued/api-client";

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

/** API base, for building download links (CSV / XLSX exports). */
export const apiBase = () => apiBaseUrl();
