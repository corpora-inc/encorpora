import { balanceAndChange } from "./book.js";
import { balanceAlignments } from "./alignments.js";
export interface AlgebraPracticeBinding {
  templateId: string;
  skillId: string;
  bookId: string;
  pageIds: string[];
  assessedResponse: "numeric-result-only" | "single-choice-selection";
  practiceScope: string;
  unassessedRequirements: string[];
}
const numericLimit =
  "A numeric result does not assess a constructed equation, graph, explanation, or complete standard.";
const choiceLimit =
  "Selecting an option does not assess a constructed explanation, equation, or graph; a correct selection alone does not establish mastery.";
const bind = (
  templateId: string,
  skillId: string,
  pageIds: string[],
  practiceScope: string,
  limits: string[],
  choice = false,
): AlgebraPracticeBinding => ({
  templateId,
  skillId,
  pageIds,
  bookId: balanceAndChange.id,
  assessedResponse: choice ? "single-choice-selection" : "numeric-result-only",
  practiceScope,
  unassessedRequirements: [choice ? choiceLimit : numericLimit, ...limits],
});
export const balancePracticeBindings: readonly AlgebraPracticeBinding[] = [
  bind(
    "linear-equation",
    "linear-equations",
    ["two-step", "check-original"],
    "Solve ax + b = c with a from 2–12, b from 1–20, and generated integer solution x from −12 through 12.",
    [
      "No negative coefficients, noninteger solutions, grouped expressions or both-side variables in this template.",
    ],
  ),
  bind(
    "line-slope",
    "slope",
    ["slope", "reverse-rate"],
    "Find exact slope from two written points: first coordinates −8 through 8, positive horizontal change 1–8, vertical change −8 through 8.",
    [
      "Vertical lines are excluded; the response does not assess geometric similarity or units.",
    ],
  ),
  bind(
    "graphed-line-slope",
    "slope",
    ["slope", "reverse-rate"],
    "Read a unit-grid graph with first x from −4 through −1, second x from 1–4, and y values from −4 through 4, then return exact slope.",
    ["Vertical lines and varied axis scales are excluded."],
  ),
  bind(
    "linear-system-x",
    "linear-systems",
    ["elimination", "system"],
    "Find x only in a nonsingular two-equation system with positive integer coefficients and integer x,y from −8 through 8; the adjusted final coefficient can reach 6.",
    [
      "Does not assess a complete ordered-pair response, no-solution or infinitely-many cases, or learner-created context.",
    ],
  ),
  bind(
    "coordinate-point-reading",
    "coordinate-four-quadrants",
    ["coordinates", "coordinate-studio"],
    "Read one requested coordinate of a labeled point with x,y from −4 through 4 on a unit grid.",
    [
      "Does not assess an independently constructed plot, nonunit scales or coordinate distance.",
    ],
  ),
  bind(
    "unit-price",
    "proportional-relationships",
    ["unit-rate", "proportional"],
    "Infer an integer unit price 2–12 from 2–10 items, then calculate the cost of 2–12 items at the same price.",
    [
      "No fixed starting fee, fractional unit price or learner-created proportionality argument.",
    ],
  ),
  bind(
    "equation-solution-count",
    "linear-equations",
    ["real-solution-sets", "false-move"],
    "Select one, no, or infinitely many real solutions for ax + b = cx + d with positive integer coefficients; left coefficient 2–8 and left constant 1–9.",
    [
      "No grouped or rational-coefficient forms; selecting a category does not show the simplification or justify reversibility.",
    ],
    true,
  ),
  bind(
    "graph-equation-choice",
    "linear-models",
    ["slope-rule", "intercept", "build-model"],
    "Select an equation for an increasing line with slope 1–3 and intercept 4–6. The rendered A and B annotations supply coordinates at x=0 and x=2.",
    [
      "Not an assessment of unannotated coordinate reading, negative/zero slopes, noninteger coefficients or constructed modeling.",
    ],
    true,
  ),
];
export function validateBalancePracticeBindings(
  templates: readonly {
    id: string;
    skillId: string;
    requiredResponseCapability?: string;
  }[],
  bindings: readonly AlgebraPracticeBinding[] = balancePracticeBindings,
): void {
  const byId = new Map(templates.map((t) => [t.id, t])),
    pages = new Set(balanceAndChange.pages.map((p) => p.id)),
    seen = new Set<string>();
  for (const b of bindings) {
    const template = byId.get(b.templateId);
    if (!template || template.skillId !== b.skillId || seen.has(b.templateId))
      throw new Error(
        `Invalid algebra template/skill binding: ${b.templateId}`,
      );
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
      b.bookId !== balanceAndChange.id ||
      !b.pageIds.length ||
      new Set(b.pageIds).size !== b.pageIds.length ||
      b.pageIds.some((id) => !pages.has(id))
    )
      throw new Error(`Invalid algebra book/page binding: ${b.templateId}`);
    if (
      !b.practiceScope.trim() ||
      !b.unassessedRequirements.length ||
      b.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Missing algebra practice limits: ${b.templateId}`);
    for (const pageId of b.pageIds)
      if (
        !balanceAlignments.some(
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
