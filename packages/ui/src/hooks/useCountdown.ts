import { useEffect, useState } from "react";

/**
 * Counts down to a server-issued deadline (quiz timers).
 * Based on SLAN's useCountdown, but anchored to an absolute time so a refresh or a
 * backgrounded tab can never give a student extra time.
 */
export function useDeadlineCountdown(deadlineIso: string | undefined, onExpire?: () => void) {
  const calc = () => (deadlineIso ? Math.max(0, Math.round((new Date(deadlineIso).getTime() - Date.now()) / 1000)) : 0);
  const [secondsLeft, setSecondsLeft] = useState(calc);

  useEffect(() => {
    if (!deadlineIso) return;
    setSecondsLeft(calc());
    let fired = false;
    const t = setInterval(() => {
      const s = calc();
      setSecondsLeft(s);
      if (s <= 0 && !fired) {
        fired = true;
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineIso]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return { secondsLeft, isExpired: !!deadlineIso && secondsLeft <= 0, label: `${mm}:${ss}` };
}

/** Plain countdown from N seconds (from SLAN). */
export function useCountdown(initialSeconds = 120) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft((p) => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);
  return {
    timeLeft,
    isCompleted: timeLeft <= 0,
    reset: (s = initialSeconds) => setTimeLeft(s),
    formatTime: () => `${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`,
  };
}
