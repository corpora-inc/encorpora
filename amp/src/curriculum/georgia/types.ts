/**
 * One reconciled Georgia expectation: [id, source locator, original summary,
 * bounded scope, status, template ids, skill ids, limitation, suggested
 * template id, suggested task]. Summaries are original; the official standards
 * control meaning. Status "related" is partial practice, never coverage.
 */
export type GeorgiaRow = readonly [
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
