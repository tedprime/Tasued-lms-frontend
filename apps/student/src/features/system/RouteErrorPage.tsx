import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button, ErrorDetails, Logo, buttonClasses, isChunkLoadError, isDomMutationError } from "@tasued/ui";

/** Router error boundary. `inline` renders inside the app shell; otherwise full page. */
export function RouteErrorPage({ inline }: { inline?: boolean }) {
  const err = useRouteError();
  const is404 = isRouteErrorResponse(err) && err.status === 404;
  const chunkFailed = isChunkLoadError(err);
  const pageChanged = isDomMutationError(err);
  const title = is404 ? "Page not found" : chunkFailed ? "This page couldn't load" : pageChanged ? "This page was changed by your browser" : "Something went wrong";
  const body = is404
    ? "The page you're looking for doesn't exist."
    : chunkFailed
      ? "A newer version of TASFUED LMS may be available, or you may be offline. Reload to try again."
      : pageChanged
        ? "A browser extension (such as page translation or a grammar checker) changed this page while it was updating. Reload to continue, and consider turning the extension off for this site."
        : "An unexpected error occurred. Reloading usually fixes it — if not, please contact support.";

  const content = (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-danger-50 text-danger">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <h1 className="font-headline text-2xl font-extrabold text-tertiary-500">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Link to="/" className={buttonClasses("outline")}>Go to dashboard</Link>
      </div>
      {!is404 && <ErrorDetails error={err} />}
    </div>
  );
  if (inline) return content;
  return (
    <div className="min-h-dvh bg-neutral">
      <div className="border-b border-neutral-200 bg-white px-5 py-3"><Logo /></div>
      {content}
    </div>
  );
}
