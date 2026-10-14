import { ROLE_LABELS, type RoleAssignment, type RoleKey, type ScopeType } from "@tasued/api-client";
import { Field, Select } from "../../components/ui";
import { CourseSelect } from "../../components/pickers";

/** Super admins act on everything; lecturers and TAs are assigned to specific courses. */
export const ROLE_SCOPES: Record<RoleKey, ScopeType> = {
  super_admin: "global",
  lecturer: "course",
  teaching_assistant: "course",
  student: "global",
};

export const SCOPE_LABELS: Record<ScopeType, string> = { global: "All courses", course: "Assigned courses" };

export const STAFF_ROLES: RoleKey[] = ["super_admin", "lecturer", "teaching_assistant"];

export type RoleDraft = Omit<RoleAssignment, "id" | "scopeName">;

export const roleDraft = (role: RoleKey): RoleDraft => ({ role, scopeType: ROLE_SCOPES[role], scopeId: null });

export function validateRole(r: RoleDraft) {
  if (r.scopeType === "course" && !r.scopeId) return "Choose the course";
  return undefined;
}

/** Role picker: Super admin (all courses) or Lecturer / Teaching assistant with a course picker. */
export function RoleScopeFields({ value, onChange, error, roles = STAFF_ROLES }: { value: RoleDraft; onChange: (r: RoleDraft) => void; error?: string; roles?: RoleKey[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Role" required htmlFor="rs-role" hint={value.scopeType === "global" ? "Everything, on every course." : "Only on the course chosen here."}>
        <Select id="rs-role" value={value.role} onChange={(e) => onChange(roleDraft(e.target.value as RoleKey))}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </Field>
      {value.scopeType === "course" && (
        <Field label="Course" required error={error} htmlFor="rs-course">
          <CourseSelect id="rs-course" value={value.scopeId ?? ""} invalid={!!error} onChange={(v) => onChange({ ...value, scopeId: v || null })} />
        </Field>
      )}
    </div>
  );
}
