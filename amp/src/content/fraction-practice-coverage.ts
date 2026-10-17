import { fractionPracticeDefinitions } from "../math/fraction-practice.js";
import { fractionFieldGuide } from "../../books/fraction-field-guide/book.js";
import { skills } from "../curriculum/catalog.js";
import { fractionPracticeTemplates } from "../math/fraction-practice.js";

export interface FractionRequirement {
  sourceId: string;
  sourceUrl: string;
  reviewedAt: "2026-10-17";
  objective: string;
  templateIds: string[];
  status: "partial-practice" | "planned";
  remainingRequirements: string;
}
// Numbered requirements and every lettered component in the selected fraction domains.
// Descriptions are original navigation summaries, not substitutes for the source requirements.
const rows = `
3.NF.A.1|Fractional units and their counts|unit-piece-size,fraction-unit-count|Learner-created partitions, explanations of equal-sized parts, varied area and set representations.
3.NF.A.2|Fractions on number lines|fraction-line-position|Learner placement and construction rather than reading a supplied point.
3.NF.A.2.a|Locate a unit fraction|fraction-line-position|Independent partition of a unit interval and explicit unit-fraction reasoning.
3.NF.A.2.b|Iterate fractional unit lengths|fraction-line-position|Learner-created diagrams and explanations of interval iteration.
3.NF.A.3|Equivalence and comparison|fraction-whole-as-parts|Comparison symbols, justified equivalence, and grade-three visual comparison tasks.
3.NF.A.3.a|Same quantity or same point||Independent equivalence recognition across different models and coincident number-line points.
3.NF.A.3.b|Generate and explain simple equivalence||Grade-three bounded equivalence tasks with learner explanations; grade-four renaming is separately mapped.
3.NF.A.3.c|Whole-number fraction names|fraction-whole-as-parts|Denominator-one notation and whole-number equivalence on independently constructed number lines.
3.NF.A.3.d|Compare same-unit or same-count fractions||Comparison symbols, same-whole reasoning, same-numerator cases, and learner justification.
4.NF.A.1|Equivalent names through scaling|equivalent-numerator,equivalent-denominator|Learner explanation of why count and piece size change while quantity stays fixed.
4.NF.A.2|Compare unlike fractions||Comparison strategy selection, inequality symbols, benchmark reasoning, and visual justification.
4.NF.B.3|Build fractions from unit fractions|fraction-unit-count,like-fraction-missing-part,like-fraction-difference,mixed-fraction-difference|Multiple decompositions and independently justified equations; broader grade-four denominator domain.
4.NF.B.3.a|Join and separate parts of one whole|like-fraction-missing-part,like-fraction-difference|Learner-selected visual representations and explanation of shared reference whole.
4.NF.B.3.b|Several decompositions of one fraction|like-fraction-missing-part|Produce multiple distinct decompositions and justify each, including nonbinary decompositions.
4.NF.B.3.c|Operate with mixed numbers|mixed-to-improper-numerator,improper-whole-part,improper-fractional-part,mixed-fraction-difference|Mixed-number addition, direct mixed-number input, nonregrouping subtraction, and strategy explanation.
4.NF.B.3.d|Like-unit contextual operations|like-fraction-difference|Addition contexts, multiple story structures, and learner-created models/equations.
4.NF.B.4|Whole-number groups of fractions|whole-times-fraction|All unit-fraction interpretations, estimation between integers, and independently created models.
4.NF.B.4.a|A fraction as repeated unit fractions|fraction-unit-count|Learner-written multiplication equations and explanation linking product to visual units.
4.NF.B.4.b|Multiply whole quantities and fractions|whole-times-fraction|Wider numerator/denominator values and independently justified multiplication models.
4.NF.B.4.c|Contextual fraction-times-whole problems|whole-times-fraction|Multiple contexts, integer bounds, and independently selected representations.
4.NF.C.5|Tenths and hundredths||Decimal-fraction renaming and sums are outside this practice slice.
4.NF.C.6|Decimal notation for fractional units||Decimal notation and number-line placement are outside this practice slice.
4.NF.C.7|Compare decimals through hundredths||Decimal comparisons with same-whole reasoning are outside this practice slice.
5.NF.A.1|Unlike-unit fraction operations|unlike-fraction-difference,fraction-distance-gap|Mixed unlike-denominator operations, general addition, full denominator domain, and method explanation.
5.NF.A.2|Contextual operations and reasonableness|fraction-distance-gap|Uncued operation selection, mental estimates, error judgments, and broader stories.
5.NF.B.3|Fraction as whole-number sharing|whole-sharing-fraction|Learner-generated sharing models, larger quantities, and estimates between whole numbers.
5.NF.B.4|Fraction multiplication|fraction-of-quantity|Fraction-by-fraction area and length models, mixed values, and learner-created stories.
5.NF.B.4.a|A fraction of a quantity|fraction-of-quantity|General fractional quantities, independent modeling and creation of matching contexts.
5.NF.B.4.b|Fractional rectangle area||Fractional side-length tiling, square-unit reasoning, and area representations.
5.NF.B.5|Scaling and size reasoning||Predictions and explanations without performing multiplication are not assessed by these numeric computations.
5.NF.B.5.a|Predict product size from a factor||Noncomputational comparisons of product and factors.
5.NF.B.5.b|Explain scaling and multiplication by one||Learner explanations for shrinking/enlarging/equivalence and factors above one.
5.NF.B.6|Contextual fraction multiplication|fraction-of-quantity|Mixed-number contexts, broader fractional factors, and independently selected equations/models.
5.NF.B.7|Unit-fraction division|unit-fraction-share,whole-unit-groups|Learner-created contexts, diagrams, and inverse-operation explanations.
5.NF.B.7.a|Share a unit fraction|unit-fraction-share|Independently construct a model and explain the inverse multiplication check.
5.NF.B.7.b|Measure wholes in unit-fraction groups|whole-unit-groups|Independently construct a model and explain how quotient counts groups.
5.NF.B.7.c|Contextual unit-fraction division|unit-fraction-share,whole-unit-groups|Broader stories, independent operation choice, and learner-created models.
6.NS.A.1|Interpret and calculate fraction quotients|fraction-group-count,fraction-share-amount|General unlike-denominator quotient models, fractional group counts from area, created contexts, and learner reasoning.
`;
export const fractionRequirements: readonly FractionRequirement[] = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [sourceId, objective, ids, remainingRequirements] = row.split(
      "|",
    ) as [string, string, string, string];
    return {
      sourceId,
      objective,
      templateIds: ids ? ids.split(",") : [],
      remainingRequirements,
      status: ids ? "partial-practice" : "planned",
      reviewedAt: "2026-10-17",
      sourceUrl: `https://www.thecorestandards.org/Math/Content/${sourceId.replaceAll(".", "/")}/`,
    };
  });
