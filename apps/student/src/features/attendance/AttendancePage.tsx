import { UserCheck } from "lucide-react";
import { Card, EmptyState, PageHeader, StatCard } from "@tasued/ui";
import { useMyAttendance } from "../../app/queries";
import { Async, ListSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { AttendanceCard } from "./AttendanceCard";

export default function AttendancePage() {
  const q = useMyAttendance();
  return (
    <Page narrow>
      <PageHeader title="Attendance" description="Taken automatically from Teams meeting reports and reviewed by your lecturers." />
      <Async
        query={q}
        skeleton={<ListSkeleton rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<Card><EmptyState icon={<UserCheck className="size-6" />} title="No attendance yet" description="Attendance appears after your first Teams class has been reviewed." /></Card>}
      >
        {(list) => {
          const total = list.reduce((s, x) => s + x.totalClasses, 0);
          const attended = list.reduce((s, x) => s + x.present + x.late, 0);
          const overall = total ? Math.round((attended / total) * 100) : 0;
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard label="Overall" value={`${overall}%`} icon={<UserCheck className="size-5" />} />
                <StatCard label="Classes attended" value={`${attended}/${total}`} tone="navy" />
                <StatCard className="col-span-2 sm:col-span-1" label="Absences" value={list.reduce((s, x) => s + x.absent, 0)} tone="red" />
              </div>
              {list.map((s) => <AttendanceCard key={s.courseId} s={s} />)}
            </div>
          );
        }}
      </Async>
    </Page>
  );
}
