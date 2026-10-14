import { Printer, ShieldCheck } from "lucide-react";
import { fmtDate, type Assignment, type Submission } from "@tasued/api-client";
import { Button } from "@tasued/ui";
import { useSession } from "../../app/session";

/** Printable submission receipt. Only #print-receipt is visible when printing (see index.css). */
export function ReceiptCard({ assignment, submission }: { assignment: Assignment; submission: Submission }) {
  const { user } = useSession();
  const at = submission.submittedAt;
  return (
    <section id="print-receipt" aria-labelledby="receipt-h" className="overflow-hidden rounded-xl border-2 border-primary-500 bg-white">
      <div className="flex items-center gap-3 bg-primary-500 px-5 py-3 text-white">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        <h2 id="receipt-h" className="font-headline text-base font-extrabold">Submission receipt</h2>
        <Button variant="secondary" size="xs" className="ml-auto print:hidden" onClick={() => window.print()} icon={<Printer className="size-3.5" />}>
          Print
        </Button>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-medium text-neutral-500">Receipt code</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tracking-wider break-all text-tertiary-500 select-all">{submission.receiptCode ?? "—"}</p>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Assignment</dt>
            <dd className="font-semibold text-tertiary-500">{assignment.courseCode} · {assignment.title}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Student</dt>
            <dd className="font-semibold text-tertiary-500">{user.fullName}{user.matricNumber ? ` (${user.matricNumber})` : ""}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Submitted</dt>
            <dd className="font-semibold text-tertiary-500">
              {at ? <time dateTime={at}>{fmtDate(at, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })} (WAT)</time> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Status</dt>
            <dd className="font-semibold text-tertiary-500">Final{submission.isLate ? " · late" : " · on time"}</dd>
          </div>
          {submission.files.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">Files</dt>
              <dd className="font-semibold text-tertiary-500">{submission.files.map((f) => f.name).join(", ")}</dd>
            </div>
          )}
        </dl>
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          This submission is final. It cannot be edited, replaced or withdrawn by you, your lecturer or an administrator. A copy of this receipt has been emailed to {user.email}.
        </p>
      </div>
    </section>
  );
}
