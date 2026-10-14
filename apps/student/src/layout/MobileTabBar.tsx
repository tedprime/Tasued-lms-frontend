import { NavLink } from "react-router-dom";
import { BookOpen, CalendarClock, ClipboardList, LayoutDashboard, Menu } from "lucide-react";
import { cn } from "@tasued/ui";

const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/classes", label: "Classes", icon: CalendarClock },
  { to: "/assignments", label: "Tasks", icon: ClipboardList },
];

/** Thumb-reachable bottom navigation for phones (< 768px). "More" opens the full sidebar drawer. */
export function MobileTabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold", isActive ? "text-primary-500" : "text-neutral-500")}
            >
              <t.icon className="size-5" aria-hidden />
              {t.label}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMore} className="flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-neutral-500">
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
