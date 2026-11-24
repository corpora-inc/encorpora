import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLearningView } from "../../lib/learning-view";
import { LayerWait } from "../../nav/LayerWait";
import { useLayerBack } from "../../ui/LayerControls";
import { Sheet } from "../../ui/Sheet";
import { familyOptions } from "../family/api";
import { familyOf } from "../spaces/identity";
import { canReadWorkbooks } from "./model";
import {
  childWorkbookPaths,
  learnerWorkbookPaths,
  WorkbookPathsContext,
} from "./paths";
import { WorkbookDaySheet } from "./WorkbookDayScreen";
import type { WorkbookLearner } from "./WorkbookFrame";

/**
 * The workbook maker as a layer (nav/LayerHost.tsx, `workbook`): a
 * learner's day, opened from a skill's layer over the screen that skill was
 * opened on. That screen stays behind it; ✕ and Escape put it down to the
 * skill. The same sheet as the day's own address shows
 * (WorkbookDayScreen.tsx), with the same draft (draft-store.ts).
 *
 * Whose: one of this account's own learners, by the rules their own
 * workbooks have; a family's child only for a parent who reads their
 * workbooks. A layer that names anyone else (a stored stack from another
 * account, an edited link) is put down, and logged.
 */
export function WorkbookLayer({
  learner: learnerId,
  date,
}: {
  learner: string;
  date: string;
}) {
  const { pathname } = useLocation();
  const family = familyOf(pathname);
  const view = useLearningView({ records: false });
  const session = view.session.data ?? null;
  // (The family's own guard: a parent's session, and a family named.)
  const household = useQuery(
    familyOptions(session ?? { accountId: "", token: "" }, family ?? ""),
  );
  const down = useLayerBack();
  const account = view.account;
  const entry = account?.family.learners.find(
    (learner) => learner.id === learnerId && !learner.deletedAt,
  );
  const child =
    family && household.data?.familyId === family
      ? household.data.children.find((one) => one.id === learnerId)
      : undefined;
  // (A school's and a class's workbooks are a tab of their own.)
  const may =
    !pathname.startsWith("/school/") &&
    !!entry &&
    canReadWorkbooks(entry) &&
    (!child || child.capabilities.readWorkbooks);
  // Known once the account has answered and, on a family's screen, the
  // family has too (answered or failed: a child is then not shown as one).
  const known = !!account && (!family || !household.isPending);
  const refused = known && !may;
  useEffect(() => {
    if (!refused) return;
    console.warn("A workbook layer this reader may not open was put down", {
      learner: learnerId,
    });
    down?.();
  }, [refused, learnerId, down]);
  if (!account || !entry || !may)
    return (
      <Sheet open tall title="Workbook" onOpenChange={() => {}}>
        <LayerWait />
      </Sheet>
    );
  const learner: WorkbookLearner = {
    ...entry,
    pauseViewer:
      account.account.kind === "student"
        ? "student"
        : entry.simulation
          ? "profile"
          : entry.adult
            ? "adult"
            : "parent",
  };
  return (
    <WorkbookPathsContext.Provider
      value={child ? childWorkbookPaths(family!) : learnerWorkbookPaths}
    >
      <WorkbookDaySheet learner={learner} date={date} />
    </WorkbookPathsContext.Provider>
  );
}
