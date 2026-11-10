import type { UseQueryResult } from "@tanstack/react-query";
import type { WorkbookSummary } from "../../../../workbook/contracts";
import { WorkbookEntry } from "../../workbooks/WorkbookEntry";
import { WorkbookList } from "../../workbooks/WorkbookList";
import { workbooks } from "../fixtures";
import { Section, Specimen } from "../Gallery";

type History = { workbooks: WorkbookSummary[]; pdf: boolean };
/** WorkbookList reads a query result; the gallery hands it a settled one. */
function query(
  state: { data: History } | { error: Error } | "pending",
): UseQueryResult<History> {
  const settled =
    state === "pending" ? { data: undefined, error: null } : state;
  return {
    data: undefined,
    error: null,
    ...settled,
    refetch: () => Promise.resolve(undefined),
  } as unknown as UseQueryResult<History>;
}
const session = { token: "", accountId: "design" };
const learner = (access: { hasAccess: boolean; name?: string }) => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: access.name ?? "Ada",
  canPractice: true,
  learningAllowed: true,
  hasAccess: access.hasAccess,
});

export function WorkbookSections() {
  return (
    <>
      <Section
        id="workbook-card"
        title="Workbook card"
        source={[
          "features/workbooks/WorkbookEntry.tsx",
          "features/workbooks/WorkbookEntry.module.css",
        ]}
      >
        <Specimen label="Can make a workbook" plain>
          <WorkbookEntry learner={learner({ hasAccess: true })} />
        </Specimen>
        <Specimen label="Free workbooks used: past ones only" plain>
          <WorkbookEntry
            learner={{
              ...learner({ hasAccess: false }),
              freeAllowance: {
                problems: { total: 100, used: 100, remaining: 0 },
                workbooks: {
                  total: 5,
                  earned: 5,
                  made: 5,
                  available: 0,
                  nextAt: null,
                },
              },
            }}
          />
        </Specimen>
        <Specimen label="A long name" wide plain>
          <WorkbookEntry
            learner={learner({
              hasAccess: true,
              name: "Esperanza Villanueva-Castellanos",
            })}
          />
        </Specimen>
      </Section>
      <Section
        id="workbook-list"
        title="Past workbooks"
        source={[
          "features/workbooks/WorkbookList.tsx",
          "features/workbooks/Workbooks.module.css",
        ]}
        note="Inert here: Download asks the server for the file."
      >
        <Specimen label="Three workbooks, one with choices" wide>
          <div inert>
            <WorkbookList
              session={session}
              learnerId={learner({ hasAccess: true }).id}
              query={query({ data: { workbooks, pdf: true } })}
            />
          </div>
        </Specimen>
        <Specimen label="Two workbooks" wide>
          <div inert>
            <WorkbookList
              session={session}
              learnerId={learner({ hasAccess: true }).id}
              query={query({
                data: { workbooks: workbooks.slice(0, 2), pdf: true },
              })}
            />
          </div>
        </Specimen>
        <Specimen label="Loading">
          <div inert>
            <WorkbookList
              session={session}
              learnerId={learner({ hasAccess: true }).id}
              query={query("pending")}
            />
          </div>
        </Specimen>
        <Specimen label="Failed to load">
          <div inert>
            <WorkbookList
              session={session}
              learnerId={learner({ hasAccess: true }).id}
              query={query({ error: new Error("Network error") })}
            />
          </div>
        </Specimen>
        <Specimen label="None yet">
          <div inert>
            <WorkbookList
              session={session}
              learnerId={learner({ hasAccess: true }).id}
              query={query({ data: { workbooks: [], pdf: true } })}
            />
          </div>
        </Specimen>
      </Section>
    </>
  );
}
