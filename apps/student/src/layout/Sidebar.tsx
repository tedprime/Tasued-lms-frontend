import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Timer,
  BarChart3,
  UserCheck,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo, cn } from "@tasued/ui";
import { CourseTree } from "./CourseTree";

export const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/courses", label: "My courses", icon: BookOpen, end: true },
  { to: "/classes", label: "Classes", icon: CalendarClock },
  { to: "/assignments", label: "Assignments", icon: ClipboardList },
  { to: "/quizzes", label: "Quizzes", icon: Timer },
  { to: "/grades", label: "Grades", icon: BarChart3 },
  { to: "/attendance", label: "Attendance", icon: UserCheck },
  { to: "/forum", label: "Forum", icon: MessagesSquare },
];

/**
 * White sidebar ported from SLAN's DashboardSidebar: logo header, primary nav and the
 * collapsible "My courses" tree. `collapsed` is the desktop icon-rail mode; `mobile` renders
 * the drawer variant with a close button.
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobile,
  onClose,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const narrow = collapsed && !mobile;
  return (
    <div className="flex h-full flex-col bg-white">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-neutral-200", narrow ? "justify-center" : "justify-between pr-2 pl-5")}>
        {!narrow && <Logo subtitle="Student portal" />}
        {mobile ? (
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
            <X className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-primary-500"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        )}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
        <ul className="space-y-0.5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                onClick={mobile ? onClose : undefined}
                title={narrow ? n.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center text-[13px] transition-colors",
                    narrow ? "mx-0 justify-center py-2.5" : "mx-2 gap-2.5 rounded-lg px-3 py-2",
                    isActive ? "bg-primary-500/8 font-semibold text-primary-500" : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-tertiary-500",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <n.icon className={cn("size-[17px] shrink-0", isActive ? "text-primary-500" : "text-neutral-400")} aria-hidden />
                    {narrow ? <span className="sr-only">{n.label}</span> : <span>{n.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {!narrow && (
          <>
            <p className="px-6 pt-5 pb-1.5 text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase">My courses</p>
            <CourseTree onNavigate={mobile ? onClose : undefined} />
          </>
        )}
      </nav>
    </div>
  );
}
