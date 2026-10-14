import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigation } from "react-router-dom";
import { PageLoader } from "@tasued/ui";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

/** Ported from SLAN admin's DashboardLayout (App.tsx): fixed sidebar + sticky header + scrolling main. */
export function AppShell() {
  const [open, setOpen] = useState(false);
  const nav = useNavigation();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen w-full bg-neutral">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[300] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-pop">Skip to content</a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-h-screen flex-col md:ml-64">
        <Header onMenu={() => setOpen(true)} />
        {nav.state === "loading" && <div className="fixed top-0 right-0 left-0 z-[60] h-0.5 animate-pulse bg-secondary-500" aria-hidden />}
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
