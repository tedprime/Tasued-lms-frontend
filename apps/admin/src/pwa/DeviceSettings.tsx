import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader } from "@tasued/ui";
import { disablePush, enablePush, supportedPush } from "./device";
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
      <CardHeader title="Push notifications on this device" />
      <CardBody className="space-y-4">
        <p className="text-sm">
          Install the staff app for quick access. Administrative work requires
          an internet connection.
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
