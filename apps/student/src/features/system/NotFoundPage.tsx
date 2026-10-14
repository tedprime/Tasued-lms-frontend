import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonClasses } from "@tasued/ui";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary-50 text-secondary-700">
        <Compass className="size-7" aria-hidden />
      </div>
      <p className="font-headline text-5xl font-extrabold text-primary-500">404</p>
      <h1 className="mt-2 font-headline text-xl font-extrabold text-tertiary-500">We couldn't find that page</h1>
      <p className="mt-2 text-sm text-neutral-500">The link may be broken or the page may have moved.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className={buttonClasses("primary")}>Go to dashboard</Link>
        <Link to="/courses/browse" className={buttonClasses("outline")}>Browse courses</Link>
      </div>
    </div>
  );
}
