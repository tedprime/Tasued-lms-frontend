import { Link } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { fmtDate, fmtTime, type ClassSession } from "@tasued/api-client";
import { EmptyState, Table, TBody, TD, TH, THead, TR, buttonClasses } from "../../components/ui";
import { AttendanceStatusBadge, ClassStatusBadge } from "../../components/common";

export function AttendanceList({ classes, showCourse, emptyTitle = "No attendance sheets" }: { classes: ClassSession[]; showCourse?: boolean; emptyTitle?: string }) {
  if (!classes.length) return <EmptyState icon={<ClipboardCheck className="size-6" />} title={emptyTitle} description="A sheet is created for each class once it has ended." />;
  return (
    <Table>
      <THead><tr><TH>Class</TH><TH>When</TH><TH>Class status</TH><TH>Attendance</TH><TH className="text-right">Sheet</TH></tr></THead>
      <TBody>
        {classes.map((c) => (
          <TR key={c.id}>
            <TD>
              <p className="font-mono text-xs font-bold text-primary-600">{c.classCode}</p>
              <p className="font-semibold">{showCourse && `${c.courseCode} · `}{c.title}</p>
            </TD>
            <TD className="text-sm whitespace-nowrap">{fmtDate(c.startsAt)}<span className="block text-xs text-neutral-500">{fmtTime(c.startsAt)}</span></TD>
            <TD><ClassStatusBadge status={c.status} /></TD>
            <TD><AttendanceStatusBadge status={c.attendanceStatus} /></TD>
            <TD className="text-right">
              <Link to={`/courses/${c.courseId}/classes/${c.id}/attendance`} className={buttonClasses(c.attendanceStatus === "finalised" ? "ghost" : "outline", "xs")}>
                {c.attendanceStatus === "finalised" ? "View" : "Review"}
              </Link>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
