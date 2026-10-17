import { inTheSameProportion } from "./book.js";
export interface RatioAlignment {
  id: string;
  skillId: string;
  relation: "taught" | "practiced" | "reference";
  pageIds: string[];
  taskIds: string[];
  templateIds: string[];
  standardIds: string[];
  scope: string;
  unassessedRequirements: string[];
}
const row = (
  id: string,
  skillId: string,
  pageIds: string[],
  standardIds: string[],
  scope: string,
  unassessedRequirements: string[],
  templateIds: string[] = [],
  taskIds?: string[],
): RatioAlignment => ({
  id,
  skillId,
  pageIds,
  standardIds,
  scope,
  unassessedRequirements,
  templateIds,
  relation: "taught",
  taskIds:
    taskIds ??
    inTheSameProportion.pages
      .filter((p) => pageIds.includes(p.id))
      .flatMap((p) =>
        p.blocks.filter((b) => b.kind === "task").map((b) => b.id),
      ),
});
export const ratioAlignments: readonly RatioAlignment[] = [
  row(
    "ratio-meaning",
    "ratios",
    [
      "name-the-order",
      "parts-and-whole",
      "draw-two-batches",
      "meaning-return",
      "scale-both-quantities",
    ],
    ["6.RP.A.1"],
    "Name two quantities and ratio order; distinguish part-to-part and part-to-whole comparisons; illustrate equivalent whole-object batches.",
    [
      "Numeric scaling practice does not assess ratio language, drawn models or a constructed explanation.",
      "Selected contexts and representations do not establish complete standard coverage.",
    ],
    ["ratio-missing"],
  ),
  row(
    "equivalent-pairs",
    "ratio-tables",
    [
      "scale-both-quantities",
      "additive-near-miss",
      "half-a-batch",
      "share-a-total",
      "compare-at-a-common-amount",
      "scale-studio",
      "check-the-pairs",
      "design-a-kit",
    ],
    ["6.RP.A.3"],
    "Scale same-unit quantities, partition a total, compare at a common reference, and respect whole-object constraints.",
    [
      "Open kit design and completeness arguments need human review.",
      "No claim to every ratio table, conversion, diagram or contextual component.",
    ],
  ),
  row(
    "unit-rate-meaning",
    "unit-rates",
    [
      "price-per-one",
      "unit-price-and-purchase",
      "average-is-not-constant",
      "convert-a-rate",
      "supplier-investigation",
    ],
    ["6.RP.A.2"],
    "Interpret selected unit prices and speed rates, distinguish per-unit rates from whole-pack bills, and compare stated purchase models.",
    [
      "Fractional-quantity rates are mapped separately to grade seven.",
      "Unit labels, model justification and purchase enumeration require constructed evidence, not a numeric answer alone.",
    ],
  ),
  row(
    "fractional-rates",
    "rational-unit-rates",
    [
      "fractional-unit-rate",
      "reverse-the-rate",
      "mixed-return",
      "delayed-return",
    ],
    ["7.RP.A.1"],
    "Compute selected constant rates involving fractional amounts, reverse rate units, and reconstruct a given pair.",
    [
      "No complete survey of contexts, compound units or independently constructed explanations.",
      "There is no dedicated automated fractional-rate family bound to this chapter.",
    ],
    [],
    [
      "fraction-rate-transfer",
      "reciprocal-check",
      "mixed-fraction-rate",
      "delayed-rate",
    ],
  ),
  row(
    "proportional-models",
    "proportional-relationships",
    [
      "price-per-one",
      "check-the-pairs",
      "evidence-and-assumption",
      "proportional-graph",
      "whole-object-domain",
      "starting-fee",
      "model-repair",
      "choose-a-model",
    ],
    ["7.RP.A.2"],
    "Connect selected positive proportional rules, tables and graphs; distinguish fixed fees, finite evidence, undefined zero quotients and physical input domains.",
    [
      "The constant-unit-price family assesses only an integer total cost; it does not assess graph construction, proportionality explanation or all standard components.",
      "Signed real-valued algebraic proportional-rule practice is not bound to these physical-quantity pages.",
    ],
    ["unit-price"],
  ),
  row(
    "percent-reference",
    "percentages",
    [
      "hundredths-of-a-whole",
      "find-the-percent-part",
      "find-the-missing-whole",
      "find-the-percentage",
      "percent-studio",
    ],
    ["6.RP.A.3"],
    "Interpret percent as a comparison to a named whole and solve selected missing-part, missing-whole and missing-percentage problems.",
    [
      "Automated percent-of practice finds only a selected part; it does not assess missing wholes, a learner-created model or the complete standard.",
      "The grid is a model of fractional share, not necessarily one square per physical object.",
    ],
    ["percent-of"],
  ),
  row(
    "changing-percent-base",
    "percent-change",
    ["discount-then-tax", "equal-percents-do-not-cancel"],
    ["7.RP.A.3"],
    "Use explicitly stated discount and tax bases; explain why opposite equal-percent changes need not cancel.",
    [
      "No complete treatment of interest, commissions, gratuities or percent error.",
      "Multistep reasoning and reference-whole explanations require human review; no automated percent-change family is claimed.",
    ],
  ),
];
export function validateRatioAlignments(
  skills: readonly {
    id: string;
    alignments: readonly { standardId: string }[];
  }[],
  templates: readonly { id: string; skillId: string }[],
  standards: readonly { id: string }[],
  alignments: readonly RatioAlignment[] = ratioAlignments,
): void {
  const skillMap = new Map(skills.map((s) => [s.id, s])),
    templateMap = new Map(templates.map((t) => [t.id, t])),
    standardIds = new Set(standards.map((s) => s.id)),
    pages = new Map(inTheSameProportion.pages.map((p) => [p.id, p])),
    seen = new Set<string>();
  for (const a of alignments) {
    if (!a.id.trim() || seen.has(a.id))
      throw new Error(`Duplicate or empty ratio alignment: ${a.id}`);
    seen.add(a.id);
    const skill = skillMap.get(a.skillId);
    if (!skill) throw new Error(`Unknown skill: ${a.skillId}`);
    if (
      !["taught", "practiced", "reference"].includes(a.relation) ||
      !a.scope.trim() ||
      !a.pageIds.length ||
      !a.standardIds.length ||
      !a.unassessedRequirements.length ||
      a.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Incomplete alignment scope: ${a.id}`);
    for (const id of a.standardIds)
      if (
        !standardIds.has(id) ||
        !skill.alignments.some((s) => s.standardId === id)
      )
        throw new Error(`Standard outside skill crosswalk: ${a.skillId}/${id}`);
    for (const id of a.pageIds)
      if (!pages.has(id)) throw new Error(`Unknown page: ${id}`);
    for (const id of a.taskIds)
      if (
        !a.pageIds.some((p) =>
          pages.get(p)!.blocks.some((b) => b.kind === "task" && b.id === id),
        )
      )
        throw new Error(`Task outside alignment pages: ${id}`);
    for (const id of a.templateIds)
      if (templateMap.get(id)?.skillId !== a.skillId)
        throw new Error(`Template skill mismatch: ${id}`);
  }
}
