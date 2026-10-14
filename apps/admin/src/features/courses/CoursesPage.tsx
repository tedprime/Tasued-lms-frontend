import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Users } from "lucide-react";
import { api, type CourseStatus } from "@tasued/api-client";
import { Badge, Button, EmptyState, PageHeader, Pagination, SearchInput, Select, Table, TBody, TD, TH, THead, TR } from "../../components/ui";
import { QueryView, SectionCard } from "../../components/common";
import { useCan } from "../../app/session";
import { COURSE_STATUS_LABEL, COURSE_STATUS_TONE, CourseFormModal } from "./CourseForm";

const names = (xs: { fullName: string }[]) => xs.map((x) => x.fullName).join(", ");

export function CoursesPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CourseStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const isAdmin = can("courses.manage");
  const q = useQuery({
    queryKey: ["courses", "list", { status, search, page }],
    queryFn: () => api.courses.list({ status: status || undefined, search, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        description={isAdmin ? "Each course holds its modules and units, lecturers, teaching assistants and enrolled students." : "The courses you teach or support."}
        actions={isAdmin && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New course</Button>}
      />
      <SectionCard
        action={
          <div className="flex w-full flex-wrap gap-2">
            <SearchInput className="w-full sm:w-64" placeholder="Search code or title" aria-label="Search courses" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <Select aria-label="Status" className="w-full py-2 sm:w-40" value={status} onChange={(e) => { setStatus(e.target.value as CourseStatus | ""); setPage(1); }}>
              <option value="">Any status</option>
              {(Object.keys(COURSE_STATUS_LABEL) as CourseStatus[]).map((s) => <option key={s} value={s}>{COURSE_STATUS_LABEL[s]}</option>)}
            </Select>
          </div>
        }
      >
        <QueryView
          query={q}
          isEmpty={(d) => !d.items.length}
          empty={
            <EmptyState
              icon={<BookOpen className="size-6" />}
              title="No courses found"
              description={search || status ? "Try changing the filters." : isAdmin ? "Create the first course." : "You haven't been assigned to a course yet. Ask a super admin to add you."}
              action={isAdmin && !search && !status ? <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New course</Button> : undefined}
            />
          }
        >
          {(d) => (
            <>
              <Table>
                <THead><tr><TH>Course</TH><TH>Lecturers</TH><TH>Teaching assistants</TH><TH>Students</TH><TH>Content</TH><TH>Status</TH></tr></THead>
                <TBody>
                  {d.items.map((c) => (
                    <TR key={c.id} onClick={() => navigate(`/courses/${c.id}`)}>
                      <TD>
                        <Link to={`/courses/${c.id}`} className="font-semibold text-tertiary-500 hover:text-primary-500" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-xs font-bold text-primary-600">{c.code}</span>
                          <span className="block">{c.title}</span>
                        </Link>
                      </TD>
                      <TD className="text-sm">{names(c.lecturers) || "—"}</TD>
                      <TD className="text-sm">{names(c.assistants) || "—"}</TD>
                      <TD><span className="inline-flex items-center gap-1 text-sm"><Users className="size-3.5 text-neutral-400" aria-hidden />{c.enrolledCount}</span></TD>
                      <TD className="text-sm whitespace-nowrap">{c.moduleCount} modules · {c.unitCount} units</TD>
                      <TD><Badge tone={COURSE_STATUS_TONE[c.status]}>{COURSE_STATUS_LABEL[c.status]}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
            </>
          )}
        </QueryView>
      </SectionCard>
      {creating && <CourseFormModal course={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
