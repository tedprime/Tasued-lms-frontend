import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { api, type ID, type RoleKey, type User } from "@tasued/api-client";
import { Avatar, Select, SearchInput, Spinner, cn } from "@tasued/ui";
import { useModules, useCoursesInScope } from "./queries";
import { useTeaches } from "../app/session";

/* ───────── Unit coverage picker: modules → units ───────── */

export function UnitCoveragePicker({ courseId, value, onChange, invalid }: { courseId: ID; value: ID[]; onChange: (ids: ID[]) => void; invalid?: boolean }) {
  const modules = useModules(courseId);
  const [open, setOpen] = useState<Record<ID, boolean>>({});
  const selected = new Set(value);

  if (modules.isPending) return <div className="flex items-center gap-2 text-sm text-neutral-500"><Spinner className="size-4" /> Loading modules…</div>;
  if (modules.isError) return <p className="text-sm text-danger">Couldn't load modules.</p>;
  if (!modules.data.length) return <p className="text-sm text-neutral-500">This course has no modules yet. Add modules and units under Content first.</p>;

  const toggle = (ids: ID[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange([...next]);
  };

  return (
    <div className={cn("max-h-72 overflow-y-auto rounded-lg border bg-white", invalid ? "border-danger" : "border-neutral-300")} role="group" aria-label="Units covered">
      {modules.data.map((m) => {
        const ids = m.units.map((u) => u.id);
        const count = ids.filter((id) => selected.has(id)).length;
        const all = count > 0 && count === ids.length;
        const isOpen = open[m.id] ?? count > 0;
        return (
          <div key={m.id} className="border-b border-neutral-100 last:border-0">
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id]: !isOpen }))} aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${m.title}`} className="rounded p-0.5 text-neutral-500 hover:bg-neutral-100">
                {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
              <input
                type="checkbox"
                className="size-4 accent-primary-500"
                checked={all}
                ref={(el) => {
                  if (el) el.indeterminate = count > 0 && !all;
                }}
                onChange={(e) => toggle(ids, e.target.checked)}
                aria-label={`Select all units in ${m.title}`}
                disabled={!ids.length}
              />
              <span className="flex-1 truncate text-sm font-semibold text-tertiary-500">{m.title}</span>
              <span className="text-xs text-neutral-500">{count}/{ids.length}</span>
            </div>
            {isOpen && (
              <ul className="pb-2 pl-12">
                {m.units.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50">
                      <input type="checkbox" className="size-4 accent-primary-500" checked={selected.has(u.id)} onChange={(e) => toggle([u.id], e.target.checked)} />
                      <span className="truncate">{u.title}</span>
                    </label>
                  </li>
                ))}
                {!m.units.length && <li className="px-2 py-1 text-xs text-neutral-500">No units</li>}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Person search & multi-select ───────── */

export type PersonLite = Pick<User, "id" | "fullName" | "email"> & { matricNumber?: string; avatarUrl?: string };

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function PersonSearch({ role, onPick, excludeIds = [], placeholder = "Search by name, email or matric number", inlineResults = false }: { inlineResults?: boolean; role?: RoleKey; onPick: (p: PersonLite) => void; excludeIds?: ID[]; placeholder?: string }) {
  const [term, setTerm] = useState("");
  const search = useDebounced(term);
  const id = useId();
  const q = useQuery({
    queryKey: ["people", "list", { search, role, pageSize: 8 }],
    queryFn: () => api.people.list({ search, role, pageSize: 8 }),
    enabled: search.trim().length >= 2,
  });
  const results = (q.data?.items ?? []).filter((u) => !excludeIds.includes(u.id));
  return (
    <div className="relative">
      <SearchInput value={term} onChange={(e) => setTerm(e.target.value)} placeholder={placeholder} aria-label={placeholder} aria-controls={id} />
      {search.trim().length >= 2 && (
        <ul id={id} role="listbox" className={`${inlineResults ? "relative" : "absolute z-20"} mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-pop`}>
          {q.isFetching && !q.data && <li className="px-3 py-2 text-sm text-neutral-500">Searching…</li>}
          {q.data && !results.length && <li className="px-3 py-2 text-sm text-neutral-500">No matches</li>}
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50"
                onClick={() => {
                  onPick(u);
                  setTerm("");
                }}
              >
                <Avatar name={u.fullName} src={u.avatarUrl} size={28} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-tertiary-500">{u.fullName}</span>
                  <span className="block truncate text-xs text-neutral-500">{u.email}{u.matricNumber ? ` · ${u.matricNumber}` : ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PeopleMultiPicker({ value, onChange, role, label, inlineResults = false }: { inlineResults?: boolean; value: PersonLite[]; onChange: (v: PersonLite[]) => void; role?: RoleKey; label: string }) {
  return (
    <div className="space-y-2">
      <PersonSearch inlineResults={inlineResults} role={role} excludeIds={value.map((v) => v.id)} onPick={(p) => onChange([...value, p])} placeholder={`Search ${label.toLowerCase()}`} />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {value.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pr-1 pl-2.5 text-xs font-semibold text-tertiary-500">
              {p.fullName}
              <button type="button" aria-label={`Remove ${p.fullName}`} onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────── Course select ───────── */

/**
 * Course picker (scoped to the courses the session can act on).
 * When it isn't an "All courses" filter and there's only one course, that course is chosen automatically.
 */
export function CourseSelect({ value, onChange, allowAll, allLabel = "All courses", id, invalid, teachingOnly }: { value: ID; onChange: (id: ID) => void; allowAll?: boolean; allLabel?: string; id?: string; invalid?: boolean; /** Only courses the user lectures or assists on. */ teachingOnly?: boolean }) {
  const q = useCoursesInScope();
  const teaches = useTeaches();
  const courses = teachingOnly ? q.data?.filter((c) => teaches(c.id)) : q.data;
  const only = !allowAll && courses?.length === 1 ? courses[0]!.id : undefined;
  useEffect(() => {
    if (only && !value) onChange(only);
  }, [only, value, onChange]);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} disabled={q.isPending} aria-label="Course">
      {allowAll ? <option value="">{allLabel}</option> : <option value="">{q.isPending ? "Loading…" : courses?.length ? "Choose a course" : "No courses yet"}</option>}
      {courses?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} — {c.title}
        </option>
      ))}
    </Select>
  );
}
