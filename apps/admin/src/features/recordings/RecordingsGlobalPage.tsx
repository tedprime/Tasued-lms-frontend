import { useSearchParams } from "react-router-dom";
import { PageHeader, SegmentedControl } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { OneDriveNotice, RecordingsTable } from "./RecordingsTable";
import { STATUS_OPTIONS, type StatusFilter } from "./RecordingsTab";

export function RecordingsGlobalPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") as StatusFilter | null) ?? "all";
  const courseId = params.get("course") ?? "";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v && v !== "all") next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  return (
    <div>
      <PageHeader title="Recordings" description="Class recordings across all courses. If a recording isn't found, search OneDrive again or upload the MP4." />
      <OneDriveNotice className="mb-4" />
      <SectionCard
        action={
          <div className="flex w-full flex-wrap items-center gap-2">
            <SegmentedControl<StatusFilter> value={status} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
            <div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={(v) => set("course", v)} /></div>
          </div>
        }
      >
        <RecordingsTable courseId={courseId || undefined} status={status === "all" ? undefined : status} showCourse />
      </SectionCard>
    </div>
  );
}
