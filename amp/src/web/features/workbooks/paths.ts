import { createContext, useContext } from "react";

/**
 * Where a learner's workbook day and results open: over the screen that
 * lists them. On the learner's own workbooks (`/learners/<id>/workbooks`)
 * they are its sheets; on a family child's page they are the page's own
 * overlays (`/family/<family>/kids/<id>/workbooks/…`). A fixed set of
 * addresses for the screen, not state: the screen provides it once.
 */
export type WorkbookPaths = {
  /** The list the day and results close back to. */
  list: (learnerId: string) => string;
  day: (learnerId: string, date: string) => string;
  results: (learnerId: string, workbookId: string) => string;
};

export const learnerWorkbookPaths: WorkbookPaths = {
  list: (learnerId) => `learners/${learnerId}/workbooks`,
  day: (learnerId, date) => `learners/${learnerId}/workbooks/${date}`,
  results: (learnerId, workbookId) =>
    `learners/${learnerId}/workbooks/${workbookId}/results`,
};

/** A family child's page, its workbooks its own overlays. */
export const childWorkbookPaths = (family: string): WorkbookPaths => ({
  list: (learnerId) => `family/${family}/kids/${learnerId}`,
  day: (learnerId, date) =>
    `family/${family}/kids/${learnerId}/workbooks/${date}`,
  results: (learnerId, workbookId) =>
    `family/${family}/kids/${learnerId}/workbooks/${workbookId}/results`,
});

export const WorkbookPathsContext =
  createContext<WorkbookPaths>(learnerWorkbookPaths);

export const useWorkbookPaths = () => useContext(WorkbookPathsContext);
