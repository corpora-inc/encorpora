import {
  satCompletionTemplates,
  generateSatCompletionProblem,
} from "./sat-completion-practice";
import {
  satGeometryDataTemplates,
  generateSatGeometryDataProblem,
} from "./sat-geometry-data-practice";
import {
  satGeometryAdvancedTemplates,
  generateSatGeometryAdvancedProblem,
} from "./sat-geometry-advanced-practice";
import { normalizeSelection } from "./selection-response";
import { gradePointPlot, normalizePointPlot } from "./point-plot";
import { gradeMultiPart, normalizeMultiPart } from "./multi-part-choice";
import {
  multiPartChoiceTemplates,
  generateMultiPartChoiceProblem,
} from "./multi-part-choice-practice";
import {
  pointPlotTemplates,
  generatePointPlotProblem,
} from "./point-plot-practice";
import {
  quadrilateralHierarchyMultiselectTemplate,
  generateQuadrilateralHierarchyMultiselect,
} from "./quadrilateral-hierarchy-multiselect";
import {
  congruenceTemplates,
  generateCongruenceProblem,
} from "./congruence-practice";
import {
  assessmentGapTemplates,
  generateAssessmentGapProblem,
} from "./assessment-gap-practice";
import {
  radicalEquationTemplates,
  generateRadicalEquationProblem,
} from "./radical-equation-practice";
import {
  rationalEquationTemplates,
  generateRationalEquationProblem,
} from "./rational-equation-practice";
import {
  k8RepresentationTemplates,
  generateK8RepresentationProblem,
} from "./k8-representations-practice";
import {
  geometryProofTemplates,
  proofConstructionTemplates,
  generateProofConstructionProblem,
  generateGeometryProofProblem,
} from "./geometry-proof-practice";
import {
  rationalExpressionTemplates,
  generateRationalExpressionProblem,
} from "./rational-expression-practice";
import {
  nonlinearSystemTemplates,
  generateNonlinearSystemProblem,
} from "./nonlinear-system-practice";
import {
  areaVolumeTemplates,
  generateAreaVolumeProblem,
} from "./area-volume-practice";
import {
  transformationTemplates,
  generateTransformationProblem,
} from "./transformation-practice";
import {
  completingSquareTemplates,
  generateCompletingSquareProblem,
} from "./completing-square-practice";
import {
  angleTriangleTemplates,
  generateAngleTriangleProblem,
} from "./angle-triangle-practice";
import {
  numberSystemTemplates,
  generateNumberSystemProblem,
} from "./number-system-practice";
import { decimalTemplates, generateDecimalProblem } from "./decimal-practice";
import {
  equationTemplates,
  generateEquationProblem,
} from "./equation-practice";
import {
  bivariateTemplates,
  generateBivariateProblem,
} from "./bivariate-practice";
import {
  inferenceTemplates,
  generateInferenceProblem,
} from "./inference-practice";
import {
  distributionTemplates,
  generateDistributionProblem,
} from "./distribution-practice";
import {
  twoVariableTemplates,
  generateTwoVariableProblem,
} from "./two-variable-practice";
import {
  linearFunctionTemplates,
  generateLinearFunctionProblem,
} from "./linear-function-practice";
import {
  quadraticStructureTemplates,
  generateQuadraticStructureProblem,
} from "./quadratic-structure-practice";
import {
  functionToolkitTemplates,
  generateFunctionToolkitProblem,
} from "./function-toolkit-practice";
import {
  patternFunctionTemplates,
  generatePatternFunctionProblem,
} from "./pattern-function-practice";
import {
  timeMoneyTemplates,
  generateTimeMoneyProblem,
} from "./time-money-practice";
import {
  attributeTemplates,
  generateAttributeProblem,
} from "./attribute-practice";
import {
  ratioRateTemplates,
  generateRatioRateProblem,
} from "./ratio-rate-practice";
import {
  partWholeTemplates,
  generatePartWholeProblem,
} from "./part-whole-practice";
import {
  linePlotTemplates,
  generateLinePlotProblem,
} from "./line-plot-practice";
import {
  earlyDataTemplates,
  generateEarlyDataProblem,
} from "./early-data-practice";
import {
  combinatoricsTemplates,
  generateCombinatoricsProblem,
} from "./combinatorics-practice";
import {
  realNumberTemplates,
  generateRealNumberProblem,
} from "./real-number-practice";
import { radicalTemplates, generateRadicalProblem } from "./radical-practice";
import { factsTemplates, generateFactsProblem } from "./facts-practice";
import {
  earlyOperationsTemplates,
  generateEarlyOperationsProblem,
} from "./early-operations-practice";
import { shapeTemplates, generateShapeProblem } from "./shape-practice";
import { angleTemplates, generateAngleProblem } from "./angle-practice";
import { polygonTemplates, generatePolygonProblem } from "./polygon-practice";
import {
  exponentialTemplates,
  generateExponentialProblem,
} from "./exponential-practice";
import { powerTemplates, generatePowerProblem } from "./power-practice";
import {
  algebraStatisticsTemplates,
  generateAlgebraStatisticsProblem,
} from "./algebra-statistics-practice";
import {
  coordinateCircleTemplates,
  generateCoordinateCircleProblem,
} from "./coordinate-circle-practice";
import {
  similarityTrigTemplates,
  generateSimilarityTrigProblem,
} from "./similarity-trig-practice";
import {
  probabilityRulesTemplates,
  generateProbabilityRulesProblem,
} from "./probability-rules-practice";
import {
  factArrayTemplates,
  generateFactArrayProblem,
} from "./fact-arrays-practice";
import {
  addSubtractTemplates,
  generateAddSubtractProblem,
} from "./add-subtract-practice";
import {
  volumeCoordinateTemplates,
  generateVolumeCoordinateProblem,
} from "./volume-coordinate-practice";
import {
  multiplyDivideTemplates,
  generateMultiplyDivideProblem,
} from "./multiply-divide-practice";
import {
  numberSenseTemplates,
  generateNumberSenseProblem,
} from "./number-sense-practice";
import {
  comparisonTemplates,
  generateComparisonProblem,
} from "./comparison-practice";
import {
  rationalTemplates,
  generateRationalProblem,
} from "./rational-practice";
import {
  factoringTemplates,
  generateFactoringProblem,
} from "./factoring-practice";
import {
  circleMeasurementTemplates,
  generateCircleMeasurementProblem,
} from "./circle-measurement-practice";
import {
  integerExponentTemplates,
  generateIntegerExponentProblem,
} from "./integer-exponent-practice";
import {
  descriptiveStatisticsTemplates,
  generateDescriptiveStatisticsProblem,
} from "./descriptive-statistics-practice";
import {
  percentChangeTemplates,
  generatePercentChangeProblem,
} from "./percent-change-practice";
import {
  successivePercentChangeTemplate,
  generateSuccessivePercentChangeProblem,
} from "./successive-percent-change";
import {
  slopeTriangleStatementsTemplate,
  generateSlopeTriangleStatementsProblem,
} from "./slope-triangle-statements";
import {
  linearSystemTemplates,
  generateLinearSystemProblem,
} from "./linear-system-practice";
import {
  inequalityTemplates,
  generateInequalityProblem,
} from "./inequality-practice";
import {
  rightTriangleTemplates,
  generateRightTriangleProblem,
} from "./right-triangle-practice";
import {
  polynomialTemplates,
  generatePolynomialProblem,
} from "./polynomial-practice";
import {
  quadraticTemplates,
  generateQuadraticProblem,
} from "./quadratic-practice";
import {
  statisticsProbabilityTemplates,
  generateStatisticsProbabilityProblem,
} from "./statistics-probability-practice";
import {
  complexConicsTemplates,
  generateComplexConicsProblem,
} from "./complex-conics-practice";
import {
  geometryModelingTemplates,
  generateGeometryModelingProblem,
} from "./geometry-modeling-practice";
import {
  geometryRequirementGapTemplates,
  generateGeometryRequirementGapProblem,
} from "./geometry-requirement-gaps-practice";
import {
  functionBehaviorTemplates,
  generateFunctionBehaviorProblem,
} from "./function-behavior-practice";
import {
  advancedMathGapTemplates,
  generateAdvancedMathGapProblem,
} from "./advanced-math-gaps-practice";
import {
  numberMeasurementGapTemplates,
  generateNumberMeasurementGapProblem,
} from "./number-measurement-gaps-practice";
import { texasK2Templates, generateTexasK2Problem } from "./texas-k2-practice";
import {
  floridaGapTemplates,
  generateFloridaGapProblem,
} from "./florida-gaps-practice";
import {
  regentsGapTemplates,
  generateRegentsGapProblem,
} from "./regents-gap-practice";
import { generateMcasGapProblem, mcasGapTemplates } from "./mcas-gap-practice";
import {
  generateStaarGapProblem,
  staarGapTemplates,
} from "./staar-gap-practice";
import {
  satAlgebraStructureTemplates,
  generateSatAlgebraStructureProblem,
} from "./sat-algebra-structure-practice";
import {
  satFunctionFormsTemplates,
  generateSatFunctionFormsProblem,
} from "./sat-function-forms-practice";
import {
  satNumericEntryTemplates,
  generateSatNumericEntryProblem,
} from "./sat-numeric-entry-practice";
import { satSprDecimalAccepted } from "./sat-spr-entry";
import {
  hsStateGapTemplates,
  generateHsStateGapProblem,
} from "./hs-state-gaps-practice";
import {
  k8StateNumberTemplates,
  generateK8StateNumberProblem,
} from "./k8-state-number-practice";
import { texas38Templates, generateTexas38Problem } from "./texas-38-practice";
import {
  complexMultiplicationTemplate,
  complexMultiplicationCase,
} from "./complex-practice";
import {
  financeCreditTemplates,
  financeCreditTemplateIds,
  generateFinanceCreditProblem,
} from "./finance-credit-practice";
import { texasHsTemplates, generateTexasHsProblem } from "./texas-hs-practice";
import {
  algebraRequirementGapTemplates,
  generateAlgebraRequirementGapProblem,
} from "./algebra-requirement-gaps-practice";
import {
  remainingGapTemplates,
  generateRemainingGapProblem,
} from "./remaining-gap-practice";
import {
  financeIncomeTemplates,
  generateFinanceIncomeProblem,
} from "./finance-income-practice";
import {
  dataDisplayStateTemplates,
  generateDataDisplayStateProblem,
} from "./data-display-state-practice";
import {
  vectorMatrixTemplates,
  generateVectorMatrixProblem,
} from "./vectors-matrices-practice";
import {
  trigonometryTemplates,
  generateTrigonometryProblem,
} from "./trigonometry-practice";
import {
  absoluteValueTemplates,
  generateAbsoluteValueProblem,
} from "./absolute-value-practice";
import {
  measurementTemplates,
  generateMeasurementProblem,
} from "./measurement-practice.js";
import {
  algebraTemplates,
  generateAlgebraProblem,
} from "./algebra-practice.js";
import { choiceTemplates, generateChoiceProblem } from "./choice.js";
import {
  equalGroupsTemplates,
  generateEqualGroupsProblem,
} from "./equal-groups-practice.js";
import {
  fractionPracticeTemplates,
  generateFractionPracticeProblem,
} from "./fraction-practice";
import {
  fractionDivisionExpressionTemplate,
  fractionDivisionExpressionCase,
} from "./fraction-division-expression";
import {
  linearInitialValueMeaningTemplate,
  linearInitialValueMeaningCase,
} from "./linear-initial-value-meaning";
import { elementaryTemplates, generateElementaryProblem } from "./elementary";
import { graphicalTemplates, generateGraphicalProblem } from "./graphical";
import { extendedTemplates, generateExtendedProblem } from "./extended";
import { familyRegistry } from "../families/registry";
import { createHash } from "node:crypto";
import { makeTenHops } from "./scene/explanations";
import { mathLabel, polish } from "./polish";
import type {
  GeneratedProblem,
  ProblemVariant,
  PublicProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import {
  isPerfectSquare,
  roundedRoot,
  sweepChoose,
  sweepVariant,
} from "./number-domain-axes";
export type {
  GeneratedProblem,
  PublicProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";

export const baseTemplates: readonly TemplateMetadata[] = [
  {
    id: "count-objects",
    version: 1,
    title: "Count objects",
    skillId: "count-to-20",
    gradeBand: "K–2",
    description: "Count up to ten objects.",
  },
  {
    id: "add-within-20",
    version: 1,
    title: "Add within twenty",
    skillId: "addition-within-20",
    gradeBand: "K–2",
    description: "Add two nonnegative whole numbers with a sum at most twenty.",
  },
  {
    id: "subtract-within-20",
    version: 1,
    title: "Subtract within twenty",
    skillId: "subtraction-within-20",
    gradeBand: "K–2",
    description: "Subtract without a negative result.",
  },
  {
    id: "fraction-model",
    version: 1,
    title: "Read a fraction",
    skillId: "fraction-model",
    gradeBand: "3–5",
    description: "Express a shaded part of one whole as a fraction.",
  },
  {
    id: "add-fractions",
    version: 1,
    title: "Add fractions",
    skillId: "fraction-addition",
    gradeBand: "3–5",
    description:
      "Add two positive fractions with possibly different denominators.",
  },
  {
    id: "rectangle-area",
    version: 1,
    title: "Rectangle area",
    skillId: "rectangle-area",
    gradeBand: "3–5",
    description: "Find area from perpendicular side lengths.",
  },
  {
    id: "linear-equation",
    version: 1,
    title: "Solve a linear equation",
    skillId: "linear-equations",
    gradeBand: "6–8",
    description: "Solve an equation with an integer solution.",
  },
  {
    id: "mean-data",
    version: 1,
    title: "Mean of a dataset",
    skillId: "statistics-mean",
    gradeBand: "6–8",
    description: "Compute an exact mean of five observations.",
  },
  {
    id: "right-triangle",
    version: 1,
    title: "Pythagorean theorem",
    skillId: "pythagorean-theorem",
    gradeBand: "6–8",
    description: "Find a hypotenuse from a scaled integer right triangle.",
  },
  {
    id: "quadratic-vertex",
    version: 1,
    title: "Quadratic minimum",
    skillId: "quadratic-minimum",
    gradeBand: "9–12",
    description: "Find the minimum value of a quadratic in vertex form.",
  },
  {
    id: "geometric-sequence",
    version: 1,
    title: "Geometric sequences",
    skillId: "geometric-sequences",
    gradeBand: "9–12",
    description:
      "Find a term of a geometric sequence from its first term and ratio.",
  },
  {
    id: "logarithm-integer",
    version: 1,
    title: "Logarithms",
    skillId: "logarithms",
    gradeBand: "9–12",
    description:
      "Evaluate a logarithm whose argument is an integer power of its base.",
  },
];

export const templates: readonly TemplateMetadata[] = [
  ...volumeCoordinateTemplates,
  ...shapeTemplates,
  ...polygonTemplates,
  ...exponentialTemplates,
  ...angleTemplates,
  ...linePlotTemplates,
  ...earlyDataTemplates,
  ...integerExponentTemplates,
  ...descriptiveStatisticsTemplates,
  ...rightTriangleTemplates,
  ...measurementTemplates,
  ...baseTemplates,
  ...extendedTemplates,
  ...quadraticTemplates,
  ...numberMeasurementGapTemplates,
  ...floridaGapTemplates,
  ...regentsGapTemplates,
  ...mcasGapTemplates,
  ...staarGapTemplates,
  ...texasK2Templates,
  ...k8StateNumberTemplates,
  ...texas38Templates,
  complexMultiplicationTemplate,
  ...financeCreditTemplates,
  ...hsStateGapTemplates,
  ...algebraRequirementGapTemplates,
  ...texasHsTemplates,
  ...advancedMathGapTemplates,
  ...satAlgebraStructureTemplates,
  ...satNumericEntryTemplates,
  ...satFunctionFormsTemplates,
  ...pointPlotTemplates,
  ...multiPartChoiceTemplates,
  ...vectorMatrixTemplates,
  ...statisticsProbabilityTemplates,
  ...complexConicsTemplates,
  ...trigonometryTemplates,
  ...geometryModelingTemplates,
  ...geometryRequirementGapTemplates,
  ...functionBehaviorTemplates,
  ...remainingGapTemplates,
  ...financeIncomeTemplates,
  ...dataDisplayStateTemplates,
  ...polynomialTemplates,
  ...radicalTemplates,
  ...addSubtractTemplates,
  ...comparisonTemplates,
  ...numberSenseTemplates,
  ...multiplyDivideTemplates,
  ...factsTemplates,
  ...factArrayTemplates,
  ...earlyOperationsTemplates,
  ...combinatoricsTemplates,
  ...areaVolumeTemplates,
  ...transformationTemplates,
  ...angleTriangleTemplates,
  ...realNumberTemplates,
  ...numberSystemTemplates,
  ...probabilityRulesTemplates,
  ...similarityTrigTemplates,
  ...congruenceTemplates,
  ...coordinateCircleTemplates,
  ...algebraStatisticsTemplates,
  ...powerTemplates,
  ...ratioRateTemplates,
  ...patternFunctionTemplates,
  ...linearFunctionTemplates,
  ...quadraticStructureTemplates,
  ...functionToolkitTemplates,
  ...twoVariableTemplates,
  ...equationTemplates,
  ...rationalTemplates,
  ...circleMeasurementTemplates,
  ...partWholeTemplates,
  ...attributeTemplates,
  ...timeMoneyTemplates,
  ...decimalTemplates,
  ...percentChangeTemplates,
  successivePercentChangeTemplate,
  slopeTriangleStatementsTemplate,
  ...inequalityTemplates,
  ...linearSystemTemplates,
  ...rationalExpressionTemplates,
  ...radicalEquationTemplates,
  ...rationalEquationTemplates,
  ...geometryProofTemplates,
  ...proofConstructionTemplates,
  ...k8RepresentationTemplates,
  ...nonlinearSystemTemplates,
  ...absoluteValueTemplates,
  ...graphicalTemplates,
  ...elementaryTemplates,
  ...fractionPracticeTemplates,
  fractionDivisionExpressionTemplate,
  linearInitialValueMeaningTemplate,
  quadrilateralHierarchyMultiselectTemplate,
  ...algebraTemplates,
  ...choiceTemplates,
  ...equalGroupsTemplates,
  ...completingSquareTemplates,
  ...factoringTemplates,
  ...distributionTemplates,
  ...inferenceTemplates,
  ...assessmentGapTemplates,
  ...satCompletionTemplates,
  ...satGeometryDataTemplates,
  ...satGeometryAdvancedTemplates,
  ...bivariateTemplates,
  // Frozen legacy list above. New families register through src/families/
  // (docs/content-family-playbook.md) and append here in family-id order.
  ...familyRegistry.templates,
];

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
function rational(n: bigint, d: bigint = 1n): string {
  if (!d) throw new Error("Zero denominator");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1n ? `${n}` : `${n}/${d}`;
}
/** Bounded exact literals only: no expressions, exponents, infinity or float tolerance. */
export function normalizeAnswer(input: string): string | null {
  if (typeof input !== "string" || input.length > 100) return null;
  const s = input
    .trim()
    .replaceAll("−", "-")
    .replace(/^([+-]?)\./, "$10.");
  const f = /^([+-]?\d{1,18})\s*\/\s*([+-]?\d{1,18})$/.exec(s);
  if (f)
    return BigInt(f[2]!) === 0n ? null : rational(BigInt(f[1]!), BigInt(f[2]!));
  const m = /^([+-]?)(\d{1,18})(?:\.(\d{1,18}))?$/.exec(s);
  if (!m) return null;
  const decimals = m[3] ?? "";
  return rational(
    BigInt(`${m[1] === "-" ? "-" : ""}${m[2]}${decimals}`),
    10n ** BigInt(decimals.length),
  );
}
export function isValidResponse(
  problem: PublicProblem,
  response: string,
): boolean {
  if (problem.response.kind === "multi-select")
    return normalizeSelection(problem.response, response) !== null;
  if (problem.response.kind === "point-plot")
    return normalizePointPlot(problem.response, response) !== null;
  if (problem.response.kind === "multi-part-choice")
    return normalizeMultiPart(problem.response, response) !== null;
  return problem.response.kind === "choice"
    ? problem.response.options.some((option) => option.id === response)
    : normalizeAnswer(response) !== null;
}
export function gradeAnswer(
  problem: GeneratedProblem,
  response: string,
): boolean {
  if (problem.public.response.kind === "multi-select") {
    const answer = normalizeSelection(problem.public.response, response);
    return (
      answer !== null &&
      answer === normalizeSelection(problem.public.response, problem.answer)
    );
  }
  if (problem.public.response.kind === "point-plot")
    return (
      !!problem.pointGrading &&
      gradePointPlot(
        problem.public.response,
        problem.pointGrading,
        problem.answer,
        response,
      )
    );
  if (problem.public.response.kind === "multi-part-choice")
    return gradeMultiPart(problem.public.response, problem.answer, response);
  if (problem.public.response.kind === "choice")
    return (
      isValidResponse(problem.public, response) && response === problem.answer
    );
  const answer = normalizeAnswer(response);
  if (answer !== null && answer === normalizeAnswer(problem.answer))
    return true;
  return (
    problem.entryPolicy === "sat-spr" &&
    satSprDecimalAccepted(normalizeAnswer(problem.answer) ?? "", response)
  );
}

/** SHA-256 counter stream gives stable values across Node versions, with unbiased bounded draws. */
function random(
  templateId: string,
  seed: string,
): (lo: number, hi: number) => number {
  let counter = 0;
  return (lo, hi) => {
    const range = hi - lo + 1;
    const ceiling = Math.floor(0x100000000 / range) * range;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= ceiling);
    return lo + (n % range);
  };
}
/** Sums past ten are taught through ten: complete a ten, then add the rest. */
function addWithinTwenty(a: number, b: number): string[] {
  const sum = a + b,
    big = Math.max(a, b),
    small = Math.min(a, b);
  if (small === 0) return [`Adding 0 changes nothing: ${a} + ${b} = ${sum}.`];
  if (sum <= 10) return [`Count on ${b} from ${a}: ${a} + ${b} = ${sum}.`];
  if (big < 10) {
    const need = 10 - big;
    return [
      `${big} needs ${need} more to make 10.`,
      `Split ${small} into ${need} and ${small - need}.`,
      `10 + ${small - need} = ${sum}.`,
    ];
  }
  const ones = big - 10;
  return [
    `${big} is 10 + ${ones}.`,
    `Add the ones: ${ones} + ${small} = ${ones + small}.`,
    `10 + ${ones + small} = ${sum}.`,
  ];
}
function addWithinTwentyHint(a: number, b: number): string {
  const big = Math.max(a, b),
    small = Math.min(a, b);
  if (small === 0) return `Adding 0 to ${big} adds nothing.`;
  if (a + b <= 10)
    return a === b
      ? `Start at ${a} and count on ${b} more.`
      : `Start at the greater number, ${big}, and count on ${small} more.`;
  if (big < 10) {
    const need = 10 - big;
    return `${big} needs ${need} more to make 10. Split ${small} into ${need} and ${small - need}.`;
  }
  return `${big} is 10 and ${big - 10}. Add the ones first: ${big - 10} + ${small}.`;
}
function subtractWithinTwentyHint(a: number, b: number): string {
  if (b === 0) return `Taking away 0 removes nothing from ${a}.`;
  if (b === a) return `You take away all ${a}. How many are left?`;
  if (b === 10 && a > 10)
    return `Taking 10 from ${a} removes the ten and leaves only the ones.`;
  if (a <= 10)
    return b <= 3
      ? `Start at ${a} and count back ${b}.`
      : `Think of addition: ${b} + □ = ${a}.`;
  const ones = a - 10;
  if (b > 10) return `${b} is close to ${a}. Count up from ${b} to ${a}.`;
  return b > ones
    ? `First take away ${ones} to reach 10. Then take away the rest of the ${b}.`
    : `${a} is 10 and ${ones}. Take ${b} from the ${ones} ones; the ten stays.`;
}
export function generateProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  return polishProblem(generateRawProblem(templateId, seed));
}
/** Apply the legacy count copy-edit without changing authored algebra notation. */
export function polishProblem(problem: GeneratedProblem): GeneratedProblem {
  // These authored algebra strings need their grouping parentheses and complete identities.
  // The general noun/number copy-edit removes both, changing fractional division.
  const preserveAlgebra = [
    ...areaVolumeTemplates,
    ...transformationTemplates,
    ...completingSquareTemplates,
    ...factoringTemplates,
    ...shapeTemplates,
    ...polygonTemplates,
    quadrilateralHierarchyMultiselectTemplate,
    ...exponentialTemplates,
    ...angleTemplates,
    ...patternFunctionTemplates,
    ...linearFunctionTemplates,
    ...quadraticStructureTemplates,
    ...functionToolkitTemplates,
    ...twoVariableTemplates,
    ...equationTemplates,
    ...volumeCoordinateTemplates,
    ...distributionTemplates,
    ...inferenceTemplates,
    ...assessmentGapTemplates,
    ...satCompletionTemplates,
    ...satGeometryDataTemplates,
    ...satGeometryAdvancedTemplates,
    ...bivariateTemplates,
    ...partWholeTemplates,
    ...attributeTemplates,
    ...timeMoneyTemplates,
    ...decimalTemplates,
    ...linePlotTemplates,
    ...earlyDataTemplates,
    ...combinatoricsTemplates,
    ...angleTriangleTemplates,
    ...realNumberTemplates,
    ...numberSystemTemplates,
    ...probabilityRulesTemplates,
    ...similarityTrigTemplates,
    ...congruenceTemplates,
    ...coordinateCircleTemplates,
    ...algebraStatisticsTemplates,
    ...powerTemplates,
    ...ratioRateTemplates,
    ...radicalTemplates,
    ...rationalTemplates,
    ...circleMeasurementTemplates,
    ...integerExponentTemplates,
    ...descriptiveStatisticsTemplates,
    ...percentChangeTemplates,
    successivePercentChangeTemplate,
    slopeTriangleStatementsTemplate,
    ...inequalityTemplates,
    ...linearSystemTemplates,
    ...rationalExpressionTemplates,
    ...radicalEquationTemplates,
    ...rationalEquationTemplates,
    ...geometryProofTemplates,
    ...proofConstructionTemplates,
    ...k8RepresentationTemplates,
    ...nonlinearSystemTemplates,
    ...absoluteValueTemplates,
    ...algebraRequirementGapTemplates,
    ...texasHsTemplates,
    ...pointPlotTemplates,
    ...multiPartChoiceTemplates,
  ].some((t) => t.id === problem.public.templateId);
  const keepAuthored =
    preserveAlgebra ||
    familyRegistry.preserveAlgebra.has(problem.public.templateId);
  const text = (value: string) => (keepAuthored ? value : polish(value));
  return {
    ...problem,
    public: {
      ...problem.public,
      prompt: text(problem.public.prompt),
      response: {
        ...problem.public.response,
        label: mathLabel(problem.public.response.label),
      },
    },
    explanation: problem.explanation.map(text),
    hint: text(problem.hint),
    ...(problem.choiceFeedback
      ? {
          choiceFeedback: Object.fromEntries(
            Object.entries(problem.choiceFeedback).map(([k, v]) => [
              k,
              text(v),
            ]),
          ),
        }
      : {}),
  };
}
function generateRawProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const familyGenerate = familyRegistry.generators.get(templateId);
  if (familyGenerate) return familyGenerate(templateId, seed);
  if (areaVolumeTemplates.some((t) => t.id === templateId))
    return generateAreaVolumeProblem(templateId, seed);
  if (transformationTemplates.some((t) => t.id === templateId))
    return generateTransformationProblem(templateId, seed);
  if (completingSquareTemplates.some((t) => t.id === templateId))
    return generateCompletingSquareProblem(templateId, seed);
  if (factoringTemplates.some((t) => t.id === templateId))
    return generateFactoringProblem(templateId, seed);
  if (numberSystemTemplates.some((t) => t.id === templateId))
    return generateNumberSystemProblem(templateId, seed);
  if (attributeTemplates.some((t) => t.id === templateId))
    return generateAttributeProblem(templateId, seed);
  if (ratioRateTemplates.some((t) => t.id === templateId))
    return generateRatioRateProblem(templateId, seed);
  if (satCompletionTemplates.some((t) => t.id === templateId))
    return generateSatCompletionProblem(templateId, seed);
  if (satGeometryDataTemplates.some((t) => t.id === templateId))
    return generateSatGeometryDataProblem(templateId, seed);
  if (satGeometryAdvancedTemplates.some((t) => t.id === templateId))
    return generateSatGeometryAdvancedProblem(templateId, seed);
  if (assessmentGapTemplates.some((t) => t.id === templateId))
    return generateAssessmentGapProblem(templateId, seed);
  if (inferenceTemplates.some((t) => t.id === templateId))
    return generateInferenceProblem(templateId, seed);
  if (shapeTemplates.some((t) => t.id === templateId))
    return generateShapeProblem(templateId, seed);
  if (exponentialTemplates.some((t) => t.id === templateId))
    return generateExponentialProblem(templateId, seed);
  if (polygonTemplates.some((t) => t.id === templateId))
    return generatePolygonProblem(templateId, seed);
  if (twoVariableTemplates.some((t) => t.id === templateId))
    return generateTwoVariableProblem(templateId, seed);
  if (linearFunctionTemplates.some((t) => t.id === templateId))
    return generateLinearFunctionProblem(templateId, seed);
  if (quadraticStructureTemplates.some((t) => t.id === templateId))
    return generateQuadraticStructureProblem(templateId, seed);
  if (functionToolkitTemplates.some((t) => t.id === templateId))
    return generateFunctionToolkitProblem(templateId, seed);
  if (angleTemplates.some((t) => t.id === templateId))
    return generateAngleProblem(templateId, seed);
  if (patternFunctionTemplates.some((t) => t.id === templateId))
    return generatePatternFunctionProblem(templateId, seed);
  if (timeMoneyTemplates.some((t) => t.id === templateId))
    return generateTimeMoneyProblem(templateId, seed);
  if (equationTemplates.some((t) => t.id === templateId))
    return generateEquationProblem(templateId, seed);
  if (decimalTemplates.some((t) => t.id === templateId))
    return generateDecimalProblem(templateId, seed);
  if (volumeCoordinateTemplates.some((t) => t.id === templateId))
    return generateVolumeCoordinateProblem(templateId, seed);
  if (distributionTemplates.some((t) => t.id === templateId))
    return generateDistributionProblem(templateId, seed);
  if (bivariateTemplates.some((t) => t.id === templateId))
    return generateBivariateProblem(templateId, seed);
  if (partWholeTemplates.some((t) => t.id === templateId))
    return generatePartWholeProblem(templateId, seed);
  if (linePlotTemplates.some((t) => t.id === templateId))
    return generateLinePlotProblem(templateId, seed);
  if (earlyDataTemplates.some((t) => t.id === templateId))
    return generateEarlyDataProblem(templateId, seed);
  if (combinatoricsTemplates.some((t) => t.id === templateId))
    return generateCombinatoricsProblem(templateId, seed);
  if (angleTriangleTemplates.some((t) => t.id === templateId))
    return generateAngleTriangleProblem(templateId, seed);
  if (realNumberTemplates.some((t) => t.id === templateId))
    return generateRealNumberProblem(templateId, seed);
  if (probabilityRulesTemplates.some((t) => t.id === templateId))
    return generateProbabilityRulesProblem(templateId, seed);
  if (congruenceTemplates.some((t) => t.id === templateId))
    return generateCongruenceProblem(templateId, seed);
  if (similarityTrigTemplates.some((t) => t.id === templateId))
    return generateSimilarityTrigProblem(templateId, seed);
  if (algebraStatisticsTemplates.some((t) => t.id === templateId))
    return generateAlgebraStatisticsProblem(templateId, seed);
  if (coordinateCircleTemplates.some((t) => t.id === templateId))
    return generateCoordinateCircleProblem(templateId, seed);
  if (powerTemplates.some((t) => t.id === templateId))
    return generatePowerProblem(templateId, seed);
  if (radicalTemplates.some((t) => t.id === templateId))
    return generateRadicalProblem(templateId, seed);
  if (numberSenseTemplates.some((t) => t.id === templateId))
    return generateNumberSenseProblem(templateId, seed);
  if (multiplyDivideTemplates.some((t) => t.id === templateId))
    return generateMultiplyDivideProblem(templateId, seed);
  if (addSubtractTemplates.some((t) => t.id === templateId))
    return generateAddSubtractProblem(templateId, seed);
  if (factsTemplates.some((t) => t.id === templateId))
    return generateFactsProblem(templateId, seed);
  if (factArrayTemplates.some((t) => t.id === templateId))
    return generateFactArrayProblem(templateId, seed);
  if (earlyOperationsTemplates.some((t) => t.id === templateId))
    return generateEarlyOperationsProblem(templateId, seed);
  if (comparisonTemplates.some((t) => t.id === templateId))
    return generateComparisonProblem(templateId, seed);
  if (rationalTemplates.some((t) => t.id === templateId))
    return generateRationalProblem(templateId, seed);
  if (circleMeasurementTemplates.some((t) => t.id === templateId))
    return generateCircleMeasurementProblem(templateId, seed);
  if (integerExponentTemplates.some((t) => t.id === templateId))
    return generateIntegerExponentProblem(templateId, seed);
  if (descriptiveStatisticsTemplates.some((t) => t.id === templateId))
    return generateDescriptiveStatisticsProblem(templateId, seed);
  if (percentChangeTemplates.some((t) => t.id === templateId))
    return generatePercentChangeProblem(templateId, seed);
  if (templateId === successivePercentChangeTemplate.id)
    return generateSuccessivePercentChangeProblem(seed);
  if (templateId === slopeTriangleStatementsTemplate.id)
    return generateSlopeTriangleStatementsProblem(seed);
  if (radicalEquationTemplates.some((t) => t.id === templateId))
    return generateRadicalEquationProblem(templateId, seed);
  if (rationalEquationTemplates.some((t) => t.id === templateId))
    return generateRationalEquationProblem(templateId, seed);
  if (geometryProofTemplates.some((t) => t.id === templateId))
    return generateGeometryProofProblem(templateId, seed);
  if (k8RepresentationTemplates.some((t) => t.id === templateId))
    return generateK8RepresentationProblem(templateId, seed);
  if (proofConstructionTemplates.some((t) => t.id === templateId))
    return generateProofConstructionProblem(templateId, seed);
  if (rationalExpressionTemplates.some((t) => t.id === templateId))
    return generateRationalExpressionProblem(templateId, seed);
  if (nonlinearSystemTemplates.some((t) => t.id === templateId))
    return generateNonlinearSystemProblem(templateId, seed);
  if (linearSystemTemplates.some((t) => t.id === templateId))
    return generateLinearSystemProblem(templateId, seed);
  if (inequalityTemplates.some((t) => t.id === templateId))
    return generateInequalityProblem(templateId, seed);
  if (rightTriangleTemplates.some((t) => t.id === templateId))
    return generateRightTriangleProblem(templateId, seed);
  if (polynomialTemplates.some((t) => t.id === templateId))
    return generatePolynomialProblem(templateId, seed);
  if (quadraticTemplates.some((t) => t.id === templateId))
    return generateQuadraticProblem(templateId, seed);
  if (numberMeasurementGapTemplates.some((t) => t.id === templateId))
    return generateNumberMeasurementGapProblem(templateId, seed);
  if (floridaGapTemplates.some((t) => t.id === templateId))
    return generateFloridaGapProblem(templateId, seed);
  if (regentsGapTemplates.some((t) => t.id === templateId))
    return generateRegentsGapProblem(templateId, seed);
  if (mcasGapTemplates.some((t) => t.id === templateId))
    return generateMcasGapProblem(templateId, seed);
  if (staarGapTemplates.some((t) => t.id === templateId))
    return generateStaarGapProblem(templateId, seed);
  if (texasK2Templates.some((t) => t.id === templateId))
    return generateTexasK2Problem(templateId, seed);
  if (k8StateNumberTemplates.some((t) => t.id === templateId))
    return generateK8StateNumberProblem(templateId, seed);
  if (texas38Templates.some((t) => t.id === templateId))
    return generateTexas38Problem(templateId, seed);
  if (statisticsProbabilityTemplates.some((t) => t.id === templateId))
    return generateStatisticsProbabilityProblem(templateId, seed);
  if (complexConicsTemplates.some((t) => t.id === templateId))
    return generateComplexConicsProblem(templateId, seed);
  if (functionBehaviorTemplates.some((t) => t.id === templateId))
    return generateFunctionBehaviorProblem(templateId, seed);
  if (advancedMathGapTemplates.some((t) => t.id === templateId))
    return generateAdvancedMathGapProblem(templateId, seed);
  if (satFunctionFormsTemplates.some((t) => t.id === templateId))
    return generateSatFunctionFormsProblem(templateId, seed);
  if (satNumericEntryTemplates.some((t) => t.id === templateId))
    return generateSatNumericEntryProblem(templateId, seed);
  if (hsStateGapTemplates.some((t) => t.id === templateId))
    return generateHsStateGapProblem(templateId, seed);
  if (pointPlotTemplates.some((t) => t.id === templateId))
    return generatePointPlotProblem(templateId, seed);
  if (multiPartChoiceTemplates.some((t) => t.id === templateId))
    return generateMultiPartChoiceProblem(templateId, seed);
  if (templateId === complexMultiplicationTemplate.id)
    return complexMultiplicationCase(seed).problem;
  if (financeCreditTemplateIds.has(templateId))
    return generateFinanceCreditProblem(templateId, seed);
  if (texasHsTemplates.some((t) => t.id === templateId))
    return generateTexasHsProblem(templateId, seed);
  if (algebraRequirementGapTemplates.some((t) => t.id === templateId))
    return generateAlgebraRequirementGapProblem(templateId, seed);
  if (satAlgebraStructureTemplates.some((t) => t.id === templateId))
    return generateSatAlgebraStructureProblem(templateId, seed);
  if (remainingGapTemplates.some((t) => t.id === templateId))
    return generateRemainingGapProblem(templateId, seed);
  if (financeIncomeTemplates.some((t) => t.id === templateId))
    return generateFinanceIncomeProblem(templateId, seed);
  if (dataDisplayStateTemplates.some((t) => t.id === templateId))
    return generateDataDisplayStateProblem(templateId, seed);
  if (vectorMatrixTemplates.some((t) => t.id === templateId))
    return generateVectorMatrixProblem(templateId, seed);
  if (trigonometryTemplates.some((t) => t.id === templateId))
    return generateTrigonometryProblem(templateId, seed);
  if (geometryModelingTemplates.some((t) => t.id === templateId))
    return generateGeometryModelingProblem(templateId, seed);
  if (geometryRequirementGapTemplates.some((t) => t.id === templateId))
    return generateGeometryRequirementGapProblem(templateId, seed);
  if (absoluteValueTemplates.some((t) => t.id === templateId))
    return generateAbsoluteValueProblem(templateId, seed);
  if (measurementTemplates.some((t) => t.id === templateId))
    return generateMeasurementProblem(templateId, seed);
  if (algebraTemplates.some((t) => t.id === templateId))
    return generateAlgebraProblem(templateId, seed);
  if (choiceTemplates.some((t) => t.id === templateId))
    return generateChoiceProblem(templateId, seed);
  if (equalGroupsTemplates.some((t) => t.id === templateId))
    return generateEqualGroupsProblem(templateId, seed);
  if (fractionPracticeTemplates.some((t) => t.id === templateId))
    return generateFractionPracticeProblem(templateId, seed);
  if (templateId === fractionDivisionExpressionTemplate.id)
    return fractionDivisionExpressionCase(seed).problem;
  if (templateId === linearInitialValueMeaningTemplate.id)
    return linearInitialValueMeaningCase(seed).problem;
  if (templateId === quadrilateralHierarchyMultiselectTemplate.id)
    return generateQuadrilateralHierarchyMultiselect(seed);
  if (elementaryTemplates.some((t) => t.id === templateId))
    return generateElementaryProblem(templateId, seed);
  if (graphicalTemplates.some((t) => t.id === templateId))
    return generateGraphicalProblem(templateId, seed);
  if (extendedTemplates.some((t) => t.id === templateId))
    return generateExtendedProblem(templateId, seed);
  const meta = templates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "";
  let explanation: string[] = [];
  let figure: SemanticFigure | undefined;
  let kind: "number" | "fraction" = "number";
  let variant: ProblemVariant | undefined;
  switch (templateId) {
    case "count-objects": {
      const n = r(1, 10);
      figure = { kind: "collection", count: n };
      prompt = "How many dots are shown?";
      answer = `${n}`;
      hint =
        n > 5
          ? "The top row has 5 dots. Count them, then keep counting along the bottom row without starting again."
          : "Start at the left dot and say one number for each dot as you touch it.";
      explanation = [
        `Count each dot once: ${Array.from({ length: n }, (_, i) => i + 1).join(", ")}.`,
        `There are ${n} dots.`,
      ];
      break;
    }
    case "add-within-20": {
      const a = r(0, 19),
        b = r(0, 20 - a);
      prompt = `What is ${a} + ${b}?`;
      answer = `${a + b}`;
      hint = addWithinTwentyHint(a, b);
      explanation = addWithinTwenty(a, b);
      // Hint and lesson walk the learner's own jumps (docs/figures.md).
      figure = { kind: "scene", scene: makeTenHops(a, b) };
      break;
    }
    case "subtract-within-20": {
      const a = r(1, 20),
        b = r(0, a);
      prompt = `What is ${a} − ${b}?`;
      answer = `${a - b}`;
      hint = subtractWithinTwentyHint(a, b);
      explanation = [
        `Start with ${a}. Remove ${b}.`,
        `${a} − ${b} = ${answer}.`,
      ];
      break;
    }
    case "fraction-model": {
      const parts = r(2, 12),
        selected = r(1, parts - 1);
      figure = { kind: "fraction", selected, parts };
      kind = "fraction";
      prompt = "What fraction of the whole is shaded?";
      answer = rational(BigInt(selected), BigInt(parts));
      hint = `The whole is cut into ${parts} equal parts, so the denominator is ${parts}. The numerator counts the shaded parts.`;
      explanation = [
        `${selected} of ${parts} equal parts are shaded.`,
        `The fraction is ${selected}/${parts}, equivalent to ${answer}.`,
      ];
      break;
    }
    case "add-fractions": {
      const b = r(2, 12),
        d = r(2, 12),
        a = r(1, b - 1),
        c = r(1, d - 1);
      prompt = `What is ${a}/${b} + ${c}/${d}?`;
      kind = "fraction";
      answer = rational(BigInt(a * d + c * b), BigInt(b * d));
      const common = (b * d) / Number(gcd(BigInt(b), BigInt(d)));
      hint =
        b === d
          ? `${a}/${b} and ${c}/${d} count the same size of piece. Add the numerators, ${a} + ${c}, and keep the denominator ${b}.`
          : `${b} and ${d} are different piece sizes. Rename ${a}/${b} and ${c}/${d} as fractions with denominator ${common}, a multiple of both.`;
      const sum = (a * common) / b + (c * common) / d;
      explanation =
        b === d
          ? [
              `Both fractions count pieces of size 1/${b}.`,
              `Add the numerators: ${a} + ${c} = ${a + c}, so the sum is ${a + c}/${b} = ${answer}.`,
            ]
          : [
              `A common denominator is ${common}, a multiple of ${b} and ${d}.`,
              `${a}/${b} = ${(a * common) / b}/${common} and ${c}/${d} = ${(c * common) / d}/${common}.`,
              `Add the numerators: ${sum}/${common} = ${answer}.`,
            ];
      break;
    }
    case "rectangle-area": {
      const width = r(2, 15),
        height = r(2, 15);
      figure = { kind: "rectangle", width, height, unit: "cm" };
      prompt = `A rectangle is ${width} cm wide and ${height} cm high. What is its area in square centimeters?`;
      answer = `${width * height}`;
      hint = `Picture square centimeters filling the rectangle: ${height} rows, each ${width} squares long.`;
      explanation = [
        "Each row contains one square centimeter per centimeter of width.",
        `${width} × ${height} = ${answer} square centimeters.`,
      ];
      break;
    }
    case "linear-equation": {
      const a = r(2, 12),
        b = r(1, 20),
        x = r(-12, 12),
        c = a * x + b;
      prompt = `Solve for $x$: $${a}x + ${b} = ${c}$.`;
      answer = `${x}`;
      hint = `Undo the + ${b} first: subtract ${b} from both sides of ${a}x + ${b} = ${c}.`;
      explanation = [
        `Subtract ${b}: ${a}x = ${c - b}.`,
        `Divide by ${a}: x = ${answer}.`,
      ];
      break;
    }
    case "mean-data": {
      const values = Array.from({ length: 5 }, () => r(1, 30));
      const sum = values.reduce((a, b) => a + b, 0);
      figure = { kind: "dataset", values };
      prompt = `What is the mean of ${values.join(", ")}?`;
      answer = rational(BigInt(sum), 5n);
      kind = "fraction";
      hint = `Add the values, ${values.join(" + ")}, then share that total equally among the five values.`;
      const mean = sum % 5 === 0 ? `${sum / 5}` : `${sum / 5} = ${answer}`;
      explanation = [
        "The mean is the sum of the values divided by the number of values.",
        `Sum: ${values.join(" + ")} = ${sum}.`,
        `There are 5 values: ${sum} ÷ 5 = ${mean}.`,
      ];
      break;
    }
    case "right-triangle": {
      const axes = sweepChoose("right-triangle", seed);
      variant = sweepVariant(axes.hypotenuse, axes);
      if (axes.hypotenuse !== "integer-triple") {
        // Legs whose hypotenuse is irrational, rounded as the prompt asks.
        const places = axes.hypotenuse === "nearest-tenth" ? 1 : 0;
        let a = r(2, 12),
          b = r(2, 12);
        while (isPerfectSquare(a * a + b * b)) [a, b] = [r(2, 12), r(2, 12)];
        const sum = a * a + b * b;
        const rounded = roundedRoot(sum, places, "$c$");
        answer = rounded.answer;
        figure = { kind: "right-triangle", a, b, unit: "cm" };
        prompt = `A right triangle has perpendicular legs ${a} cm and ${b} cm. What is the hypotenuse length in centimeters, to the nearest ${rounded.unitWord}?`;
        hint = `The hypotenuse $c$ is the side opposite the right angle. Write $c^2 = ${a}^2 + ${b}^2$ and work out the right side. Then find which two ${places ? "tenths" : "whole numbers"} the square root lies between and decide which is nearer.`;
        explanation = [
          `$c^2 = ${a}^2 + ${b}^2 = ${sum}$, so $c = \\sqrt{${sum}}$.`,
          ...rounded.steps.slice(0, 2),
          `To the nearest ${rounded.unitWord}, the hypotenuse is ${answer} cm.`,
        ];
        break;
      }
      const scale = r(1, 6),
        triple = r(0, 1) ? [3, 4, 5] : [5, 12, 13];
      const a = triple[0]! * scale,
        b = triple[1]! * scale,
        c = triple[2]! * scale;
      figure = { kind: "right-triangle", a, b, unit: "cm" };
      prompt = `A right triangle has perpendicular legs ${a} cm and ${b} cm. What is the hypotenuse length in centimeters?`;
      answer = `${c}`;
      hint = `The hypotenuse $c$ is the side opposite the right angle. Write $c^2 = ${a}^2 + ${b}^2$ and work out the right side.`;
      explanation = [
        `c² = ${a}² + ${b}² = ${a * a + b * b}.`,
        `Take the positive square root: c = ${c} cm.`,
      ];
      break;
    }
    case "quadratic-vertex": {
      const a = r(1, 5),
        h = r(1, 12),
        k = r(1, 20);
      prompt = `For real $x$, what is the minimum value of $f(x) = ${a}(x − ${h})² + ${k}$?`;
      answer = `${k}`;
      hint = `$(x − ${h})²$ is never negative, and it is 0 when $x = ${h}$. What is $f(${h})$?`;
      explanation = [
        `${a}(x − ${h})² is at least zero because ${a} is positive.`,
        `At x = ${h}, it equals zero, so the minimum is ${k}.`,
      ];
      break;
    }
    case "geometric-sequence": {
      const axes = sweepChoose("geometric-sequence", seed);
      variant = sweepVariant(axes["ratio-form"], axes);
      if (axes["ratio-form"] !== "multiply-whole") {
        // Shrinking sequences: the start is a whole multiple of the divisor's
        // power, so every term is a whole number.
        const divisor = r(2, 5),
          n = r(3, 6),
          end = r(1, 6);
        const start = end * divisor ** (n - 1);
        answer = `${end}`;
        if (axes["ratio-form"] === "divide-whole") {
          prompt = `A pattern starts at ${start}. Each term is the previous term divided by ${divisor}. What is term ${n} (the first term is term 1)?`;
          hint = `From term 1 to term ${n} is ${n - 1} steps. Start at ${start} and divide by ${divisor} once per step.`;
          explanation = [
            `Each step divides by ${divisor}, so term ${n} is the first term divided by ${divisor} a total of ${n - 1} times.`,
            `Term ${n} is $${start} \\div ${divisor}^{${n - 1}} = ${answer}$.`,
          ];
        } else {
          prompt = `A geometric sequence has first term ${start} and common ratio $\\frac{1}{${divisor}}$. What is term ${n} (the first term is term 1)?`;
          hint = `From term 1 to term ${n} is ${n - 1} steps. Multiplying by $\\frac{1}{${divisor}}$ once per step splits the term into ${divisor} equal parts and keeps one.`;
          explanation = [
            `Term $n$ is the first term times the ratio raised to the power $n - 1$.`,
            `Term ${n} is $${start} \\times \\left(\\frac{1}{${divisor}}\\right)^{${n - 1}} = ${start} \\div ${divisor ** (n - 1)} = ${answer}$.`,
          ];
        }
        break;
      }
      const a = r(1, 9),
        ratio = r(2, 4),
        n = r(3, 7);
      prompt = `A geometric sequence has first term ${a} and common ratio ${ratio}. What is term ${n} (the first term is term 1)?`;
      answer = `${BigInt(a) * BigInt(ratio) ** BigInt(n - 1)}`;
      hint = `From term 1 to term ${n} is ${n - 1} steps. Start at ${a} and multiply by ${ratio} once per step.`;
      explanation = [
        `Term $n$ is the first term times the ratio raised to the power $n - 1$.`,
        `Term ${n} is $${a} \\times ${ratio}^{${n - 1}} = ${answer}$.`,
      ];
      break;
    }
    case "logarithm-integer": {
      const base = r(2, 5),
        power = r(2, 5),
        argument = base ** power;
      prompt = `What is log base ${base} of ${argument}?`;
      answer = `${power}`;
      hint = `log base ${base} of ${argument} asks: ${base} to what power is ${argument}? Multiply ${base} by itself until you reach ${argument}, counting the factors.`;
      explanation = [
        `Find $p$ such that $${base}^p = ${argument}$.`,
        `${base}^${power} = ${argument}, so the logarithm is ${power}.`,
      ];
      break;
    }
    default:
      throw new Error("Template has no generator");
  }
  const id = createHash("sha256")
    .update(JSON.stringify([templateId, meta.version, seed]))
    .digest("hex");
  const publicProblem: PublicProblem = {
    id,
    templateId,
    templateVersion: 1,
    seed,
    prompt,
    skillId: meta.skillId,
    response: {
      kind,
      label:
        kind === "fraction"
          ? "Answer (fraction, decimal, or whole number)"
          : "Answer",
    },
    ...(figure ? { figure } : {}),
  };
  return {
    public: publicProblem,
    answer,
    explanation,
    hint,
    ...(variant ? { variant } : {}),
  };
}
