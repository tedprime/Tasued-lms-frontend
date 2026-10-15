import { useState } from "react";

/**
 * Helpers for the apps' error screens: recognise common causes so the message can say what
 * happened, and show copyable technical details for support. The page never reloads by itself.
 */

/** A lazy page/chunk couldn't load — usually a new deploy replaced the files, or the network dropped. */
export function isChunkLoadError(err: unknown) {
  return err instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch/i.test(err.message);
}

/**
 * Something outside the app changed the page under React — typically a browser extension
 * (page translation, Grammarly, ad blockers). React can't continue rendering after that.
 */
export function isDomMutationError(err: unknown) {
  return err instanceof Error && (/(removeChild|insertBefore|appendChild).*not a child of this node|The node to be removed is not a child/i.test(err.message) || err.name === "NotFoundError");
}

/** Plain-text report of an error, for the "Copy details" button. */
export function errorReport(err: unknown) {
  const e = err instanceof Error ? err : null;
  const status = typeof err === "object" && err && "status" in err ? ` (${String((err as { status: unknown }).status)})` : "";
  const lines = [
    `${e?.name ?? "Error"}${status}: ${e?.message ?? (typeof err === "string" ? err : JSON.stringify(err))}`,
    `Page: ${window.location.pathname}${window.location.search}`,
    `Time: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
  ];
  const stack = e?.stack?.split("\n").slice(1, 8).map((l) => l.trim()).join("\n");
  if (stack) lines.push("", stack);
  return lines.join("\n");
}

/** Collapsed "Show details" panel with a copy button. */
export function ErrorDetails({ error }: { error: unknown }) {
  const [copied, setCopied] = useState(false);
  const report = errorReport(error);
  return (
    <details className="mt-4 w-full max-w-md text-left">
      <summary className="cursor-pointer text-center text-xs font-semibold text-neutral-500 hover:text-tertiary-500">Show details</summary>
      <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-neutral-100 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-600">{report}</pre>
      <button
        type="button"
        className="mt-2 text-xs font-semibold text-primary-500 hover:underline"
        onClick={() => {
          void navigator.clipboard?.writeText(report).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? "Copied" : "Copy details"}
      </button>
    </details>
  );
}
