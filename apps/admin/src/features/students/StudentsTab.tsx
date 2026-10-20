import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileUp, UserMinus, UserPlus, Users } from "lucide-react";
import { api, fmtDate, type Enrolment } from "@tasued/api-client";
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, IconButton, Modal, Pagination, SearchInput, Table, TBody, TD, TH, THead, TR, buttonClasses } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { useCourseId } from "../../components/queries";
import { PeopleMultiPicker, type PersonLite } from "../../components/pickers";
import { useCan } from "../../app/session";

export function StudentsTab() {
  const courseId = useCourseId();
  const can = useCan();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Enrolment | null>(null);
  const q = useQuery({
    queryKey: ["courses", "enrolments", courseId, { search, page }],
    queryFn: () => api.courses.enrolments(courseId, { search, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
  const canManage = can(["people.manage", "courses.manage"]);
  const remove = useApiMutation({
    mutationFn: (userId: string) => api.courses.unenrol(courseId, userId),
    success: "Student removed from this course",
    invalidate: [["courses"], ["grades"]],
    onSuccess: () => setRemoving(null),
  });

  return (
    <SectionCard
      title="Enrolled students"
      subtitle={q.data ? `${q.data.total} enrolled` : undefined}
      action={
        <>
          <SearchInput className="w-full sm:w-60" placeholder="Search name or matric no." aria-label="Search students" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          {can("people.import") && <Link to={`/people/import?course=${courseId}`} className={buttonClasses("outline", "sm")}><FileUp className="size-4" /> Invite students</Link>}
          {canManage && <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}>Enrol students</Button>}
        </>
      }
    >
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={<Users className="size-6" />} title={search ? "No matches" : "No students enrolled yet"} />}>
        {(d) => (
          <>
            <Table>
              <THead><tr><TH>Student</TH><TH>Matric no.</TH><TH>Enrolled</TH><TH>Status</TH>{canManage && <TH className="text-right">Remove</TH>}</tr></THead>
              <TBody>
                {d.items.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={e.user?.fullName ?? "?"} src={e.user?.avatarUrl} size={32} />
                        <div className="min-w-0"><p className="truncate font-semibold">{e.user?.fullName ?? e.userId}</p><p className="truncate text-xs text-neutral-500">{e.user?.email}</p></div>
                      </div>
                    </TD>
                    <TD className="font-mono text-xs">{e.user?.matricNumber ?? "—"}</TD>
                    <TD className="text-xs">{fmtDate(e.enrolledAt)}</TD>
                    <TD><Badge tone={e.status === "active" ? "green" : "neutral"}>{e.status}</Badge></TD>
                    {canManage && <TD className="text-right"><IconButton label={`Remove ${e.user?.fullName ?? "student"}`} className="hover:text-danger" onClick={() => setRemoving(e)}><UserMinus className="size-4" /></IconButton></TD>}
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryView>
      {adding && <EnrolModal courseId={courseId} onClose={() => setAdding(false)} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing.userId)} loading={remove.isPending} tone="danger" title="Remove student?" description={`${removing?.user?.fullName ?? "This student"} loses access to this course. Their submissions and grades are kept.`} confirmLabel="Remove" />
    </SectionCard>
  );
}

function EnrolModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [error, setError] = useState<string>();
  const enrol = useApiMutation({
    mutationFn: () => api.courses.enrol(courseId, people.map((p) => p.id)),
    success: (r) => `${r.added} student(s) enrolled`,
    invalidate: [["courses"], ["grades"]],
    onSuccess: onClose,
  });
  return (
    <Modal open size="lg" onClose={onClose} title="Enrol students" description="Search existing student accounts. To create new accounts, use CSV import." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => (people.length ? enrol.mutate(undefined) : setError("Add at least one student"))} loading={enrol.isPending}>Enrol {people.length || ""}</Button></>}>
      <div className="min-h-[min(360px,45dvh)]"><PeopleMultiPicker inlineResults label="Students" role="student" value={people} onChange={(v) => { setPeople(v); setError(undefined); }} /></div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Modal>
  );
}
