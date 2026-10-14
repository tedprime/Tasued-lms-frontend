import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { fromNow, type AppNotification } from "@tasued/api-client";
import { Skeleton, cn } from "@tasued/ui";
import { notificationIcon, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../features/notifications/queries";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const unread = q.data?.filter((n) => !n.read).length ?? 0;

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

  const openItem = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    navigate(n.link || "/notifications");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-primary-500"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-secondary-500 px-1 text-[9px] leading-[13px] font-bold text-tertiary-500">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-16 z-50 animate-fade-in rounded-xl border border-neutral-200 bg-white shadow-pop sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="font-headline text-sm font-extrabold text-tertiary-500">Notifications</p>
            <button type="button" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()} className="text-xs font-semibold text-primary-500 hover:underline disabled:text-neutral-400 disabled:no-underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {q.isPending ? (
              <div className="space-y-3 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : q.isError ? (
              <p className="p-4 text-sm text-danger">Couldn't load notifications.</p>
            ) : q.data.length === 0 ? (
              <p className="p-6 text-center text-sm text-neutral-500">You're all caught up.</p>
            ) : (
              <ul>
                {q.data.slice(0, 8).map((n) => {
                  const Icon = notificationIcon[n.kind];
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => openItem(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-neutral-50", !n.read && "bg-primary-50/40")}>
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500"><Icon className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[13px] text-tertiary-500", !n.read && "font-semibold")}>{n.title}</span>
                          <span className="line-clamp-2 block text-xs text-neutral-500">{n.body}</span>
                          <span className="mt-0.5 block text-[11px] text-neutral-400">{fromNow(n.createdAt)}</span>
                        </span>
                        {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-secondary-500" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-neutral-100 px-4 py-2.5 text-center text-xs font-semibold text-primary-500 hover:bg-neutral-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
