import { DeviceSettings } from "../../pwa/DeviceSettings";
import { useState } from "react";
import { api, ROLE_LABELS } from "@tasued/api-client";
import { Avatar, Badge, Button, Field, Input, KeyValue, PageHeader, Switch } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { useSession } from "../../app/session";
import { scopeLabel } from "../../layout/Header";

export function ProfilePage() {
  const session = useSession();
  const u = session.user;
  const [phone, setPhone] = useState(u.phone ?? "");
  const [phoneError, setPhoneError] = useState<string>();
  const saveProfile = useApiMutation({ mutationFn: () => api.auth.updateProfile({ phone: phone.trim() || undefined }), success: "Profile updated", invalidate: [["auth", "session"]] });
  const prefs = useApiMutation({ mutationFn: (emailNotifications: boolean) => api.auth.updatePreferences({ emailNotifications }), success: "Preferences saved", invalidate: [["auth", "session"]] });

  return (
    <div className="space-y-5">
      <PageHeader title="My profile" description="Your name, email and photo come from Microsoft 365." />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard bodyClassName="p-5">
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={u.fullName} src={u.avatarUrl} size={64} />
            <div>
              <p className="font-headline text-xl font-extrabold text-tertiary-500">{u.fullName}</p>
              <p className="text-sm text-neutral-500">{u.email}</p>
            </div>
          </div>
          <KeyValue items={[{ label: "Staff ID", value: u.staffId ?? "—" }, { label: "Department", value: u.department ?? "—" }]} />
          <form className="mt-5 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (phone && !/^\+?[0-9 ]{7,16}$/.test(phone)) return setPhoneError("Enter a valid phone number"); setPhoneError(undefined); saveProfile.mutate(undefined); }}>
            <Field className="flex-1" label="Phone" error={phoneError} htmlFor="pf-phone"><Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!phoneError} /></Field>
            <Button type="submit" variant="outline" loading={saveProfile.isPending}>Save</Button>
          </form>
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="Roles & scopes">
            <ul className="divide-y divide-neutral-100">
              {u.roles.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                  <Badge tone={r.role === "super_admin" ? "gold" : "green"}>{ROLE_LABELS[r.role]}</Badge>
                  <span className="text-neutral-600">{scopeLabel(r)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">{session.permissions.length} permissions · staff on {session.staffCourseIds.length} course(s)</p>
          </SectionCard>
          <DeviceSettings />
          <SectionCard title="Notifications" bodyClassName="p-5">
            <Switch checked={session.preferences.emailNotifications} onChange={(v) => prefs.mutate(v)} disabled={prefs.isPending} label="Email notifications" description="Recording failures, attendance to review and new reports." />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
