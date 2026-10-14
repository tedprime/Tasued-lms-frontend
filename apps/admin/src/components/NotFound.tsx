import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonClasses, EmptyState } from "@tasued/ui";

export function NotFound() {
  return (
    <EmptyState
      className="min-h-[60vh]"
      icon={<Compass className="size-6" />}
      title="Page not found"
      description="We couldn't find that page. It may have been moved or you may have followed an old link."
      action={<Link to="/" className={buttonClasses("primary", "sm")}>Back to overview</Link>}
    />
  );
}
