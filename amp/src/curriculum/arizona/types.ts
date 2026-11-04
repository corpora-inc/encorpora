/**
 * One reconciled Arizona expectation. Same tuple as the Georgia inventory.
 * Summaries are original; the 2016 standards, as printed in the 2025 file,
 * control meaning.
 */
export type ArizonaRow = readonly [
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
