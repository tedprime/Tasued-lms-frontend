import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, type SearchHit } from "@tasued/api-client";
import { Card, EmptyState, PageHeader, SearchInput } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { searchTypeIcon, searchTypeLabel } from "./searchMeta";

const ORDER: SearchHit["type"][] = ["course", "unit", "recording", "assignment", "quiz", "thread"];

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const term = (params.get("q") ?? "").trim();
  const [value, setValue] = useState(term);
  useEffect(() => setValue(term), [term]);
  const q = useQuery({ queryKey: ["search", term], queryFn: () => api.search.query(term), enabled: term.length >= 2 });

  return (
    <Page narrow>
      <PageHeader title="Search" description={term ? <>Results for “{term}”</> : "Search courses, units, recordings, assignments, quizzes and forum threads."} />
      <form
        role="search"
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setParams(value.trim() ? { q: value.trim() } : {});
        }}
      >
        <SearchInput value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search…" aria-label="Search" autoFocus />
      </form>
      {term.length < 2 ? (
        <Card><EmptyState icon={<Search className="size-6" />} title="Type at least 2 characters" /></Card>
      ) : (
        <Async
          query={q}
          skeleton={<ListSkeleton rows={4} />}
          isEmpty={(d) => d.length === 0}
          empty={<Card><EmptyState icon={<Search className="size-6" />} title={`No results for “${term}”`} description="Try a course code (e.g. AIIE 111) or a different word." /></Card>}
        >
          {(hits) => (
            <div className="space-y-6">
              {ORDER.filter((t) => hits.some((h) => h.type === t)).map((type) => {
                const Icon = searchTypeIcon[type];
                const items = hits.filter((h) => h.type === type);
                return (
                  <section key={type} aria-label={searchTypeLabel[type]}>
                    <h2 className="mb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">{searchTypeLabel[type]}s ({items.length})</h2>
                    <Card className="divide-y divide-neutral-100 overflow-hidden">
                      {items.map((h) => (
                        <Link key={h.id} to={h.link} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500"><Icon className="size-4" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-tertiary-500">{h.title}</span>
                            {h.subtitle && <span className="block truncate text-xs text-neutral-500">{h.subtitle}</span>}
                          </span>
                        </Link>
                      ))}
                    </Card>
                  </section>
                );
              })}
            </div>
          )}
        </Async>
      )}
    </Page>
  );
}
