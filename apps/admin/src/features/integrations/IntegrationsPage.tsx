import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { api, fmtDateTime, fromNow, type IntegrationHealth } from "@tasued/api-client";
import { Badge, Button, EmptyState, PageHeader, Table, TBody, TD, TH, THead, TR, cn } from "../../components/ui";
import { HealthBadge, healthLabel, ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";

const JOB_TONE = { queued: "neutral", running: "blue", succeeded: "green", failed: "red" } as const;

export function IntegrationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations", "health"], queryFn: () => api.integrations.health(), refetchInterval: 60_000 });
  const run = useApiMutation({
    mutationFn: () => api.integrations.runCheck(),
    success: "Integration status refreshed",
    errorTitle: "Couldn't run checks",
    onSuccess: (h) => qc.setQueryData<IntegrationHealth>(["integrations", "health"], h),
  });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Integration health"
        description="Microsoft authentication and recent integration activity. Working means a successful operation was recorded; it does not guarantee every future request."
        actions={<Button icon={<RefreshCw className={cn("size-4", run.isPending && "animate-spin")} />} onClick={() => run.mutate(undefined)} disabled={run.isPending}>Run checks now</Button>}
      />
      <QueryView query={q} loading={<SectionCard><ListSkeleton /></SectionCard>}>
        {(h) => (
          <>
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4", h.overall === "ok" ? "border-primary-100 bg-primary-50" : h.overall === "degraded" ? "border-amber-200 bg-warning-50" : h.overall === "down" ? "border-red-200 bg-danger-50" : "border-neutral-200 bg-white")}>
              <div className="flex items-center gap-3">
                <Activity className="size-5" />
                <p className="font-headline text-lg font-extrabold text-tertiary-500">Overall: {healthLabel(h.overall)}</p>
              </div>
              <p className="text-sm text-neutral-600">Last authentication check {fmtDateTime(h.checkedAt)} ({fromNow(h.checkedAt)})</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {h.checks.map((c) => (
                <div key={c.key} className={cn("rounded-xl border bg-white p-4 shadow-card", c.state === "down" ? "border-red-200" : c.state === "degraded" ? "border-amber-200" : "border-neutral-200")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-tertiary-500">{c.label}</p>
                    <HealthBadge state={c.state} />
                  </div>
                  <p className="mt-2 text-xs text-neutral-600">{c.detail}</p>
                  {c.lastSuccessAt && <p className="mt-2 text-[11px] text-neutral-400">Last success {fromNow(c.lastSuccessAt)}</p>}
                </div>
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard title="Graph subscriptions" subtitle="This deployment uses background polling instead of webhook subscriptions.">
                {h.subscriptions.length === 0 ? <EmptyState title="Webhooks are not used" description="No subscription setup is required for the current polling workflow." /> : (
                  <Table>
                    <THead><tr><TH>Resource</TH><TH>Expires</TH><TH>State</TH></tr></THead>
                    <TBody>
                      {h.subscriptions.map((s) => {
                        const soon = new Date(s.expiresAt).getTime() - Date.now() < 24 * 36e5;
                        return (
                          <TR key={s.id}>
                            <TD className="font-mono text-xs break-all">{s.resource}</TD>
                            <TD className={cn("text-xs whitespace-nowrap", soon && "font-semibold text-warning")}>{fmtDateTime(s.expiresAt)}<span className="block">{fromNow(s.expiresAt)}</span></TD>
                            <TD><HealthBadge state={s.state} /></TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                )}
              </SectionCard>
              <SectionCard title="Recent jobs">
                {h.recentJobs.length === 0 ? <EmptyState title="No recent jobs" /> : (
                  <ul className="divide-y divide-neutral-100">
                    {h.recentJobs.map((j) => (
                      <li key={j.id} className="flex items-start justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-tertiary-500">{j.type}</p>
                          {j.detail && <p className={cn("text-xs", j.state === "failed" ? "text-danger" : "text-neutral-500")}>{j.detail}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge tone={JOB_TONE[j.state]}>{j.state}</Badge>
                          <p className="mt-0.5 text-[11px] text-neutral-400">{fromNow(j.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </QueryView>
    </div>
  );
}
