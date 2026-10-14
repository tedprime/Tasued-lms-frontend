import { BookOpen, FileText, MessagesSquare, ClipboardList, Timer, Video, type LucideIcon } from "lucide-react";
import type { SearchHit } from "@tasued/api-client";

export const searchTypeIcon: Record<SearchHit["type"], LucideIcon> = {
  course: BookOpen,
  unit: FileText,
  recording: Video,
  thread: MessagesSquare,
  assignment: ClipboardList,
  quiz: Timer,
};

export const searchTypeLabel: Record<SearchHit["type"], string> = {
  course: "Course",
  unit: "Unit",
  recording: "Recording",
  thread: "Forum thread",
  assignment: "Assignment",
  quiz: "Quiz",
};
