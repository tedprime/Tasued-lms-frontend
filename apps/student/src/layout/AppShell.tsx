import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn, useIsMobile } from "@tasued/ui";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { OfflineBanner } from "./OfflineBanner";
import { MobileTabBar } from "./MobileTabBar";

const COLLAPSE_KEY = "tasued.sidebar.collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** SLAN dashboard shell: fixed white sidebar (drawer < 768px), sticky header, #fafafa content. */
export function AppShell() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });

  return (
    <div className="min-h-dvh bg-neutral">
      <a href="#main" className="sr-only z-[300] rounded-lg bg-primary-500 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className={cn("fixed inset-y-0 left-0 z-40 border-r border-neutral-200 transition-[width] duration-200", collapsed ? "w-[68px]" : "w-[264px]")}>
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <div className={cn("fixed inset-0 z-[80]", drawerOpen ? "" : "pointer-events-none")} aria-hidden={!drawerOpen}>
          <div className={cn("absolute inset-0 bg-tertiary-500/40 transition-opacity", drawerOpen ? "opacity-100" : "opacity-0")} onClick={() => setDrawerOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className={cn("absolute inset-y-0 left-0 w-[284px] max-w-[85vw] shadow-pop transition-transform duration-200", drawerOpen ? "translate-x-0" : "-translate-x-full")}
          >
            {drawerOpen && <Sidebar mobile onClose={() => setDrawerOpen(false)} />}
          </aside>
        </div>
      )}

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", !isMobile && (collapsed ? "pl-[68px]" : "pl-[264px]"))}>
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className={cn("flex-1 outline-none", isMobile && "pb-16")}>
          <Outlet />
        </main>
      </div>
      {isMobile && <MobileTabBar onMore={() => setDrawerOpen(true)} />}
    </div>
  );
}
