import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { buttonClasses, EmptyState, ErrorDetails, isChunkLoadError, isDomMutationError } from "@tasued/ui";
import { errorMessage } from "@tasued/api-client";

/** Error boundary for routes (render errors, failed lazy chunks, thrown responses). */
export function RouteError() {
  const err = useRouteError();
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  const chunk = isChunkLoadError(err);
  const pageChanged = isDomMutationError(err);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon={<AlertTriangle className="size-6 text-danger" />}
        title={notFound ? "Page not found" : chunk ? "A new version is available" : pageChanged ? "This page was changed by your browser" : "Something went wrong"}
        description={
          notFound
            ? "This page doesn't exist or was moved."
            : chunk
              ? "Reload the page to get the latest version of the admin portal."
              : pageChanged
                ? "A browser extension (such as page translation or a grammar checker) changed this page while it was updating. Reload to continue."
                : isRouteErrorResponse(err)
                ? err.statusText
                : errorMessage(err)
        }
        action={
          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              <button type="button" className={buttonClasses("outline", "sm")} onClick={() => window.location.reload()}>Reload</button>
              <Link to="/" className={buttonClasses("primary", "sm")}>Go to overview</Link>
            </div>
            {!notFound && <ErrorDetails error={err} />}
          </div>
        }
      />
    </div>
  );
}
