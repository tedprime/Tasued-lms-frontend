import { QuizList } from "../../quizzes/QuizList";
import { useCourseContext } from "../CourseLayout";

export default function QuizzesTab() {
  const { course } = useCourseContext();
  return <QuizList courseId={course.id} />;
}
