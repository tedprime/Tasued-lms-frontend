import { INTEGRATION_HEALTH_ENABLED } from "../../app/features";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { api, ROLE_LABELS, type Permission, type RoleKey } from "@tasued/api-client";
import { PageHeader } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { STAFF_ROLES } from "../people/roleScope";

const PERMISSION_LABELS: Record<Permission, string> = {
  "courses.manage": "Create and edit courses, assign lecturers & TAs",
  "people.manage": "Manage people",
  "people.import": "Invite students / import staff from CSV",
  "roles.manage": "Assign roles",
  "content.edit": "Edit modules, units & course text",
  "content.publish": "Publish content",
  "classes.schedule": "Schedule Teams classes",
  "recordings.manage": "Manage recordings",
  "attendance.manage": "Review attendance",
  "attendance.finalise": "Finalise attendance",
  "assignments.manage": "Create assignments",
  "assignments.grade": "Grade submissions",
  "quizzes.manage": "Create quizzes & question banks",
  "quizzes.grade": "Mark quiz answers",
  "grades.release": "Release grades",
  "forum.moderate": "Moderate the forum",
  "announcements.send": "Send announcements",
  "reports.view": "View reports",
  "audit.view": "View the audit log",
  "integrations.view": "View integration health",
  "settings.manage": "Change platform settings",
};

const ROLES: RoleKey[] = [...STAFF_ROLES, "student"];

const ROLE_NOTES: Record<RoleKey, string> = {
  super_admin: "Everything, on every course",
  lecturer: "Only on assigned courses",
  teaching_assistant: "Only on assigned courses",
  student: "Student app only",
};

export function RolesPage() {
  const q = useQuery({ queryKey: ["people", "role-permissions"], queryFn: () => api.people.rolePermissions() });
  return (
    <div className="space-y-5">
      <PageHeader title="Roles & permissions" description="Three staff roles: super admins run the whole platform; lecturers and teaching assistants work only on the courses they are assigned to." />
      <SectionCard>
        <QueryView query={q} loading={<ListSkeleton rows={10} />}>
          {(matrix) => (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Role permission matrix</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">Permission</th>
                    {ROLES.map((r) => (
                      <th key={r} scope="col" className="border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-center">
                        <span className="block text-xs font-bold text-tertiary-500">{ROLE_LABELS[r]}</span>
                        <span className="block text-[10.5px] font-medium text-neutral-500">{ROLE_NOTES[r]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(PERMISSION_LABELS) as Permission[]).filter(p => INTEGRATION_HEALTH_ENABLED || p !== "integrations.view").map((p) => (
                    <tr key={p} className="hover:bg-neutral-50">
                      <th scope="row" className="sticky left-0 border-b border-neutral-100 bg-white px-4 py-2.5 text-left font-normal">
                        <span className="block font-semibold text-tertiary-500">{PERMISSION_LABELS[p]}</span>
                        <code className="text-[11px] text-neutral-500">{p}</code>
                      </th>
                      {ROLES.map((r) => {
                        const has = matrix[r]?.includes(p);
                        return (
                          <td key={r} className="border-b border-neutral-100 px-3 py-2.5 text-center">
                            {has ? <Check className="mx-auto size-4 text-primary-500" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-neutral-300" aria-label="Not allowed" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryView>
      </SectionCard>
    </div>
  );
}
