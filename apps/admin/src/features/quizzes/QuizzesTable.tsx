import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { fmtDateTime, type Quiz } from "@tasued/api-client";
import { EmptyState, Table, TBody, TD, TH, THead, TR, buttonClasses } from "../../components/ui";
import { PublishBadge } from "../../components/common";
import { useCan } from "../../app/session";

export function QuizzesTable({ rows, showCourse }: { rows: Quiz[]; showCourse?: boolean }) {
  const can = useCan();
  if (!rows.length) return <EmptyState icon={<ListChecks className="size-6" />} title="No quizzes yet" />;
  return (
    <Table>
      <THead><tr><TH>Quiz</TH><TH>Window</TH><TH>Format</TH><TH>Attempts</TH><TH>State</TH><TH className="text-right">Actions</TH></tr></THead>
      <TBody>
        {[...rows].sort((a, b) => b.opensAt.localeCompare(a.opensAt)).map((q) => {
          const base = `/courses/${q.courseId}/quizzes/${q.id}`;
          return (
            <TR key={q.id}>
              <TD><p className="font-semibold">{showCourse && <span className="text-primary-600">{q.courseCode} · </span>}{q.title}</p><p className="text-xs text-neutral-500">{q.maxScore} marks · {q.weightPercent}%</p></TD>
              <TD className="text-xs whitespace-nowrap">{fmtDateTime(q.opensAt)}<span className="block text-neutral-500">to {fmtDateTime(q.closesAt)}</span></TD>
              <TD className="text-xs">{q.drawCount} questions · {q.timeLimitMinutes} min · {q.attemptsAllowed} attempt{q.attemptsAllowed === 1 ? "" : "s"}</TD>
              <TD>{q.attemptCount ?? 0}</TD>
              <TD><PublishBadge state={q.state} /></TD>
              <TD className="text-right whitespace-nowrap">
                {can("quizzes.grade") && <Link to={`${base}/attempts`} className={buttonClasses("outline", "xs")}>Attempts</Link>}{" "}
                {can("quizzes.manage") && <Link to={base} className={buttonClasses("ghost", "xs")}>Edit</Link>}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
