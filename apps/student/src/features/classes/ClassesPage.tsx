import { PageHeader } from "@tasued/ui";
import { Page, TEAMS_SIGN_IN_HINT } from "../../components/bits";
import { ClassAgenda } from "./ClassAgenda";

export default function ClassesPage() {
  return (
    <Page narrow>
      <PageHeader title="Classes" description={
          <>
            Your live classes run on Microsoft Teams. Join from here, and catch up on recordings after class.
            <span className="mt-1 block font-semibold text-tertiary-500">{TEAMS_SIGN_IN_HINT}</span>
          </>
        } />
      <ClassAgenda showCourseFilter />
    </Page>
  );
}
