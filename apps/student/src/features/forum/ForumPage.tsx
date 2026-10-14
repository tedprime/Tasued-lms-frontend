import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe, BookOpen, Hash } from "lucide-react";
import type { ForumCategory } from "@tasued/api-client";
import { useForumCategories } from "./queries";
import { Card, PageHeader, Select, Skeleton, cn } from "@tasued/ui";
import { useMyCourses } from "../../app/queries";
import { Page } from "../../components/bits";
import { ThreadList } from "./ThreadList";

export default function ForumPage() {
  const [params, setParams] = useSearchParams();
  const categoryId = params.get("category") ?? undefined;
  const cats = useForumCategories();
  const mine = useMyCourses();
  const codeOf = new Map(mine.data?.map((o) => [o.id, o.code]));
  const myIds = new Set(mine.data?.map((o) => o.id));

  const general = cats.data?.filter((c) => c.courseId === null) ?? [];
  const course = cats.data?.filter((c) => c.courseId !== null && myIds.has(c.courseId)) ?? [];
  const selected = cats.data?.find((c) => c.id === categoryId);

  const choose = (id?: string) => {
    const next = new URLSearchParams();
    if (id) next.set("category", id);
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    setParams(next, { replace: true });
  };

  const newHref = selected ? `/forum/new?categoryId=${selected.id}` : "/forum/new";

  const item = (c: ForumCategory | undefined, label: string, icon: ReactNode, count?: number) => {
    const on = (c?.id ?? undefined) === categoryId;
    return (
      <li key={c?.id ?? "all"}>
        <button
          type="button"
          onClick={() => choose(c?.id)}
          aria-current={on ? "true" : undefined}
          className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px]", on ? "bg-primary-500/8 font-semibold text-primary-500" : "text-neutral-600 hover:bg-neutral-100")}
        >
          {icon}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count !== undefined && <span className="text-[11px] text-neutral-400">{count}</span>}
        </button>
      </li>
    );
  };

  return (
    <Page>
      <PageHeader title="Forum" description="Ask questions, share ideas and get help from classmates, TAs and lecturers." />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside aria-label="Forum categories">
          {/* Mobile: select */}
          <div className="lg:hidden">
            <label htmlFor="forum-cat" className="sr-only">Category</label>
            <Select id="forum-cat" value={categoryId ?? ""} onChange={(e) => choose(e.target.value || undefined)}>
              <option value="">All threads</option>
              {general.length > 0 && (
                <optgroup label="Campus">
                  {general.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              )}
              {course.length > 0 && (
                <optgroup label="My courses">
                  {course.map((c) => <option key={c.id} value={c.id}>{codeOf.get(c.courseId!) ? `${codeOf.get(c.courseId!)} — ` : ""}{c.name}</option>)}
                </optgroup>
              )}
            </Select>
          </div>
          {/* Desktop: list */}
          <Card className="hidden p-2 lg:block">
            {cats.isPending ? (
              <div className="space-y-2 p-2"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
            ) : cats.isError ? (
              <p className="p-3 text-xs text-danger">Couldn't load categories.</p>
            ) : (
              <>
                <ul>{item(undefined, "All threads", <Hash className="size-4 text-neutral-400" />)}</ul>
                {general.length > 0 && <p className="px-3 pt-3 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Campus</p>}
                <ul>{general.map((c) => item(c, c.name, <Globe className="size-4 text-neutral-400" />, c.threadCount))}</ul>
                {course.length > 0 && <p className="px-3 pt-3 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase">My courses</p>}
                <ul>{course.map((c) => item(c, `${codeOf.get(c.courseId!) ?? ""} ${c.name}`.trim(), <BookOpen className="size-4 text-neutral-400" />, c.threadCount))}</ul>
              </>
            )}
          </Card>
        </aside>
        <div className="min-w-0">
          {selected && (
            <div className="mb-4">
              <h2 className="font-headline text-lg font-extrabold text-tertiary-500">{selected.name}</h2>
              {selected.description && <p className="text-sm text-neutral-500">{selected.description}</p>}
            </div>
          )}
          <ThreadList key={categoryId ?? "all"} categoryId={categoryId} newHref={newHref} courseCodeOf={(id) => (id ? codeOf.get(id) : undefined)} />
        </div>
      </div>
    </Page>
  );
}
