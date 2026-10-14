import { Link } from "react-router-dom";
import { ClipboardList, PenLine, Timer } from "lucide-react";
import type { StudentGradeRow } from "@tasued/api-client";
import { Card, ProgressRing, Table, TD, TH, THead, TR } from "@tasued/ui";

const kindIcon = { assignment: ClipboardList, quiz: Timer, manual: PenLine } as const;
const kindLabel = { assignment: "Assignment", quiz: "Quiz", manual: "Assessment" } as const;

export function GradeCard({ row, linkToCourse = true }: { row: StudentGradeRow; linkToCourse?: boolean }) {
  const releasedWeight = row.items.filter((i) => i.score !== null).reduce((s, i) => s + i.weightPercent, 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary-500">{row.courseCode}</p>
          <h3 className="font-headline text-base font-bold text-tertiary-500">
            {linkToCourse ? <Link to={`/courses/${row.courseId}/grades`} className="hover:text-primary-500 hover:underline">{row.courseTitle}</Link> : row.courseTitle}
          </h3>
          <p className="text-xs text-neutral-500">{releasedWeight}% of the course weight released so far</p>
        </div>
        <div className="flex items-center gap-2">
          {row.runningTotalPercent === null ? (
            <span className="text-sm text-neutral-500">No grades yet</span>
          ) : (
            <>
              <ProgressRing value={row.runningTotalPercent} size={56} />
              <span className="text-xs leading-tight text-neutral-500">Running<br />total</span>
            </>
          )}
        </div>
      </div>
      {row.items.length === 0 ? (
        <p className="px-5 py-5 text-sm text-neutral-500">No graded items yet.</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Item</TH>
              <TH className="text-right">Score</TH>
              <TH className="hidden text-right sm:table-cell">Weight</TH>
            </tr>
          </THead>
          <tbody>
            {row.items.map((i) => {
              const Icon = kindIcon[i.kind];
              return (
                <TR key={i.itemId}>
                  <TD>
                    <span className="flex items-center gap-2.5">
                      <Icon className="size-4 shrink-0 text-neutral-400" aria-label={kindLabel[i.kind]} />
                      <span className="min-w-0">
                        <span className="block font-medium">{i.title}</span>
                        <span className="block text-xs text-neutral-500 sm:hidden">{i.weightPercent}% weight</span>
                      </span>
                    </span>
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    {i.score === null ? <span className="text-xs text-neutral-400">Not released</span> : <span className="font-semibold">{i.score}<span className="text-neutral-400">/{i.maxScore}</span></span>}
                  </TD>
                  <TD className="hidden text-right text-neutral-500 sm:table-cell">{i.weightPercent}%</TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
