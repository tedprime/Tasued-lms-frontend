import type { ApiError } from "./types";

/**
 * Minimal REST client.
 * - Session lives in an httpOnly cookie set by the API after Microsoft sign-in,
 *   so no token is ever readable by JavaScript or placed in a URL (fixes SLAN's tokens-in-URL issue).
 * - Errors are thrown as ApiError with the HTTP status attached.
 */

let baseUrl = "/api/v1";
let onUnauthorized: (() => void) | null = null;

export function configureApi(opts: { baseUrl?: string; onUnauthorized?: () => void }) {
  if (opts.baseUrl !== undefined) baseUrl = opts.baseUrl.replace(/\/$/, "");
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

export function apiBaseUrl() {
  return baseUrl;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = `${baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: isForm ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    signal,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    const err: ApiError = {
      status: res.status,
      code: (data && typeof data === "object" && "code" in data ? String(data.code) : "") || `HTTP_${res.status}`,
      message:
        (data && typeof data === "object" && "message" in data ? String(data.message) : "") ||
        res.statusText ||
        "Request failed",
      details: data && typeof data === "object" && "details" in data ? (data.details as Record<string, string>) : undefined,
    };
    throw err;
  }
  return data as T;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "status" in e && "message" in e;
}

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again.") {
  return isApiError(e) ? e.message : e instanceof Error ? e.message : fallback;
}