export interface FractionPracticeBinding {
  templateId: string;
  bookId: "fraction-field-guide";
  pageIds: string[];
  skillId: string;
  instructionalGrade: "3" | "4" | "5" | "6";
  componentIds: string[];
  assessedResponse: "numeric-result-only";
  unassessedRequirements: string[];
}
export const fractionPracticeBindings: readonly FractionPracticeBinding[] =
  fractionPracticeDefinitions.map((definition) => ({
    templateId: definition.id,
    bookId: "fraction-field-guide",
    pageIds: [definition.pageId],
    skillId: definition.skillId,
    instructionalGrade: definition.grade,
    componentIds: fractionRequirements
      .filter((requirement) => requirement.templateIds.includes(definition.id))
      .map((requirement) => requirement.sourceId),
    assessedResponse: "numeric-result-only",
    unassessedRequirements: [
      "Independent explanation, construction, and representation choice.",
      "Delayed retention, fluent recall, and transfer beyond this bounded family.",
    ],
  }));
export function validateFractionPracticeCoverage(
  bindings: readonly FractionPracticeBinding[] = fractionPracticeBindings,
  requirements: readonly FractionRequirement[] = fractionRequirements,
): void {
  const pageIds = new Set(fractionFieldGuide.pages.map((page) => page.id));
  const skillIds = new Set(skills.map((skill) => skill.id));
  const templates = new Map(
    fractionPracticeTemplates.map((template) => [template.id, template]),
  );
  const sources = new Map(
    requirements.map((requirement) => [requirement.sourceId, requirement]),
  );
  if (sources.size !== requirements.length)
    throw new Error("Duplicate source component");
  if (
    new Set(bindings.map((binding) => binding.templateId)).size !==
    bindings.length
  )
    throw new Error("Duplicate template binding");
  for (const binding of bindings) {
    const template = templates.get(binding.templateId);
    if (
      !template ||
      template.skillId !== binding.skillId ||
      !skillIds.has(binding.skillId)
    )
      throw new Error(
        `Unknown/mismatched template skill: ${binding.templateId}`,
      );
    if (
      binding.bookId !== fractionFieldGuide.id ||
      !binding.pageIds.length ||
      binding.pageIds.some((id) => !pageIds.has(id))
    )
      throw new Error(`Unknown book/page: ${binding.templateId}`);
    if (
      !binding.componentIds.length ||
      binding.componentIds.some(
        (id) => !sources.get(id)?.templateIds.includes(binding.templateId),
      )
    )
      throw new Error(
        `Unknown/unlinked source component: ${binding.templateId}`,
      );
    if (
      binding.assessedResponse !== "numeric-result-only" ||
      !binding.unassessedRequirements.length
    )
      throw new Error("Unsupported coverage claim");
  }
  for (const requirement of requirements) {
    if (!requirement.remainingRequirements.trim())
      throw new Error("Missing coverage limits");
    if (
      requirement.status !==
      (requirement.templateIds.length ? "partial-practice" : "planned")
    )
      throw new Error("Inconsistent coverage status");
    for (const id of requirement.templateIds)
      if (!templates.has(id)) throw new Error(`Unknown source template: ${id}`);
  }
  if (bindings.length !== templates.size)
    throw new Error("Every fraction family needs exactly one book binding");
}
