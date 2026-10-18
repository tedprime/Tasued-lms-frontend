import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, CardBody, CardHeader } from "@tasued/ui";
import { useSession } from "../app/session";
import {
  disablePush,
  enablePush,
  downloadCourse,
  supportedPush,
} from "./device";
import { installPrompt, forgetInstallPrompt } from "./install";
export function DeviceSettings() {
  const [prompt, setPrompt] = useState(installPrompt),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => setPrompt(installPrompt);
    window.addEventListener("lms-install-ready", refresh);
    if (supportedPush())
      void navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setEnabled(!!s))
        .catch(() => undefined);
    return () => window.removeEventListener("lms-install-ready", refresh);
  }, []);
  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (enabled) await disablePush();
      else await enablePush();
      setEnabled(!enabled);
      setMessage(
        enabled
          ? "Notifications turned off on this device."
          : "Notifications enabled on this device.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not change notifications.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader title="This device" />
      <CardBody className="space-y-4">
        <p className="text-sm">
          Install the student app and save course text for reading without
          internet.
        </p>
        {prompt ? (
          <Button
            onClick={() =>
              void prompt
                .prompt()
                .then(() => prompt.userChoice)
                .then(() => {
                  forgetInstallPrompt();
                  setPrompt(null);
                })
            }
          >
            Install app
          </Button>
        ) : (
          <p className="text-sm text-neutral-500">
            Use your browser’s Install app or Add to Home Screen option when
            available.
          </p>
        )}
        <div>
          <Link className="text-primary-500 underline" to="/offline">
            Open saved course text
          </Link>
        </div>
        <p className="text-sm">
          Push alerts are optional on each device. They show a general alert;
          open the app to read the details.
        </p>
        <Button
          disabled={busy || !supportedPush()}
          onClick={() => void toggle()}
        >
          {busy
            ? "Updating…"
            : enabled
              ? "Turn off push notifications"
              : "Enable push notifications"}
        </Button>
        {!supportedPush() && (
          <p className="text-sm">
            This browser does not currently support push. On supported iPhones,
            add the app to your Home Screen first.
          </p>
        )}
        <p role="status" className="text-sm">
          {message}
        </p>
      </CardBody>
    </Card>
  );
}
export function SaveCourse({ courseId }: { courseId: string }) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    try {
      await downloadCourse(courseId, user.id, setMessage);
      setMessage("Course text saved for 30 days. Save again to refresh it.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not save course text.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="my-4 space-y-2">
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save course text offline"}
        </Button>
        <Link className="text-sm text-primary-500 underline" to="/offline">
          Saved courses
        </Link>
      </div>
      <p className="text-xs text-neutral-500">
        Text only. Videos, attachments, assessments and progress need internet.
        Sign out to erase saved text on this device.
      </p>
      <p className="text-sm" role="status">
        {message}
      </p>
    </div>
  );
}
