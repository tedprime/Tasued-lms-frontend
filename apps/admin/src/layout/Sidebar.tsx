import { NavLink } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { Logo, cn } from "@tasued/ui";
import { useCan, useSignOut } from "../app/session";
import { NAV } from "./nav";

/**
 * Ported from SLAN admin's components/Sidebar.tsx: fixed rail on md+, slide-in drawer on mobile,
 * pill nav items with icon chips. Re-skinned white (TASFUED spec) with grouped, permission-filtered nav.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const can = useCan();
  const signOut = useSignOut();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) })).filter((g) => g.items.length);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-tertiary-500/40 backdrop-blur-[2px] md:hidden" onClick={onClose} aria-hidden />}
      <aside
        id="admin-sidebar"
        aria-label="Main navigation"
        className={cn(
          "fixed top-0 left-0 z-40 flex h-[100dvh] w-[84vw] max-w-[280px] flex-col border-r border-neutral-200 bg-white transition-transform duration-300 md:w-64 md:translate-x-0",
          open ? "translate-x-0 shadow-pop" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
          <Logo subtitle="Admin portal" />
          <button type="button" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[10.5px] font-bold tracking-[0.14em] text-neutral-500 uppercase">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200",
                          isActive ? "bg-primary-500 font-semibold text-white shadow-sm" : "text-tertiary-500 hover:translate-x-0.5 hover:bg-primary-50 hover:text-primary-500",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", isActive ? "bg-white/15" : "bg-neutral-100 group-hover:bg-white")}>
                            <item.icon className="size-4" aria-hidden />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-neutral-100 p-3">
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-neutral-600 hover:bg-danger-50 hover:text-danger">
            <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-100"><LogOut className="size-4" aria-hidden /></span>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
