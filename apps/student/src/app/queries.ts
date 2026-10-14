import { useQuery } from "@tanstack/react-query";
import { api, type ID, type Module, type UnitProgress, type UnitSummary } from "@tasued/api-client";

/** Shared query hooks used by several features (sidebar tree, course pages, unit page). */

export function useMyCourses() {
  return useQuery({
    queryKey: ["courses", "mine"],
    queryFn: () => api.courses.list({ pageSize: 100 }),
    select: (d) => d.items,
  });
}

export function useCourse(id: ID | undefined) {
  return useQuery({ queryKey: ["courses", id], queryFn: () => api.courses.get(id!), enabled: !!id });
}

export function useModules(courseId: ID | undefined, enabled = true) {
  return useQuery({
    queryKey: ["content", "modules", courseId],
    queryFn: () => api.content.modules(courseId!),
    enabled: !!courseId && enabled,
    select: (mods: Module[]) =>
      [...mods]
        .filter((m) => m.state === "published")
        .sort((a, b) => a.order - b.order)
        .map((m) => ({ ...m, units: [...m.units].filter((u) => u.state === "published").sort((a, b) => a.order - b.order) })),
  });
}

export function useCourseProgress(courseId: ID | undefined, enabled = true) {
  return useQuery({
    queryKey: ["courses", courseId, "progress"],
    queryFn: () => api.courses.progress(courseId!),
    enabled: !!courseId && enabled,
  });
}

export function progressMap(list: UnitProgress[] | undefined) {
  const m = new Map<ID, UnitProgress>();
  list?.forEach((p) => m.set(p.unitId, p));
  return m;
}

/** % of units completed for a course. */
export function completionPercent(list: UnitProgress[] | undefined, unitCount: number) {
  if (!unitCount) return 0;
  const done = list?.filter((p) => p.completed).length ?? 0;
  return Math.round((done / unitCount) * 100);
}

export function flattenUnits(mods: Module[] | undefined): (UnitSummary & { moduleTitle: string })[] {
  return mods?.flatMap((m) => m.units.map((u) => ({ ...u, moduleTitle: m.title }))) ?? [];
}

export function useMyAttendance() {
  return useQuery({ queryKey: ["attendance", "mine"], queryFn: () => api.attendance.mine() });
}

export function useMyGrades() {
  return useQuery({ queryKey: ["grades", "mine"], queryFn: () => api.grades.mine() });
}
