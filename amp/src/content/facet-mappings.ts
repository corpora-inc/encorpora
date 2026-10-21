import { areaVolumeFacetMappings } from "./area-volume-coverage";
import { transformationFacetMappings } from "./transformation-coverage";
import { completingSquareFacetMappings } from "./completing-square-coverage";
import { factoringFacetMappings } from "./factoring-coverage";
import { numberSystemFacetMappings } from "./number-system-coverage";
import { patternFunctionFacetMappings } from "./pattern-function-coverage";
import { linearFunctionFacetMappings } from "./linear-function-coverage";
import { quadraticStructureFacetMappings } from "./quadratic-structure-coverage";
import { functionToolkitFacetMappings } from "./function-toolkit-coverage";
import { twoVariableFacetMappings } from "./two-variable-coverage";
import { equationFacetMappings } from "./equation-coverage";
import { decimalFacetMappings } from "./decimal-coverage";
import { timeMoneyFacetMappings } from "./time-money-coverage";
import { attributeFacetMappings } from "./attribute-coverage";
import { volumeCoordinateFacetMappings } from "./volume-coordinate-coverage";
import { shapeFacetMappings } from "./shape-coverage";
import { angleFacetMappings } from "./angle-coverage";
import { polygonFacetMappings } from "./polygon-coverage";
import { exponentialFacetMappings } from "./exponential-coverage";
import { probabilityRulesFacetMappings } from "./probability-rules-coverage";
import { similarityTrigFacetMappings } from "./similarity-trig-coverage";
import { coordinateCircleFacetMappings } from "./coordinate-circle-coverage";
import { algebraStatisticsFacetMappings } from "./algebra-statistics-coverage";
import { powerFacetMappings } from "./power-coverage";
import { distributionFacetMappings } from "./distribution-coverage";
import { ratioRateFacetMappings } from "./ratio-rate-coverage";
import { inferenceFacetMappings } from "./inference-coverage";
import { bivariateFacetMappings } from "./bivariate-coverage";
import { partWholeFacetMappings } from "./part-whole-coverage";
import { linePlotFacetMappings } from "./line-plot-coverage";
import { earlyDataFacetMappings } from "./early-data-coverage";
import { combinatoricsFacetMappings } from "./combinatorics-coverage";
import { angleTriangleFacetMappings } from "./angle-triangle-coverage";
import { realNumberFacetMappings } from "./real-number-coverage";
import { radicalFacetMappings } from "./radical-coverage";
import { comparisonFacetMappings } from "./comparison-coverage";
import { numberSenseFacetMappings } from "./number-sense-coverage";
import { multiplyDivideFacetMappings } from "./multiply-divide-coverage";
import { addSubtractFacetMappings } from "./add-subtract-coverage";
import { factsFacetMappings } from "./facts-coverage";
import { factArrayFacetMappings } from "./fact-arrays-coverage";
import { rationalFacetMappings } from "./rational-coverage";
import { circleMeasurementFacetMappings } from "./circle-measurement-coverage";
import { integerExponentFacetMappings } from "./integer-exponent-coverage";
import { descriptiveStatisticsFacetMappings } from "./descriptive-statistics-coverage";
import { percentChangeFacetMappings } from "./percent-change-coverage";
import type { FacetMapping } from "./coverage";
import { inequalityFacetMappings } from "./inequality-coverage";
import { linearSystemFacetMappings } from "./linear-system-coverage";
import { rightTriangleFacetMappings } from "./right-triangle-coverage";
import { absoluteValueFacetMappings } from "./absolute-value-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "rational-expression-domain",
    facetId: "rational-expression-domain.factored-denominator",
    extent: "partial",
    rationale:
      "Choose excluded integer inputs for a denominator given as two monic linear factors, including a repeated factor. Does not assess expanded or higher-degree denominators, noninteger exclusions or constructed domain statements.",
  },
  {
    templateId: "rational-expression-simplify",
    facetId: "rational-expressions.cancel-common-linear-factor",
    extent: "partial",
    rationale:
      "Choose an equivalent linear-over-linear expression and complete original integer exclusions after factoring bounded quadratics with one shared factor. Recognition only; general rational operations and constructed symbolic responses require separate assessment.",
  },
  ...[
    "nonlinear-system-read",
    "nonlinear-system-solve",
    "nonlinear-system-count",
  ].map((templateId): FacetMapping => ({
    templateId,
    facetId:
      templateId === "nonlinear-system-read"
        ? "nonlinear-intersection-reading.core"
        : templateId === "nonlinear-system-count"
          ? "nonlinear-intersection-count.core"
          : "nonlinear-systems.core",
    extent: "partial",
    rationale:
      "Bounded line–parabola systems: read intersections, find a requested coordinate for distinct integer roots, or count real intersections. Does not assess complete constructed solution sets, other nonlinear pairs, fractional coordinates, contextual modeling or symbolic parameter conditions.",
  })),
  ...factoringFacetMappings,
  ...volumeCoordinateFacetMappings,
  ...shapeFacetMappings,
  ...angleFacetMappings,
  ...polygonFacetMappings,
  ...exponentialFacetMappings,
  ...probabilityRulesFacetMappings,
  ...similarityTrigFacetMappings,
  ...coordinateCircleFacetMappings,
  ...algebraStatisticsFacetMappings,
  ...powerFacetMappings,
  ...distributionFacetMappings,
  ...inferenceFacetMappings,
  ...bivariateFacetMappings,
  ...linePlotFacetMappings,
  ...earlyDataFacetMappings,
  ...radicalFacetMappings,
  ...partWholeFacetMappings,
  ...decimalFacetMappings,
  ...timeMoneyFacetMappings,
  ...attributeFacetMappings,
  ...comparisonFacetMappings,
  ...numberSenseFacetMappings,
  ...multiplyDivideFacetMappings,
  ...addSubtractFacetMappings,
  ...factsFacetMappings,
  ...factArrayFacetMappings,
  ...combinatoricsFacetMappings,
  ...areaVolumeFacetMappings,
  ...transformationFacetMappings,
  ...angleTriangleFacetMappings,
  ...realNumberFacetMappings,
  ...numberSystemFacetMappings,
  ...ratioRateFacetMappings,
  ...patternFunctionFacetMappings,
  ...linearFunctionFacetMappings,
  ...quadraticStructureFacetMappings,
  ...functionToolkitFacetMappings,
  ...twoVariableFacetMappings,
  ...equationFacetMappings,
  ...rationalFacetMappings,
  ...circleMeasurementFacetMappings,
  ...completingSquareFacetMappings,
  ...integerExponentFacetMappings,
  ...descriptiveStatisticsFacetMappings,
  ...percentChangeFacetMappings,
  ...rightTriangleFacetMappings,
  ...absoluteValueFacetMappings,
  ...inequalityFacetMappings,
  ...linearSystemFacetMappings,
];
