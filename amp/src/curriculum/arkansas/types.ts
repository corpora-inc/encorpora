/**
 * One reconciled Arkansas expectation. Same tuple as the Georgia inventory.
 * Summaries are original; the 2023 standards PDF controls meaning.
 */
export type ArkansasRow = readonly [
  id: string,
  locator: string,
  summary: string,
  scope: string,
  status: "related" | "missing" | "unreviewed",
  templateIds: readonly string[],
  skillIds: readonly string[],
  limitation: string,
  suggestedTemplateId: string,
  suggestedTask: string,
];
