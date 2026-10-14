import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Megaphone, Mail, Pin } from "lucide-react";
import { api, fmtDateTime, fromNow, type Announcement, type ID } from "@tasued/api-client";
import { Avatar, Badge, Card, EmptyState, RichContent, cn } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { RoleBadge } from "../forum/ThreadItem";

export function AnnouncementList({ courseId }: { courseId?: ID }) {
  const qc = useQueryClient();
  const key = ["announcements", { courseId }];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.announcements.list({ courseId }),
    select: (d: Announcement[]) => [...d].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt)),
  });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const markRead = useMutation({
    mutationFn: (id: string) => api.announcements.markRead(id),
    onSuccess: (_v, id) => {
      qc.setQueriesData<Announcement[]>({ queryKey: ["announcements"] }, (xs) => xs?.map((a) => (a.id === id ? { ...a, readByViewer: true } : a)));
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const toggle = (a: Announcement) => {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(a.id)) n.delete(a.id);
      else n.add(a.id);
      return n;
    });
    if (!a.readByViewer) markRead.mutate(a.id);
  };

  return (
    <Async
      query={q}
      skeleton={<ListSkeleton rows={4} />}
      isEmpty={(d) => d.length === 0}
      empty={<Card><EmptyState icon={<Megaphone className="size-6" />} title="No announcements" description="Announcements from your lecturers and the university appear here." /></Card>}
    >
      {(list) => (
        <ul className="space-y-3">
          {list.map((a) => {
            const isOpen = open.has(a.id);
            return (
              <li key={a.id}>
                <Card className={cn("overflow-hidden", !a.readByViewer && "border-l-4 border-l-secondary-500")}>
                  <button type="button" onClick={() => toggle(a)} aria-expanded={isOpen} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-neutral-50">
                    <Avatar name={a.author.fullName} src={a.author.avatarUrl} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {a.courseCode ? <span className="text-xs font-bold text-primary-500">{a.courseCode}</span> : <Badge tone="gold">University-wide</Badge>}
                        {a.isPinned && <Badge tone="navy"><Pin className="size-3" /> Pinned</Badge>}
                        {!a.readByViewer && <Badge tone="gold">New</Badge>}
                      </span>
                      <span className={cn("mt-0.5 block text-[15px] text-tertiary-500", !a.readByViewer ? "font-bold" : "font-semibold")}>{a.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                        {a.author.fullName} <RoleBadge author={a.author} /> · <time dateTime={a.publishedAt} title={fmtDateTime(a.publishedAt)}>{fromNow(a.publishedAt)}</time>
                        {a.sendEmail && <span className="inline-flex items-center gap-1"><Mail className="size-3" /> also emailed</span>}
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-1 size-4 shrink-0 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && <RichContent html={a.bodyHtml} className="border-t border-neutral-100 px-5 py-4 text-[15px]" />}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Async>
  );
}
