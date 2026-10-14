import { useState } from "react";
import { CloudUpload } from "lucide-react";
import type { RecordingStatus } from "@tasued/api-client";
import { Button, SegmentedControl } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { OneDriveNotice, RecordingsTable, UploadRecordingModal } from "./RecordingsTable";

export type StatusFilter = RecordingStatus | "all";
export const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "failed", label: "Failed" },
];

export function RecordingsTab() {
  const courseId = useCourseId();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [uploading, setUploading] = useState(false);
  return (
    <SectionCard
      title="Recordings"
      subtitle="Each Teams class recording is linked from the organiser's OneDrive and published under the class's units."
      action={
        <>
          <SegmentedControl<StatusFilter> value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <Button size="sm" variant="outline" icon={<CloudUpload className="size-4" />} onClick={() => setUploading(true)}>Upload recording</Button>
        </>
      }
    >
      <OneDriveNotice className="mx-5 my-4" />
      <RecordingsTable courseId={courseId} status={status === "all" ? undefined : status} />
      {uploading && <UploadRecordingModal courseId={courseId} onClose={() => setUploading(false)} />}
    </SectionCard>
  );
}
