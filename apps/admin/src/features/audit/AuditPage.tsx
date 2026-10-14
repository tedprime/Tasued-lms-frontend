import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { api, fmtDateTime } from "@tasued/api-client";
import { Badge, EmptyState, PageHeader, Pagination, SearchInput, Select, Table, TBody, TD, TH, THead, TR } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";

const ACTIONS = [
  "grade.changed", "grades.released", "submission.finalised", "extension.granted", "attendance.finalised", "attendance.mark_changed",
  "class.scheduled", "class.cancelled", "recording.published", "recording.deleted", "role.assigned", "role.removed",
  "user.deactivated", "user.reactivated", "import.committed", "settings.changed", "content.published", "forum.post_hidden",
];

export function AuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["audit", { search, action, page }],
    queryFn: () => api.audit.list({ search, action: action || undefined, page, pageSize: 50 }),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <PageHeader title="Audit log" description="Every sensitive change — grades, final submissions, attendance, roles, accounts and settings." />
      <SectionCard
        action={
          <div className="flex w-full flex-wrap gap-2">
            <SearchInput className="w-full sm:w-72" placeholder="Search actor, target or summary" aria-label="Search audit log" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <Select aria-label="Action" className="w-full py-2 sm:w-60" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </div>
        }
      >
        <QueryView query={q} loading={<ListSkeleton rows={10} />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={<ScrollText className="size-6" />} title="No entries match" />}>
          {(d) => (
            <>
              <Table>
                <THead><tr><TH>When</TH><TH>Actor</TH><TH>Action</TH><TH>Summary</TH><TH>Target</TH><TH>IP</TH></tr></THead>
                <TBody>
                  {d.items.map((e) => (
                    <TR key={e.id}>
                      <TD className="text-xs whitespace-nowrap">{fmtDateTime(e.at)}</TD>
                      <TD className="font-semibold whitespace-nowrap">{e.actor}</TD>
                      <TD><Badge tone={e.action.startsWith("grade") ? "gold" : e.action.startsWith("user") || e.action.startsWith("role") ? "red" : "navy"}>{e.action}</Badge></TD>
                      <TD className="min-w-[240px] text-sm">{e.summary}</TD>
                      <TD className="text-xs text-neutral-500">{e.targetType}<span className="block font-mono">{e.targetId}</span></TD>
                      <TD className="font-mono text-xs text-neutral-500">{e.ip ?? "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
            </>
          )}
        </QueryView>
      </SectionCard>
    </div>
  );
}
