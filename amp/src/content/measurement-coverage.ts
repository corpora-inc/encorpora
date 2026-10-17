import { measurementDefinitions } from "./measurement-definitions.js";
import { skills } from "../curriculum/catalog.js";
import { templates } from "../math/engine.js";
import { measurementAlignments } from "../../books/measure-border-cover/alignments.js";
import {
  measurementPracticeBindings,
  validateMeasurementPracticeBindings,
} from "../../books/measure-border-cover/practice.js";
export const measurementRequirements = measurementDefinitions.map((d) => ({
  id: `measurement.${d.id}`,
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
export function validateMeasurementCoverage() {
  validateMeasurementPracticeBindings(templates);
  for (const d of measurementDefinitions) {
    if (!d.domain.trim() || !skills.some((s) => s.id === d.skillId))
      throw new Error(`Invalid measurement domain/skill: ${d.id}`);
    if (
      !measurementPracticeBindings.some(
        (b) =>
          b.templateId === d.id &&
          b.skillId === d.skillId &&
          b.pageIds.includes(d.pageId),
      )
    )
      throw new Error(`Missing measurement teaching page: ${d.id}`);
    if (
      !measurementAlignments.some(
        (a) =>
          a.skillId === d.skillId &&
          a.templateIds.includes(d.id) &&
          a.pageIds.includes(d.pageId),
      )
    )
      throw new Error(`Missing measurement editorial alignment: ${d.id}`);
  }
}
