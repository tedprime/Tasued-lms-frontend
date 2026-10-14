import { useQueries, useQuery } from "@tanstack/react-query";
import { api, isApiError, type Assignment, type ID, type Submission } from "@tasued/api-client";

export const submissionKey = (assignmentId: ID) => ["assignments", assignmentId, "submission"] as const;

/** A missing submission (404) just means "not started". */
export async function fetchMySubmission(id: ID): Promise<Submission | null> {
  try {
    return await api.assignments.mySubmission(id);
  } catch (e) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
}

export function useAssignments(courseId?: ID) {
  return useQuery({
    queryKey: ["assignments", { courseId }],
    queryFn: () => api.assignments.list({ courseId, state: "published" }),
    select: (d) => d.filter((a) => a.state === "published").sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
  });
}

/** Contract gap: the list endpoint has no per-student submission state, so we fetch each submission. */
export function useMySubmissions(assignments: Assignment[] | undefined) {
  return useQueries({
    queries: (assignments ?? []).map((a) => ({
      queryKey: submissionKey(a.id),
      queryFn: () => fetchMySubmission(a.id),
    })),
    combine: (results) => {
      const map = new Map<ID, Submission | null | undefined>();
      (assignments ?? []).forEach((a, i) => map.set(a.id, results[i]?.data));
      return { map, pending: results.some((r) => r.isPending) };
    },
  });
}

export type AssignmentBucket = "todo" | "submitted" | "graded" | "missed";

export function bucketOf(sub: Submission | null | undefined, a?: Assignment): AssignmentBucket {
  if (sub?.state === "submitted") return sub.grade?.released ? "graded" : "submitted";
  // Closed without a final submission: no longer actionable, so it leaves "To do".
  if (a && submissionWindow(a, sub).state === "closed") return "missed";
  return "todo";
}

/** Window logic for a student's submission. */
export function submissionWindow(a: Assignment, sub: Submission | null | undefined, now = Date.now()) {
  const opens = new Date(a.opensAt).getTime();
  const due = new Date(sub?.extensionDueAt ?? a.dueAt).getTime();
  const hardClose = a.closesAt ? new Date(a.closesAt).getTime() : Infinity;
  const extended = !!sub?.extensionDueAt;
  if (now < opens) return { state: "not_open" as const, due, extended };
  if (now <= due) return { state: "open" as const, due, extended };
  if (a.latePolicy === "not_accepted") return { state: "closed" as const, due, extended };
  if (now <= Math.max(hardClose, due)) return { state: "late" as const, due, extended };
  return { state: "closed" as const, due, extended };
}

export const LATE_POLICY_TEXT: Record<Assignment["latePolicy"], string> = {
  not_accepted: "Late submissions are not accepted.",
  accepted_with_penalty: "Late submissions are accepted with a penalty.",
  accepted_no_penalty: "Late submissions are accepted without penalty.",
};
