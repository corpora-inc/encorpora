import { algebraDefinitions } from "./algebra-definitions.js";
import { skills } from "../curriculum/catalog.js";
import { templates } from "../math/engine.js";
import { balanceAlignments } from "../../books/balance-and-change/alignments.js";
import {
  balancePracticeBindings,
  validateBalancePracticeBindings,
} from "../../books/balance-and-change/practice.js";
export const algebraRequirements = algebraDefinitions.map((d) => ({
  id: `algebra.${d.id}`,
  skillId: d.skillId,
  templateIds: [d.id],
  objective: d.description,
  domain: d.domain,
  status:
    d.mode === "choice"
      ? ("partial-selection-practice" as const)
      : ("partial-numeric-practice" as const),
  remainingRequirements:
    "Independent construction, written reasoning, varied contexts and representations, transfer, and durable retrieval require additional assessment. This family does not establish a complete standard or skill.",
}));
export function validateAlgebraCoverage() {
  validateBalancePracticeBindings(templates);
  for (const d of algebraDefinitions) {
    if (!d.domain.trim() || !skills.some((s) => s.id === d.skillId))
      throw new Error(`Invalid algebra domain/skill: ${d.id}`);
    if (
      !balancePracticeBindings.some(
        (b) =>
          b.templateId === d.id &&
          b.skillId === d.skillId &&
          b.pageIds.includes(d.pageId),
      )
    )
      throw new Error(`Missing algebra teaching page: ${d.id}`);
    if (
      !balanceAlignments.some(
        (a) =>
          a.skillId === d.skillId &&
          a.templateIds.includes(d.id) &&
          a.pageIds.includes(d.pageId),
      )
    )
      throw new Error(`Missing algebra editorial alignment: ${d.id}`);
  }
}
