import { useId } from "react";
import { Gauge, KeyRound, Mail, Signal, MonitorPlay } from "lucide-react";
import { errorMessage, type UserPreferences } from "@tasued/api-client";
import { Card, CardBody, CardHeader, Field, PageHeader, Select, Switch, useToast } from "@tasued/ui";
import { usePreferences, useSession, useUpdatePreferences } from "../../app/session";
import { Page } from "../../components/bits";
import { ChangePasswordForm } from "../auth/password";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** Settings — password, data saving, playback and notification preferences. */
export default function SettingsPage() {
  const prefs = usePreferences();
  const { user } = useSession();
  const update = useUpdatePreferences();
  const toast = useToast();
  const speedId = useId();

  const set = (p: Partial<UserPreferences>, msg: string) =>
    update.mutate(p, {
      onSuccess: () => toast.success(msg),
      onError: (e) => toast.error("Couldn't save setting", errorMessage(e)),
    });

  return (
    <Page narrow>
      <PageHeader title="Settings" description="Preferences are saved to your account and follow you to any device." />
      <div className="space-y-6">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Signal className="size-4 text-primary-500" /> Data saving</span>} />
          <CardBody>
            <Switch
              checked={prefs.lowDataMode}
              onChange={(v) => set({ lowDataMode: v }, v ? "Low-data mode on" : "Low-data mode off")}
              label="Low-data mode"
              description="Videos download nothing until you press play, and pictures in course text load only when you tap them. Once playing, class videos stream at full quality and use a lot of data — use Wi-Fi where you can."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><MonitorPlay className="size-4 text-primary-500" /> Video playback</span>} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label={<span className="inline-flex items-center gap-1.5"><Gauge className="size-3.5" /> Playback speed</span>} htmlFor={speedId}>
              <Select id={speedId} value={String(prefs.playbackSpeed)} onChange={(e) => set({ playbackSpeed: Number(e.target.value) }, "Playback speed saved")}>
                {SPEEDS.map((s) => <option key={s} value={s}>{s === 1 ? "Normal (1×)" : `${s}×`}</option>)}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Mail className="size-4 text-primary-500" /> Notifications</span>} />
          <CardBody>
            <Switch
              checked={prefs.emailNotifications}
              onChange={(v) => set({ emailNotifications: v }, v ? "Email notifications on" : "Email notifications off")}
              label="Email notifications"
              description="Get emails for new recordings, class changes, grades and forum replies. Submission receipts are always emailed."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={<span id="change-password" className="flex items-center gap-2"><KeyRound className="size-4 text-primary-500" /> Change password</span>}
            subtitle={<>The password you use with <span className="break-all">{user.email}</span> to sign in to TASUED LMS. Your Microsoft/Teams password is separate.</>}
          />
          <CardBody className="max-w-md">
            <ChangePasswordForm onDone={() => toast.success("Password changed", "Use your new password next time you sign in.")} />
          </CardBody>
        </Card>
      </div>
    </Page>
  );
}
