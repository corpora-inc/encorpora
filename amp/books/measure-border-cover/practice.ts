import { measureBorderCover } from "./book.js";
import { measurementAlignments } from "./alignments.js";
export interface MeasurementPracticeBinding {
  templateId: string;
  skillId: string;
  bookId: string;
  pageIds: string[];
  assessedResponse: "numeric-result-only";
  practiceScope: string;
  unassessedRequirements: string[];
}
export const measurementPracticeBindings: readonly MeasurementPracticeBinding[] =
  [
    {
      templateId: "rectangle-area",
      skillId: "rectangle-area",
      bookId: measureBorderCover.id,
      pageIds: ["cover-with-squares", "rows-to-area"],
      assessedResponse: "numeric-result-only",
      practiceScope:
        "Return the area in square centimeters of a complete rectangle with displayed integer width and height each from 2 through 15 cm.",
      unassessedRequirements: [
        "A numeric result does not assess an explanation, a constructed unit-square covering, or complete standard mastery.",
        "No perimeter, missing dimension, decomposition, unit conversion, fractional side, or design constraint is assessed by this template.",
      ],
    },
  ];
export function validateMeasurementPracticeBindings(
  templates: readonly {
    id: string;
    skillId: string;
    requiredResponseCapability?: string;
  }[],
  bindings: readonly MeasurementPracticeBinding[] = measurementPracticeBindings,
): void {
  const byId = new Map(templates.map((t) => [t.id, t])),
    pages = new Set(measureBorderCover.pages.map((p) => p.id)),
    seen = new Set<string>();
  for (const b of bindings) {
    const template = byId.get(b.templateId);
    if (!template || template.skillId !== b.skillId || seen.has(b.templateId))
      throw new Error(
        `Invalid measurement template/skill binding: ${b.templateId}`,
      );
    seen.add(b.templateId);
    if (
      template.requiredResponseCapability !== undefined ||
      b.assessedResponse !== "numeric-result-only"
    )
      throw new Error(
        `Book response scope disagrees with template capability: ${b.templateId}`,
      );
    if (
      b.bookId !== measureBorderCover.id ||
      !b.pageIds.length ||
      new Set(b.pageIds).size !== b.pageIds.length ||
      b.pageIds.some((id) => !pages.has(id))
    )
      throw new Error(`Invalid measurement book/page binding: ${b.templateId}`);
    if (
      !b.practiceScope.trim() ||
      !b.unassessedRequirements.length ||
      b.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Missing measurement practice limits: ${b.templateId}`);
    for (const pageId of b.pageIds)
      if (
        !measurementAlignments.some(
          (a) =>
            a.skillId === b.skillId &&
            a.pageIds.includes(pageId) &&
            a.templateIds.includes(b.templateId),
        )
      )
        throw new Error(
          `Practice page outside editorial alignment: ${b.templateId}/${pageId}`,
        );
  }
}
