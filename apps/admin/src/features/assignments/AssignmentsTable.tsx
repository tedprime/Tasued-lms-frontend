import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { fmtDateTime, type Assignment } from "@tasued/api-client";
import { EmptyState, Table, TBody, TD, TH, THead, TR, buttonClasses } from "../../components/ui";
import { PublishBadge } from "../../components/common";
import { useCan } from "../../app/session";

export function AssignmentsTable({ rows, showCourse }: { rows: Assignment[]; showCourse?: boolean }) {
  const can = useCan();
  if (!rows.length) return <EmptyState icon={<FileText className="size-6" />} title="No assignments yet" />;
  const now = Date.now();
  return (
    <Table>
      <THead><tr><TH>Assignment</TH><TH>Opens</TH><TH>Due</TH><TH>Submitted</TH><TH>Graded</TH><TH>State</TH><TH className="text-right">Actions</TH></tr></THead>
      <TBody>
        {[...rows].sort((a, b) => b.dueAt.localeCompare(a.dueAt)).map((a) => {
          const base = `/courses/${a.courseId}/assignments/${a.id}`;
          const ungraded = (a.submissionCount ?? 0) - (a.gradedCount ?? 0);
          return (
            <TR key={a.id}>
              <TD>
                <p className="font-semibold">{showCourse && <span className="text-primary-600">{a.courseCode} · </span>}{a.title}</p>
                <p className="text-xs text-neutral-500">{a.maxScore} marks · {a.weightPercent}% of total</p>
              </TD>
              <TD className="text-xs whitespace-nowrap">{fmtDateTime(a.opensAt)}</TD>
              <TD className="text-xs whitespace-nowrap">{fmtDateTime(a.dueAt)}{new Date(a.dueAt).getTime() < now && <span className="block text-neutral-500">Past due</span>}</TD>
              <TD>{a.submissionCount ?? 0}</TD>
              <TD>{a.gradedCount ?? 0}{ungraded > 0 && <span className="ml-1 text-xs font-semibold text-warning">({ungraded} to grade)</span>}</TD>
              <TD><PublishBadge state={a.state} /></TD>
              <TD className="text-right whitespace-nowrap">
                {can("assignments.grade") && <Link to={`${base}/submissions`} className={buttonClasses("outline", "xs")}>Submissions</Link>}{" "}
                {can("assignments.manage") && <Link to={base} className={buttonClasses("ghost", "xs")}>Edit</Link>}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
