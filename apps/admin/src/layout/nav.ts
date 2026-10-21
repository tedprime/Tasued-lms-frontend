import { INTEGRATION_HEALTH_ENABLED } from "../app/features";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, CalendarClock, Video, ClipboardCheck, FileText, ListChecks, Sheet,
  MessagesSquare, Megaphone, BookOpen, Users, FileUp, ShieldCheck, ChartColumn, ScrollText, Activity, Settings,
} from "lucide-react";
import type { Permission } from "@tasued/api-client";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** any-of; omitted = every staff member */
  perm?: Permission[];
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/courses", label: "Courses", icon: BookOpen },
    ],
  },
  // Teaching tools: lecturers and teaching assistants only (super admins don't hold these permissions).
  {
    label: "Teaching",
    items: [
      { to: "/classes", label: "Classes", icon: CalendarClock, perm: ["classes.schedule", "attendance.manage"] },
      { to: "/recordings", label: "Recordings", icon: Video, perm: ["recordings.manage"] },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck, perm: ["attendance.manage"] },
      { to: "/assignments", label: "Assignments", icon: FileText, perm: ["assignments.manage", "assignments.grade"] },
      { to: "/quizzes", label: "Quizzes", icon: ListChecks, perm: ["quizzes.manage", "quizzes.grade"] },
      { to: "/gradebook", label: "Gradebook", icon: Sheet, perm: ["assignments.grade", "quizzes.grade", "grades.release"] },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/forum", label: "Forum moderation", icon: MessagesSquare, perm: ["forum.moderate"] },
      { to: "/announcements", label: "Announcements", icon: Megaphone, perm: ["announcements.send"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/people", label: "People", icon: Users, perm: ["people.manage"], end: true },
      { to: "/people/import", label: "Invite students", icon: FileUp, perm: ["people.import"] },
      { to: "/roles", label: "Roles & permissions", icon: ShieldCheck, perm: ["roles.manage"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", icon: ChartColumn, perm: ["reports.view"] },
      { to: "/audit", label: "Audit log", icon: ScrollText, perm: ["audit.view"] },
      { to: "/integrations", label: "Integration health", icon: Activity, perm: ["integrations.view"] },
    ],
  },
  { label: "System", items: [{ to: "/settings", label: "Settings", icon: Settings, perm: ["settings.manage"] }] },
];

export const NAV = ALL_NAV.map(group => ({ ...group, items: group.items.filter(item => INTEGRATION_HEALTH_ENABLED || item.to !== "/integrations") }));
