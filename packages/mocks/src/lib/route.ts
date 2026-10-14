import { delay, http, type HttpHandler } from "msw";
import type { DB } from "../db/schema";
import { getDb, scheduleSave } from "../db/store";
import { tick } from "../db/tick";
import { buildViewer, getSessionUserId, type App, type Viewer } from "./auth";
import { errorResponse, HttpError, invalid, jsonResponse, noContent, unauthenticated } from "./http";

export const API_PREFIX = "/api/v1";

export interface BaseCtx {
  app: App;
  request: Request;
  url: URL;
  params: Record<string, string>;
  db: DB;
  now: number;
  viewer: Viewer | null;
  /** query-string param ("" treated as missing) */
  q(name: string): string | undefined;
  json<B = Record<string, unknown>>(): Promise<B>;
  form(): Promise<FormData>;
}
export interface Ctx extends BaseCtx {
  viewer: Viewer;
}

type Result = unknown | Promise<unknown>;
type Method = "get" | "post" | "put" | "patch" | "delete";

export interface RouterOptions {
  app: App;
  latency?: boolean;
}

export function createRouter(opts: RouterOptions) {
  const handlers: HttpHandler[] = [];

  function add(method: Method, path: string, fn: (c: BaseCtx) => Result, isPublic: boolean) {
    handlers.push(
      http[method](`*${API_PREFIX}${path}`, async ({ request, params }) => {
        if (opts.latency !== false) await delay(150 + Math.floor(Math.random() * 250));
        const db = getDb();
        const now = Date.now();
        if (tick(db, now)) scheduleSave();
        const url = new URL(request.url);
        const p: Record<string, string> = {};
        for (const [k, v] of Object.entries(params)) if (typeof v === "string") p[k] = decodeURIComponent(v);

        const uid = getSessionUserId(opts.app);
        const user = uid ? db.users.find((u) => u.id === uid && u.status !== "deactivated" && u.status !== "suspended") : undefined;
        const viewer = user ? buildViewer(db, user) : null;

        const ctx: BaseCtx = {
          app: opts.app,
          request,
          url,
          params: p,
          db,
          now,
          viewer,
          q: (name) => url.searchParams.get(name) || undefined,
          json: async <B>() => {
            const text = await request.text();
            if (!text) return {} as B;
            try {
              return JSON.parse(text) as B;
            } catch {
              throw invalid("BAD_JSON", "The request body isn't valid JSON.");
            }
          },
          form: () => request.formData(),
        };
        try {
          if (!isPublic && !viewer) throw unauthenticated();
          const out = await fn(ctx);
          if (method !== "get") scheduleSave();
          if (out instanceof Response) return out;
          if (out === undefined) return noContent();
          return jsonResponse(out);
        } catch (e) {
          if (method !== "get") scheduleSave();
          if (e instanceof HttpError) return errorResponse(e);
          console.error("[tasued-mocks] handler error", method.toUpperCase(), path, e);
          return errorResponse(new HttpError(500, "INTERNAL", "The mock server hit an unexpected error."));
        }
      }),
    );
  }

  const authed = (m: Method) => (path: string, fn: (c: Ctx) => Result) => add(m, path, fn as (c: BaseCtx) => Result, false);
  const pub = (m: Method) => (path: string, fn: (c: BaseCtx) => Result) => add(m, path, fn, true);

  /** Register last: any other /api/v1 path (e.g. the removed /faculties, /offerings) → 404. */
  const notFoundFallback = () =>
    handlers.push(http.all(`*${API_PREFIX}/*`, () => errorResponse(new HttpError(404, "NOT_FOUND", "There is no such endpoint."))));

  return {
    app: opts.app,
    handlers,
    notFoundFallback,
    get: authed("get"),
    post: authed("post"),
    put: authed("put"),
    patch: authed("patch"),
    delete: authed("delete"),
    public: { get: pub("get"), post: pub("post") },
  };
}

export type Router = ReturnType<typeof createRouter>;
