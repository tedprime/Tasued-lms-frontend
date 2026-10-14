import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { api, type SearchHit } from "@tasued/api-client";
import { cn } from "@tasued/ui";
import { searchTypeIcon, searchTypeLabel } from "../features/search/searchMeta";

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Header search (SLAN's pill search) with a live results dropdown; Enter opens /search. */
export function GlobalSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebounced(term.trim(), 250);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search.query(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const hits: SearchHit[] = (q.data ?? []).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => setActive(-1), [debounced]);

  const go = (link: string) => {
    setOpen(false);
    setTerm("");
    navigate(link);
  };

  const submit = () => {
    if (active >= 0 && hits[active]) return go(hits[active].link);
    if (term.trim()) {
      setOpen(false);
      navigate(`/search?q=${encodeURIComponent(term.trim())}`);
    }
  };

  const showPanel = open && debounced.length >= 2;

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">Search courses, units, recordings, threads</label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          id={`${listId}-input`}
          type="search"
          value={term}
          autoComplete="off"
          placeholder="Search courses, units, recordings…"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="w-full rounded-full border border-neutral-200 bg-neutral-100 py-2 pr-4 pl-9 text-[13px] text-neutral-700 transition-colors outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white"
        />
      </form>

      {showPanel && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-pop sm:min-w-[380px]">
          {q.isFetching && !q.data ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Searching…</div>
          ) : q.isError ? (
            <p className="px-4 py-4 text-sm text-danger">Search is unavailable right now.</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">No results for “{debounced}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto py-1.5">
              {hits.map((h, i) => {
                const Icon = searchTypeIcon[h.type];
                return (
                  <li key={`${h.type}-${h.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(h.link)}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === active ? "bg-primary-50" : "hover:bg-neutral-50")}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500"><Icon className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-tertiary-500">{h.title}</span>
                        <span className="block truncate text-xs text-neutral-500">{searchTypeLabel[h.type]}{h.subtitle ? ` · ${h.subtitle}` : ""}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={submit} className="block w-full border-t border-neutral-100 px-4 py-2.5 text-left text-xs font-semibold text-primary-500 hover:bg-neutral-50">
            See all results for “{term.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
