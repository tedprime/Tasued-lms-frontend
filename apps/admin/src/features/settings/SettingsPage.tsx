import { blocksCachedData } from "@tasued/api-client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage, type LatePolicy, type PlatformSettings } from "@tasued/api-client";
import { Button, ErrorState, Field, Input, PageHeader, PageLoader, Select } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";

export function SettingsPage() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api.settings.get() });
  if (q.isPending) return <PageLoader />;
  if (q.isError && (q.data === undefined || blocksCachedData(q.error))) return <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <SettingsForm s={q.data} />;
}

type F = { institutionName: string; threshold: string; late: string; defaultLatePolicy: LatePolicy; maxUploadMb: string; organiser: string; minPassword: string; supportEmail: string };

function SettingsForm({ s }: { s: PlatformSettings }) {
  const initial: F = {
    institutionName: s.institutionName,
    threshold: String(s.attendanceRule.presentThresholdPercent),
    late: String(s.attendanceRule.lateAfterMinutes),
    defaultLatePolicy: s.defaultLatePolicy,
    maxUploadMb: String(s.maxUploadMb),
    organiser: s.organiserAccountEmail ?? "",
    minPassword: String(s.minPasswordLength ?? 8),
    supportEmail: s.supportEmail,
  };
  const [f, setF] = useState<F>(initial);
  const [errors, setErrors] = useState<Errors<keyof F>>({});
  const [baseline, setBaseline] = useState(initial);
  const dirty = JSON.stringify(f) !== JSON.stringify(baseline);
  const incoming = JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) { const next = JSON.parse(incoming) as F; setF(next); setBaseline(next); }
  }, [incoming, dirty]);
  const save = useApiMutation({
    mutationFn: (f: F) =>
      api.settings.update({
        institutionName: f.institutionName.trim(),
        attendanceRule: { presentThresholdPercent: Number(f.threshold), lateAfterMinutes: Number(f.late) },
        defaultLatePolicy: f.defaultLatePolicy,
        maxUploadMb: Number(f.maxUploadMb),
        organiserAccountEmail: f.organiser.trim().toLowerCase(),
        minPasswordLength: Number(f.minPassword),
        supportEmail: f.supportEmail.trim(),
      }),
    success: "Settings saved",
    onSuccess: (_result, submitted) => setBaseline(submitted),
    invalidate: [["settings"]],
  });
  const submit = () => {
    const n = (v: string) => Number(v);
    const e: Errors<keyof F> = {
      institutionName: f.institutionName.trim() ? undefined : "Required",
      threshold: n(f.threshold) >= 1 && n(f.threshold) <= 100 ? undefined : "1–100",
      late: n(f.late) >= 0 && n(f.late) <= 120 ? undefined : "0–120",
      maxUploadMb: n(f.maxUploadMb) >= 1 && n(f.maxUploadMb) <= 2048 ? undefined : "1–2048",
      organiser: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.organiser.trim()) ? undefined : "Enter the organiser account's email",
      minPassword: Number.isInteger(n(f.minPassword)) && n(f.minPassword) >= 8 && n(f.minPassword) <= 64 ? undefined : "A whole number from 8 to 64",
      supportEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.supportEmail.trim()) ? undefined : "Enter a valid email",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate({ ...f });
  };
  const set = (k: keyof F) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <PageHeader title="Settings" description="Platform-wide defaults. Changes are recorded in the audit log." actions={<><Button variant="outline" disabled={!dirty} onClick={() => { setF(initial); setBaseline(initial); setErrors({}); }}>Discard</Button><Button type="submit" disabled={!dirty} loading={save.isPending}>Save settings</Button></>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Institution" bodyClassName="space-y-4 p-5">
          <Field label="Institution name" required error={errors.institutionName} htmlFor="st-name"><Input id="st-name" value={f.institutionName} onChange={set("institutionName")} invalid={!!errors.institutionName} /></Field>
          <Field label="Support email" required error={errors.supportEmail} htmlFor="st-email" hint="Shown to students and staff on help pages."><Input id="st-email" type="email" value={f.supportEmail} onChange={set("supportEmail")} invalid={!!errors.supportEmail} /></Field>
        </SectionCard>
        <SectionCard title="Attendance rule" subtitle="Applied when a Teams attendance report is imported." bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Present if attended at least (%)" required error={errors.threshold} htmlFor="st-thr"><Input id="st-thr" type="number" min={1} max={100} value={f.threshold} onChange={set("threshold")} invalid={!!errors.threshold} /></Field>
          <Field label="Late if joined after (minutes)" required error={errors.late} htmlFor="st-late"><Input id="st-late" type="number" min={0} max={120} value={f.late} onChange={set("late")} invalid={!!errors.late} /></Field>
        </SectionCard>
        <SectionCard title="Assignments" bodyClassName="space-y-4 p-5">
          <Field label="Default late policy" htmlFor="st-lp" hint="Pre-selected when creating an assignment.">
            <Select id="st-lp" value={f.defaultLatePolicy} onChange={(e) => setF({ ...f, defaultLatePolicy: e.target.value as LatePolicy })}>
              <option value="not_accepted">Not accepted</option>
              <option value="accepted_with_penalty">Accepted with a penalty</option>
              <option value="accepted_no_penalty">Accepted, no penalty</option>
            </Select>
          </Field>
          <Field label="Max upload size (MB)" required error={errors.maxUploadMb} htmlFor="st-up" hint="Applies to attachments and submission files."><Input id="st-up" type="number" min={1} value={f.maxUploadMb} onChange={set("maxUploadMb")} invalid={!!errors.maxUploadMb} /></Field>
        </SectionCard>
        <SectionCard title="Classes & recordings" subtitle="Recordings are streamed from the organiser's OneDrive. Nothing is copied — don't delete files from OneDrive." bodyClassName="space-y-4 p-5">
          <Field label="Meeting organiser account" required error={errors.organiser} htmlFor="st-org" hint="Class meetings are created under this account so every recording lands in one OneDrive."><Input id="st-org" type="email" value={f.organiser} onChange={set("organiser")} invalid={!!errors.organiser} placeholder="lms-classes@tedprimehub.org" /></Field>
        </SectionCard>
        <SectionCard title="Student sign-in" subtitle="Students sign in to the LMS with an email and password. Staff sign in with Microsoft." bodyClassName="space-y-4 p-5">
          <Field label="Minimum password length" required error={errors.minPassword} htmlFor="st-pw" hint="At least 8 characters. Applies when students set or change their LMS password."><Input id="st-pw" type="number" min={8} max={64} value={f.minPassword} onChange={set("minPassword")} invalid={!!errors.minPassword} /></Field>
        </SectionCard>
      </div>
    </form>
  );
}
