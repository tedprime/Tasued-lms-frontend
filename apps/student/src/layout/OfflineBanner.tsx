import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-warning-50 px-4 py-2 text-xs font-medium text-warning">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You're offline. Use Saved course text to read your downloaded courses; videos, submissions and quizzes need a connection.
    </div>
  );
}
