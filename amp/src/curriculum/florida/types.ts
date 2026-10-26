/**
 * One reconciled Florida benchmark: [id, source locator, original summary,
 * clarification-bounded scope, status, template ids, skill ids, limitation or
 * missing demand, suggested template id, suggested task].
 * Summaries are original; the official standards control meaning.
 */
export type FloridaRow = readonly [
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
