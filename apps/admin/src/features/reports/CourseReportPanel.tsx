import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import { api, type ID } from "@tasued/api-client";
import { Badge, EmptyState, StatCard, Table, TBody, TD, TH, THead, TR, buttonClasses } from "../../components/ui";
import { ListSkeleton, MiniBars, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { apiBase } from "../../app/env";

const pct = (n: number) => `${Math.round(n)}%`;

export function CourseReportPanel({ courseId }: { courseId: ID }) {
  const q = useQuery({ queryKey: ["reports", "course", courseId], queryFn: () => api.reports.course(courseId) });
  return (
    <QueryView query={q} loading={<SectionCard><ListSkeleton /></SectionCard>}>
      {(r) => (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-500"><strong className="text-tertiary-500">{r.courseCode}</strong> {r.courseTitle} · {r.enrolled} enrolled</p>
            <a href={api.reports.exportCsvUrl(apiBase(), courseId)} className={buttonClasses("outline", "sm")} download><Download className="size-4" /> Export CSV</a>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Avg attendance" value={pct(r.averageAttendancePercent)} />
            <StatCard label="Recording views" value={r.recordingViews.toLocaleString()} tone="navy" />
            <StatCard label="Avg watched" value={pct(r.averageWatchPercent)} tone="navy" />
            <StatCard label="Assignment submission" value={pct(r.assignmentSubmissionRate)} tone="gold" />
            <StatCard label="Quiz completion" value={pct(r.quizCompletionRate)} tone="gold" />
            <StatCard label="Forum threads" value={r.forumThreads} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Weekly attendance" bodyClassName="p-5">
              {r.weekly.length ? <MiniBars label="Weekly attendance percent" max={100} data={r.weekly.map((w) => ({ label: w.weekLabel, value: w.attendancePercent }))} format={pct} /> : <p className="text-sm text-neutral-500">No classes yet.</p>}
            </SectionCard>
            <SectionCard title="Weekly recording views" bodyClassName="p-5">
              {r.weekly.length ? <MiniBars label="Weekly recording views" color="var(--color-secondary-500)" data={r.weekly.map((w) => ({ label: w.weekLabel, value: w.recordingViews }))} /> : <p className="text-sm text-neutral-500">No recordings yet.</p>}
            </SectionCard>
          </div>
          <SectionCard title="Students at risk" subtitle="Low attendance or missing submissions.">
            {r.atRiskStudents.length === 0 ? (
              <EmptyState title="No students flagged" />
            ) : (
              <Table>
                <THead><tr><TH>Student</TH><TH>Matric no.</TH><TH>Attendance</TH><TH>Missing submissions</TH></tr></THead>
                <TBody>
                  {r.atRiskStudents.map((s) => (
                    <TR key={s.userId}>
                      <TD className="font-semibold"><span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-4 text-warning" aria-hidden />{s.fullName}</span></TD>
                      <TD className="font-mono text-xs">{s.matricNumber ?? "—"}</TD>
                      <TD><Badge tone={s.attendancePercent < 50 ? "red" : s.attendancePercent < 75 ? "amber" : "green"}>{pct(s.attendancePercent)}</Badge></TD>
                      <TD>{s.missingSubmissions}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </SectionCard>
        </div>
      )}
    </QueryView>
  );
}

export function CourseReportTab() {
  return <CourseReportPanel courseId={useCourseId()} />;
}
