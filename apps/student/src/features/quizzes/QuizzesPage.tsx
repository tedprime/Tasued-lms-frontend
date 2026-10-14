import { PageHeader } from "@tasued/ui";
import { Page } from "../../components/bits";
import { QuizList } from "./QuizList";

export default function QuizzesPage() {
  return (
    <Page narrow>
      <PageHeader title="Quizzes" description="Timed quizzes drawn from your course question banks. Answers save as you go and the quiz submits itself when time runs out." />
      <QuizList />
    </Page>
  );
}
