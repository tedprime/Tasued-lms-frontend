import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Menu as MenuIcon, UserRound } from "lucide-react";
import { api, fromNow, ROLE_LABELS, type RoleAssignment } from "@tasued/api-client";
import { Avatar, Select, cn } from "@tasued/ui";
import { useSession, useSignOut } from "../app/session";
import { useCoursesInScope } from "../components/queries";
import { useApiMutation } from "../components/mutation";
import { NAV } from "./nav";

function usePageTitle() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/courses/")) return "Course";
  let best = { len: 0, label: "Dashboard" };
  for (const g of NAV)
    for (const i of g.items) {
      if (i.to === "/" ? pathname === "/" : pathname === i.to || pathname.startsWith(i.to + "/")) {
        if (i.to.length > best.len) best = { len: i.to.length, label: i.label };
      }
    }
  if (pathname.startsWith("/profile")) return "My profile";
  return best.label;
}

/** Click-outside popover used for notifications and the profile menu. */
function Popover({ button, children, label, width = 320 }: { button: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; label: string; width?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)} className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none">
        {button(open)}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute right-0 z-50 mt-2 max-w-[calc(100vw-1.5rem)] animate-fade-in rounded-xl border border-neutral-200 bg-white shadow-pop" style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function CourseSwitcher() {
  const courses = useCoursesInScope();
  const navigate = useNavigate();
  const match = useMatch("/courses/:courseId/*");
  const courseId = match?.params.courseId;
  if (!courses.data?.length) return null;
  const tab = match?.params["*"]?.split("/")[0];
  const safeTab = tab && ["content", "classes", "recordings", "attendance", "assignments", "quizzes", "gradebook", "students", "forum", "announcements", "report", "question-banks"].includes(tab) ? tab : "content";
  return (
    <div className="hidden min-w-0 sm:block">
      <label htmlFor="course-switcher" className="sr-only">Switch course</label>
      <Select
        id="course-switcher"
        className="max-w-[260px] truncate py-2 text-[13px] font-semibold"
        value={courseId ?? ""}
        onChange={(e) => e.target.value && navigate(`/courses/${e.target.value}/${safeTab}`)}
      >
        <option value="">Jump to a course…</option>
        {courses.data.map((o) => (
          <option key={o.id} value={o.id}>{o.code} — {o.title}</option>
        ))}
      </Select>
    </div>
  );
}

function Notifications() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.notifications.list(), refetchInterval: 60_000 });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  const markAll = useApiMutation({ mutationFn: () => api.notifications.markAllRead(), invalidate: [["notifications"]] });
  const markOne = useApiMutation({ mutationFn: (id: string) => api.notifications.markRead(id), invalidate: [["notifications"]] });
  return (
    <Popover
      label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      width={360}
      button={() => (
        <span className="relative inline-flex size-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-primary-200 hover:text-primary-500">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] leading-[18px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="font-headline text-sm font-bold">Notifications</p>
            {unread > 0 && <button type="button" className="text-xs font-semibold text-primary-500 hover:underline" onClick={() => markAll.mutate(undefined)}>Mark all read</button>}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {q.isPending && <li className="px-4 py-6 text-center text-sm text-neutral-500">Loading…</li>}
            {q.isError && <li className="px-4 py-6 text-center text-sm text-danger">Couldn't load notifications.</li>}
            {q.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-500">You're all caught up.</li>}
            {q.data?.map((n) => (
              <li key={n.id} className="border-b border-neutral-100 last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markOne.mutate(n.id);
                    close();
                    navigate(n.link);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-neutral-50", !n.read && "bg-primary-50/40")}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary-500")} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-tertiary-500">{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                    <span className="line-clamp-2 block text-xs text-neutral-500">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-neutral-400">{fromNow(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Popover>
  );
}

/** Where a role applies, in full: "Platform management" or "Course: AIIE 111 — Foundation of …". */
export function scopeLabel(r: RoleAssignment) {
  return r.scopeType === "global" ? "Platform management" : `Course: ${r.scopeName ?? r.scopeId}`;
}

/** Compact scope for tight spaces: "Platform" or just the course code ("AIIE 111"). */
export function scopeShort(r: RoleAssignment) {
  if (r.scopeType === "global") return "Platform";
  return (r.scopeName ?? r.scopeId ?? "").split(" — ")[0];
}

function ProfileMenu() {
  const session = useSession();
  const signOut = useSignOut();
  const u = session.user;
  const staffRoles = u.roles.filter((r) => r.role !== "student");
  return (
    <Popover
      label="Account menu"
      width={300}
      button={(open) => (
        <span className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1 pr-2 pl-1 shadow-sm hover:border-primary-200">
          <Avatar name={u.fullName} src={u.avatarUrl} size={32} />
          <span className="hidden max-w-[140px] text-left lg:block">
            <span className="block truncate text-[13px] font-semibold text-tertiary-500">{u.fullName}</span>
            <span className="block truncate text-[11px] text-neutral-500">{staffRoles[0] ? ROLE_LABELS[staffRoles[0].role] : "Staff"}</span>
          </span>
          <ChevronDown className={cn("size-4 text-neutral-500 transition-transform", open && "rotate-180")} />
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-3 border-b border-neutral-100 p-4">
            <Avatar name={u.fullName} src={u.avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-tertiary-500">{u.fullName}</p>
              <p className="truncate text-xs text-neutral-500">{u.email}</p>
            </div>
          </div>
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-neutral-500 uppercase">{staffRoles.length > 1 ? "Your roles" : "Your role"}</p>
            <ul className="space-y-2">
              {staffRoles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm" title={scopeLabel(r)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", r.role === "super_admin" ? "bg-secondary-500" : "bg-success")} aria-hidden />
                    <span className="truncate font-semibold text-tertiary-500">{ROLE_LABELS[r.role]}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{scopeShort(r)}</span>
                </li>
              ))}
              {!staffRoles.length && <li className="text-xs text-neutral-500">No staff roles</li>}
            </ul>
          </div>
          <div className="p-1.5">
            <Link to="/profile" onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-tertiary-500 hover:bg-neutral-50">
              <UserRound className="size-4" /> My profile
            </Link>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-50">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Ported from SLAN admin's components/Header.tsx (sticky, blurred, hamburger on mobile, page title). */
export function Header({ onMenu }: { onMenu: () => void }) {
  const title = usePageTitle();
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onMenu} aria-label="Open menu" aria-controls="admin-sidebar" className="-ml-1 rounded-xl p-2 text-neutral-600 hover:bg-primary-50 hover:text-primary-500 md:hidden">
            <MenuIcon className="size-[22px]" />
          </button>
          <div className="min-w-0">
            <p className="truncate font-headline text-lg leading-none font-extrabold text-tertiary-500 sm:text-xl">{title}</p>
            <p className="hidden text-[11px] font-medium tracking-widest text-neutral-400 uppercase sm:block">TASFUED admin workspace</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <CourseSwitcher />
          <Notifications />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
