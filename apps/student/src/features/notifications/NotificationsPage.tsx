import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { fmtDateTime, fromNow, type AppNotification } from "@tasued/api-client";
import { Button, Card, EmptyState, PageHeader, SegmentedControl, cn } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { notificationIcon, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "./queries";

export default function NotificationsPage() {
  const q = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = q.data?.filter((n) => !n.read).length ?? 0;

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Page narrow>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={<Button variant="outline" size="sm" icon={<CheckCheck className="size-4" />} onClick={() => markAll.mutate()} disabled={!unread} loading={markAll.isPending}>Mark all read</Button>}
      />
      <SegmentedControl className="mb-4" value={filter} onChange={setFilter} options={[{ key: "all", label: "All" }, { key: "unread", label: `Unread${unread ? ` (${unread})` : ""}` }]} />
      <Async
        query={q}
        skeleton={<ListSkeleton rows={5} />}
        isEmpty={(d) => (filter === "unread" ? d.filter((n) => !n.read) : d).length === 0}
        empty={<Card><EmptyState icon={<Bell className="size-6" />} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} /></Card>}
      >
        {(list) => (
          <Card className="divide-y divide-neutral-100 overflow-hidden">
            {(filter === "unread" ? list.filter((n) => !n.read) : list).map((n) => {
              const Icon = notificationIcon[n.kind];
              return (
                <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3.5 sm:px-5", !n.read && "bg-primary-50/40")}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500"><Icon className="size-4" /></span>
                  <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                    <span className={cn("block text-sm text-tertiary-500", !n.read && "font-semibold")}>{n.title}</span>
                    <span className="block text-[13px] text-neutral-600">{n.body}</span>
                    <time dateTime={n.createdAt} title={fmtDateTime(n.createdAt)} className="mt-0.5 block text-xs text-neutral-400">{fromNow(n.createdAt)}</time>
                  </button>
                  {!n.read ? (
                    <Button variant="ghost" size="xs" onClick={() => markRead.mutate(n.id)} aria-label={`Mark "${n.title}" as read`}>Mark read</Button>
                  ) : (
                    <span className="sr-only">Read</span>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </Async>
    </Page>
  );
}
