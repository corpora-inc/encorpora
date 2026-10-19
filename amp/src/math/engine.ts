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
import { elementaryTemplates, generateElementaryProblem } from "./elementary";
import { graphicalTemplates, generateGraphicalProblem } from "./graphical";
import { extendedTemplates, generateExtendedProblem } from "./extended";
import { createHash } from "node:crypto";
import { makeTenHops } from "./scene/explanations";
import { polish } from "./polish";
import type {
  GeneratedProblem,
  PublicProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
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
  ...transformationTemplates,
  ...angleTriangleTemplates,
  ...realNumberTemplates,
  ...numberSystemTemplates,
  ...probabilityRulesTemplates,
  ...similarityTrigTemplates,
  ...coordinateCircleTemplates,
  ...ratioRateTemplates,
  ...patternFunctionTemplates,
  ...linearFunctionTemplates,
  ...twoVariableTemplates,
  ...equationTemplates,
  ...rationalTemplates,
  ...circleMeasurementTemplates,
  ...partWholeTemplates,
  ...attributeTemplates,
  ...timeMoneyTemplates,
  ...decimalTemplates,
  ...percentChangeTemplates,
  ...inequalityTemplates,
  ...linearSystemTemplates,
  ...absoluteValueTemplates,
  ...graphicalTemplates,
  ...elementaryTemplates,
  ...fractionPracticeTemplates,
  ...algebraTemplates,
  ...choiceTemplates,
  ...equalGroupsTemplates,
  ...completingSquareTemplates,
  ...factoringTemplates,
  ...distributionTemplates,
  ...inferenceTemplates,
  ...bivariateTemplates,
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
  return problem.response.kind === "choice"
    ? problem.response.options.some((option) => option.id === response)
    : normalizeAnswer(response) !== null;
}
export function gradeAnswer(
  problem: GeneratedProblem,
  response: string,
): boolean {
  if (problem.public.response.kind === "choice")
    return (
      isValidResponse(problem.public, response) && response === problem.answer
    );
  const answer = normalizeAnswer(response);
  return answer !== null && answer === normalizeAnswer(problem.answer);
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
    ...transformationTemplates,
    ...completingSquareTemplates,
    ...factoringTemplates,
    ...shapeTemplates,
    ...polygonTemplates,
    ...exponentialTemplates,
    ...angleTemplates,
    ...patternFunctionTemplates,
    ...linearFunctionTemplates,
    ...twoVariableTemplates,
    ...equationTemplates,
    ...volumeCoordinateTemplates,
    ...distributionTemplates,
    ...inferenceTemplates,
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
    ...coordinateCircleTemplates,
    ...ratioRateTemplates,
    ...radicalTemplates,
    ...rationalTemplates,
    ...circleMeasurementTemplates,
    ...integerExponentTemplates,
    ...descriptiveStatisticsTemplates,
    ...percentChangeTemplates,
    ...inequalityTemplates,
    ...linearSystemTemplates,
    ...absoluteValueTemplates,
  ].some((t) => t.id === problem.public.templateId);
  const text = (value: string) => (preserveAlgebra ? value : polish(value));
  return {
    ...problem,
    public: { ...problem.public, prompt: text(problem.public.prompt) },
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
  if (similarityTrigTemplates.some((t) => t.id === templateId))
    return generateSimilarityTrigProblem(templateId, seed);
  if (coordinateCircleTemplates.some((t) => t.id === templateId))
    return generateCoordinateCircleProblem(templateId, seed);
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
      prompt = `Solve for x: ${a}x + ${b} = ${c}.`;
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
      const scale = r(1, 6),
        triple = r(0, 1) ? [3, 4, 5] : [5, 12, 13];
      const a = triple[0]! * scale,
        b = triple[1]! * scale,
        c = triple[2]! * scale;
      figure = { kind: "right-triangle", a, b, unit: "cm" };
      prompt = `A right triangle has perpendicular legs ${a} cm and ${b} cm. What is the hypotenuse length in centimeters?`;
      answer = `${c}`;
      hint = `The hypotenuse c is the side opposite the right angle. Write c² = ${a}² + ${b}² and work out the right side.`;
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
      prompt = `For real x, what is the minimum value of f(x) = ${a}(x − ${h})² + ${k}?`;
      answer = `${k}`;
      hint = `(x − ${h})² is never negative, and it is 0 when x = ${h}. What is f(${h})?`;
      explanation = [
        `${a}(x − ${h})² is at least zero because ${a} is positive.`,
        `At x = ${h}, it equals zero, so the minimum is ${k}.`,
      ];
      break;
    }
    case "geometric-sequence": {
      const a = r(1, 9),
        ratio = r(2, 4),
        n = r(3, 7);
      prompt = `A geometric sequence has first term ${a} and common ratio ${ratio}. What is term ${n} (the first term is term 1)?`;
      answer = `${BigInt(a) * BigInt(ratio) ** BigInt(n - 1)}`;
      hint = `From term 1 to term ${n} is ${n - 1} steps. Start at ${a} and multiply by ${ratio} once per step.`;
      explanation = [
        `Term n = first term × ratio^(n − 1).`,
        `Term ${n} = ${a} × ${ratio}^${n - 1} = ${answer}.`,
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
        `Find p such that ${base}^p = ${argument}.`,
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
  return { public: publicProblem, answer, explanation, hint };
}
