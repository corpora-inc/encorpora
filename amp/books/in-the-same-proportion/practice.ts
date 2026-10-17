import { inTheSameProportion } from "./book.js";
import { ratioAlignments } from "./alignments.js";
export interface RatioPracticeBinding {
  templateId: string;
  skillId: string;
  bookId: string;
  pageIds: string[];
  assessedResponse: "numeric-result-only";
  practiceScope: string;
  unassessedRequirements: string[];
}
export const ratioPracticeBindings: readonly RatioPracticeBinding[] = [
  {
    templateId: "ratio-missing",
    skillId: "ratios",
    bookId: inTheSameProportion.id,
    pageIds: ["scale-both-quantities"],
    assessedResponse: "numeric-result-only",
    practiceScope:
      "Scale a same-unit paint ratio: first amount 1–8 cups, second 2–9 cups, positive integer multiplier 2–8; return the scaled first amount.",
    unassessedRequirements: [
      "Does not assess ratio language, part-to-whole interpretation, fractional scale factors, chosen domains or a constructed explanation.",
    ],
  },
  {
    templateId: "unit-price",
    skillId: "proportional-relationships",
    bookId: inTheSameProportion.id,
    pageIds: ["price-per-one"],
    assessedResponse: "numeric-result-only",
    practiceScope:
      "Find a total price at the same unit rate: initial notebook count 2–10, integer price 2–12 dollars each, target count 2–12.",
    unassessedRequirements: [
      "Does not assess fractional unit prices, whole-pack decisions, fixed fees, model selection, graph construction or reasoning.",
    ],
  },
  {
    templateId: "percent-of",
    skillId: "percentages",
    bookId: inTheSameProportion.id,
    pageIds: ["find-the-percent-part"],
    assessedResponse: "numeric-result-only",
    practiceScope:
      "Find an exact percent part: integer percentage 1–95 and whole-number reference quantity 2–200; answer may be fractional.",
    unassessedRequirements: [
      "Does not assess recovering a missing whole or percent, changing bases, a constructed diagram, explanation or complete standard.",
    ],
  },
];
export function validateRatioPracticeBindings(
  templates: readonly {
    id: string;
    skillId: string;
    requiredResponseCapability?: string;
  }[],
  bindings: readonly RatioPracticeBinding[] = ratioPracticeBindings,
): void {
  const byId = new Map(templates.map((t) => [t.id, t])),
    pages = new Set(inTheSameProportion.pages.map((p) => p.id)),
    seen = new Set<string>();
  for (const b of bindings) {
    const template = byId.get(b.templateId);
    if (!template || template.skillId !== b.skillId || seen.has(b.templateId))
      throw new Error(`Invalid ratio template/skill binding: ${b.templateId}`);
    seen.add(b.templateId);
    if (
      template.requiredResponseCapability !== undefined ||
      b.assessedResponse !== "numeric-result-only"
    )
      throw new Error(
        `Book response scope disagrees with template capability: ${b.templateId}`,
      );
    if (
      b.bookId !== inTheSameProportion.id ||
      !b.pageIds.length ||
      new Set(b.pageIds).size !== b.pageIds.length ||
      b.pageIds.some((id) => !pages.has(id))
    )
      throw new Error(`Invalid ratio book/page binding: ${b.templateId}`);
    if (
      !b.practiceScope.trim() ||
      !b.unassessedRequirements.length ||
      b.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Missing ratio practice limits: ${b.templateId}`);
    for (const pageId of b.pageIds)
      if (
        !ratioAlignments.some(
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
