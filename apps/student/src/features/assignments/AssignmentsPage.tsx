import { PageHeader } from "@tasued/ui";
import { Page } from "../../components/bits";
import { AssignmentList } from "./AssignmentList";

export default function AssignmentsPage() {
  return (
    <Page narrow>
      <PageHeader title="Assignments" description="Each assignment takes one final submission. Save drafts as you go — once you submit, it can't be changed." />
      <AssignmentList />
    </Page>
  );
}
