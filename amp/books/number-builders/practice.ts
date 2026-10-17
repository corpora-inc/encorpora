import { numberBuilders } from "./book.js";
import { numberAlignments } from "./alignments.js";
export interface NumberPracticeBinding {
  templateId: string;
  skillId: string;
  bookId: string;
  pageIds: string[];
  assessedResponse: "numeric-result-only";
  practiceScope: string;
  unassessedRequirements: string[];
}
const bind = (
  templateId: string,
  skillId: string,
  pageIds: string[],
  practiceScope: string,
  limits: string[],
): NumberPracticeBinding => ({
  templateId,
  skillId,
  pageIds,
  bookId: numberBuilders.id,
  assessedResponse: "numeric-result-only",
  practiceScope,
  unassessedRequirements: [
    "A numeric result does not assess oral counting, a constructed drawing, an explanation, fluency or complete standard mastery.",
    ...limits,
  ],
});
export const numberPracticeBindings: readonly NumberPracticeBinding[] = [
  bind(
    "count-objects",
    "count-to-20",
    ["count-your-way", "same-seven"],
    "Return the count of a displayed collection of 1–10 dots.",
    [
      "Zero, counts 11–20, one-to-one pointing and conserved rearrangements are not assessed by this template.",
    ],
  ),
  bind(
    "join-within-10",
    "addition-within-10",
    ["join"],
    "Combine positive parts with first 1–8 and positive second part keeping total at most 10; model distinguishes parts by shape.",
    ["No zero addends or learner-created story."],
  ),
  bind(
    "take-away-within-10",
    "subtraction-within-10",
    ["take-away"],
    "Remove 1 through all from a starting 2–10 counters; zero remainder is possible.",
    ["No unknown start/change or constructed removal model."],
  ),
  bind(
    "number-bond-missing",
    "number-bonds",
    ["five-parts", "covered-part"],
    "Find a missing part of a whole 2–10; known part may be 0 or the whole.",
    ["One numeric missing part does not show multiple decompositions."],
  ),
  bind(
    "ten-frame-complement",
    "make-ten",
    ["ten-has-room", "ten-partners"],
    "Return empty places in a ten-frame containing 1–9 counters.",
    ["No empty/full boundary in this runtime family."],
  ),
  bind(
    "teen-frame-compose",
    "teen-place-value",
    ["teen-team", "teen-repair"],
    "Count 10 plus 1–9 extras in two ten-frames.",
    ["No learner-created unit explanation."],
  ),
  bind(
    "tens-ones-model",
    "tens-and-ones",
    ["one-new-unit", "name-twenty-four", "zero-ones"],
    "Read 1–9 canonical tens and 0–9 loose ones; return the value 10–99.",
    [
      "Book pictured rod examples reach six; runtime extends the same unit rule to nine. No noncanonical renaming response.",
    ],
  ),
  bind(
    "ten-more-or-less",
    "ten-more-less",
    ["change-one-ten"],
    "Return ten more or ten less than an integer 20–79, with base-ten model.",
    ["No hundreds boundary or written unit explanation."],
  ),
  bind(
    "subtract-whole-tens",
    "ten-more-less",
    ["tens-as-units"],
    "Subtract a positive whole-ten amount from 10–90, allowingzero result.",
    ["No loose ones or ten-unpacking cases."],
  ),
  bind(
    "unknown-addend-story",
    "missing-addend",
    ["unknown-change-story", "missing-box"],
    "Recover a positive addition change from start 1–15 and final total at most 20.",
    ["Does not ask for a constructed equation or unknown start."],
  ),
  bind(
    "missing-start-story",
    "addition-stories",
    ["unknown-start-story"],
    "Recover starting total 3–20 from positive removed and remaining parts.",
    ["No zero parts, comparison or arbitrary invented story."],
  ),
  bind(
    "add-within-20",
    "addition-within-20",
    ["bridge-add", "near-doubles"],
    "Return a sum at most 20 with first addend 0–19 and second 0 through 20−first.",
    ["No assessed choice of strategy or regrouping explanation."],
  ),
  bind(
    "make-ten-remainder",
    "addition-within-20",
    ["bridge-add", "bridge-add-try"],
    "For first addend 6–9 and second 11−first through 9, return the unused part of the second addend after reaching 10.",
    ["The requested response is an intermediate part, not the final sum."],
  ),
  bind(
    "subtract-within-20",
    "subtraction-within-20",
    ["bridge-subtract", "bridge-subtract-try"],
    "Subtract 0 through all from a starting integer 1–20, with nonnegative result.",
    ["No assessed choice of strategy or constructed explanation."],
  ),
  bind(
    "subtract-through-ten",
    "subtraction-within-20",
    ["bridge-subtract", "bridge-subtract-try"],
    "For starting 11–18 and removal greater than the amount above 10 but at most 9, return the part still to remove after reaching 10.",
    [
      "The requested response is the remaining removal, not the final quantity.",
    ],
  ),
  bind(
    "balanced-addition",
    "equality",
    ["equals"],
    "Find a missing part in a + b = box + c, a from 1–9, b from 1–10, c from 0 through a + b.",
    [
      "No constructed equivalence explanation or reversed solitary-total response.",
    ],
  ),
  bind(
    "add-ones-regroup",
    "add-two-digit",
    ["new-ten", "combine-units"],
    "Add a single-digit amount to 1–8 tens and 2–9 ones, always composing a new ten; total at most 98.",
    [
      "No no-regrouping cases or two-digit addends; the explanation itself is not graded.",
    ],
  ),
];
export function validateNumberPracticeBindings(
  templates: readonly {
    id: string;
    skillId: string;
    requiredResponseCapability?: string;
  }[],
  bindings: readonly NumberPracticeBinding[] = numberPracticeBindings,
): void {
  const byId = new Map(templates.map((t) => [t.id, t])),
    pages = new Set(numberBuilders.pages.map((p) => p.id)),
    seen = new Set<string>();
  for (const b of bindings) {
    const template = byId.get(b.templateId);
    if (!template || template.skillId !== b.skillId || seen.has(b.templateId))
      throw new Error(`Invalid number template/skill binding: ${b.templateId}`);
    seen.add(b.templateId);
    const expected =
      template.requiredResponseCapability === undefined
        ? "numeric-result-only"
        : template.requiredResponseCapability === "single-choice-v1"
          ? "single-choice-selection"
          : null;
    if (b.assessedResponse !== expected)
      throw new Error(
        `Book response scope disagrees with template capability: ${b.templateId}`,
      );
    if (
      b.bookId !== numberBuilders.id ||
      !b.pageIds.length ||
      new Set(b.pageIds).size !== b.pageIds.length ||
      b.pageIds.some((id) => !pages.has(id))
    )
      throw new Error(`Invalid number book/page binding: ${b.templateId}`);
    if (
      !b.practiceScope.trim() ||
      !b.unassessedRequirements.length ||
      b.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Missing number practice limits: ${b.templateId}`);
    for (const pageId of b.pageIds)
      if (
        !numberAlignments.some(
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
