import { HttpResponse } from "msw";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;
  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthenticated = () => new HttpError(401, "UNAUTHENTICATED", "Please sign in.");
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (what = "item") => new HttpError(404, "NOT_FOUND", `That ${what} doesn't exist or was removed.`);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);
export const invalid = (code: string, message: string, details?: Record<string, string>) => new HttpError(422, code, message, details);
export const validation = (details: Record<string, string>) =>
  new HttpError(422, "VALIDATION_FAILED", Object.values(details)[0] ?? "Please check the form.", details);

export function errorResponse(e: HttpError) {
  return HttpResponse.json(
    { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) },
    { status: e.status },
  );
}

export function jsonResponse(data: unknown, status = 200) {
  return new HttpResponse(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export const noContent = () => new HttpResponse(null, { status: 204 });

type Cell = string | number | boolean | null | undefined;

export function toCsv(rows: Cell[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? "" : String(c);
          return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

export function csvResponse(filename: string, rows: Cell[][]) {
  return new HttpResponse("﻿" + toCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Minimal CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
