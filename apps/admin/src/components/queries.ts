import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api, can, type ID } from "@tasued/api-client";
import { useSessionQuery } from "../app/session";

export function useCourseId(): ID {
  const { courseId } = useParams();
  if (!courseId) throw new Error("courseId route param missing");
  return courseId;
}

export function useCourse(id: ID | undefined) {
  return useQuery({ queryKey: ["courses", "get", id], queryFn: () => api.courses.get(id!), enabled: !!id });
}

export function useModules(courseId: ID | undefined) {
  return useQuery({ queryKey: ["content", "modules", courseId], queryFn: () => api.content.modules(courseId!), enabled: !!courseId });
}

/** Courses the signed-in staff member can act on (API scopes the list; we also filter by staffCourseIds for non-admins). */
export function useCoursesInScope() {
  const { data: session } = useSessionQuery();
  return useQuery({
    queryKey: ["courses", "list", "scope"],
    queryFn: () => api.courses.list({ pageSize: 200 }),
    select: (p) =>
      can(session, "courses.manage") ? p.items : p.items.filter((o) => session?.staffCourseIds.includes(o.id)),
    enabled: !!session,
  });
}

/** Map unit id → title for a course. */
export function useUnitTitles(courseId: ID | undefined) {
  const q = useModules(courseId);
  const map = new Map<ID, string>();
  q.data?.forEach((m) => m.units.forEach((u) => map.set(u.id, u.title)));
  return map;
}
