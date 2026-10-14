import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, type AppNotification, type ID, type NotificationKind } from "@tasued/api-client";
import { useToast } from "@tasued/ui";
import { Bell, CalendarClock, ClipboardCheck, ClipboardList, Megaphone, MessageSquareReply, Receipt, Timer, Video, type LucideIcon } from "lucide-react";

export const NOTIFS_KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFS_KEY,
    queryFn: () => api.notifications.list(),
    refetchInterval: 60_000,
    select: (d) => [...d].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => api.notifications.markRead(id),
    onMutate: (id) => {
      qc.setQueryData<AppNotification[]>(NOTIFS_KEY, (xs) => xs?.map((n) => (n.id === id ? { ...n, read: true } : n)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFS_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onMutate: () => {
      qc.setQueryData<AppNotification[]>(NOTIFS_KEY, (xs) => xs?.map((n) => ({ ...n, read: true })));
    },
    onError: (e) => toast.error("Couldn't mark all as read", errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFS_KEY }),
  });
}

export const notificationIcon: Record<NotificationKind, LucideIcon> = {
  recording_ready: Video,
  class_reminder: CalendarClock,
  class_changed: CalendarClock,
  assignment_published: ClipboardList,
  assignment_due_soon: ClipboardList,
  submission_receipt: Receipt,
  grade_released: ClipboardCheck,
  quiz_open: Timer,
  forum_reply: MessageSquareReply,
  announcement: Megaphone,
};

export const fallbackNotificationIcon = Bell;
