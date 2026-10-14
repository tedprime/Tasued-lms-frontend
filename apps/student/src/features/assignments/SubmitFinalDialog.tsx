import { useEffect, useId, useState } from "react";
import { AlertTriangle, FileText, Lock } from "lucide-react";
import type { Assignment, Attachment } from "@tasued/api-client";
import { Alert, Checkbox, ConfirmDialog, Field, Input } from "@tasued/ui";

const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();

/**
 * The one-way "Submit final" confirmation. Requires ticking the acknowledgement AND typing
 * the course code (or SUBMIT) before the confirm button enables.
 */
export function SubmitFinalDialog({
  open,
  onClose,
  onConfirm,
  loading,
  error,
  assignment,
  wordCount,
  files,
  late,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error?: string | null;
  assignment: Assignment;
  wordCount: number | null;
  files: Attachment[];
  late: boolean;
}) {
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setAck(false);
      setTyped("");
    }
  }, [open]);

  const typedOk = norm(typed) === "SUBMIT" || norm(typed) === norm(assignment.courseCode);
  const ready = ack && typedOk;

  return (
    <ConfirmDialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      onConfirm={() => ready && onConfirm()}
      confirmDisabled={!ready}
      loading={loading}
      tone="danger"
      title="Submit final — this cannot be undone"
      confirmLabel={<><Lock className="size-4" /> Submit final</>}
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-red-200 bg-danger-50 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <strong>This is your one and only submission.</strong> After you submit, it can never be edited, replaced, withdrawn or reopened —
            not by you, your lecturer or an administrator.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 p-3 text-sm">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">You are submitting</p>
          <ul className="space-y-1 text-tertiary-500">
            {wordCount !== null && <li>Written answer: <strong>{wordCount}</strong> word{wordCount === 1 ? "" : "s"}</li>}
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5"><FileText className="size-3.5 text-neutral-400" /> {f.name}</li>
            ))}
            {wordCount === null && files.length === 0 && <li className="text-neutral-500">Nothing yet</li>}
          </ul>
        </div>

        {late && <Alert tone="amber" title="This submission will be marked late.">{assignment.latePenaltyPercentPerDay ? `A penalty of ${assignment.latePenaltyPercentPerDay}% per day may apply.` : undefined}</Alert>}

        <Checkbox
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          label="I understand this submission is final and cannot be changed by anyone."
        />

        <Field
          label={<>Type <span className="font-mono">{assignment.courseCode}</span> or <span className="font-mono">SUBMIT</span> to confirm</>}
          htmlFor={inputId}
          error={typed && !typedOk ? "That doesn't match yet." : undefined}
        >
          <Input id={inputId} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} placeholder={assignment.courseCode} />
        </Field>

        {error && <Alert tone="red">{error}</Alert>}
      </div>
    </ConfirmDialog>
  );
}
