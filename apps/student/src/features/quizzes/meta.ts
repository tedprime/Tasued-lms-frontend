import type { QuizAttempt } from "@tasued/api-client";

export const attemptStateLabel: Record<QuizAttempt["state"], string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  auto_submitted: "Auto-submitted (time up)",
  marked: "Marked",
};

export const attemptKey = (id: string) => ["quiz-attempts", id] as const;
