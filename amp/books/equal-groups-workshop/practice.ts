import { equalGroupsWorkshop } from "./book.js";
import { equalGroupsAlignments } from "./alignments.js";
export interface WorkshopPracticeBinding {
  templateId: string;
  skillId: string;
  bookId: string;
  pageIds: string[];
  assessedResponse: "numeric-result-only";
  practiceScope: string;
  unassessedRequirements: string[];
}
/** Related calculation practice is narrower than the book's constructed responses. */
export const equalGroupsPracticeBindings: readonly WorkshopPracticeBinding[] = [
  {
    templateId: "multiply-facts",
    practiceScope:
      "Factors range from 2 through 12; this includes extensions beyond one-digit facts and omits zero and one.",
    skillId: "multiplication-facts",
    bookId: equalGroupsWorkshop.id,
    pageIds: ["twos-fives-tens", "split-five", "fluency-routine"],
    assessedResponse: "numeric-result-only",
    unassessedRequirements: [
      "The template checks a numeric product, not a learner-created model or strategy explanation.",
      "One generated answer does not establish delayed recall across every one-digit product.",
    ],
  },
  {
    templateId: "divide-facts",
    practiceScope:
      "Divisor and quotient range from 2 through 12, with dividends through 144 and no remainder.",
    skillId: "division-facts",
    bookId: equalGroupsWorkshop.id,
    pageIds: ["inverse", "measure-groups", "division-workshop"],
    assessedResponse: "numeric-result-only",
    unassessedRequirements: [
      "The template checks a whole-number quotient, not the distinction between sharing and group measurement.",
      "Remainder decisions, constructed contexts, and explanation of units need separate review.",
    ],
  },
  {
    templateId: "rectangle-area",
    practiceScope:
      "Whole-centimeter rectangle sides range from 2 through 15; the response is an area in square centimeters.",
    skillId: "rectangle-area",
    bookId: equalGroupsWorkshop.id,
    pageIds: ["area-units", "split-area"],
    assessedResponse: "numeric-result-only",
    unassessedRequirements: [
      "The template checks a rectangular area number, not learner-created tiling or distributive justification.",
      "A rectangle template does not cover composite rectilinear figures or all area units.",
    ],
  },
];
export function validateEqualGroupsPracticeBindings(
  templates: readonly { id: string; skillId: string }[],
  bindings: readonly WorkshopPracticeBinding[] = equalGroupsPracticeBindings,
): void {
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const pages = new Set(equalGroupsWorkshop.pages.map((p) => p.id));
  const seen = new Set<string>();
  for (const binding of bindings) {
    const template = templateMap.get(binding.templateId);
    if (!template || template.skillId !== binding.skillId)
      throw new Error(
        `Practice template/skill mismatch: ${binding.templateId}`,
      );
    if (seen.has(binding.templateId))
      throw new Error(`Duplicate practice binding: ${binding.templateId}`);
    seen.add(binding.templateId);
    if (
      binding.bookId !== equalGroupsWorkshop.id ||
      !binding.pageIds.length ||
      binding.pageIds.some((id) => !pages.has(id))
    )
      throw new Error(`Invalid practice book/page: ${binding.templateId}`);
    if (
      binding.assessedResponse !== "numeric-result-only" ||
      !binding.practiceScope.trim() ||
      !binding.unassessedRequirements.length ||
      binding.unassessedRequirements.some((x) => !x.trim())
    )
      throw new Error(`Missing practice limitations: ${binding.templateId}`);
    if (
      binding.pageIds.some(
        (pageId) =>
          !equalGroupsAlignments.some(
            (a) => a.skillId === binding.skillId && a.pageIds.includes(pageId),
          ),
      )
    )
      throw new Error(
        `Practice page lacks skill alignment: ${binding.templateId}`,
      );
    if (
      !equalGroupsAlignments.some(
        (a) =>
          a.skillId === binding.skillId &&
          a.templateIds.includes(binding.templateId),
      )
    )
      throw new Error(
        `Practice lacks editorial alignment: ${binding.templateId}`,
      );
  }
}
