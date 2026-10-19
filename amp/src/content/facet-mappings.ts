import { patternFunctionFacetMappings } from "./pattern-function-coverage";
import { equationFacetMappings } from "./equation-coverage";
import { decimalFacetMappings } from "./decimal-coverage";
import { timeMoneyFacetMappings } from "./time-money-coverage";
import { volumeCoordinateFacetMappings } from "./volume-coordinate-coverage";
import { shapeFacetMappings } from "./shape-coverage";
import { distributionFacetMappings } from "./distribution-coverage";
import { inferenceFacetMappings } from "./inference-coverage";
import { partWholeFacetMappings } from "./part-whole-coverage";
import { linePlotFacetMappings } from "./line-plot-coverage";
import { earlyDataFacetMappings } from "./early-data-coverage";
import { combinatoricsFacetMappings } from "./combinatorics-coverage";
import { radicalFacetMappings } from "./radical-coverage";
import { comparisonFacetMappings } from "./comparison-coverage";
import { addSubtractFacetMappings } from "./add-subtract-coverage";
import { factsFacetMappings } from "./facts-coverage";
import { rationalFacetMappings } from "./rational-coverage";
import { circleMeasurementFacetMappings } from "./circle-measurement-coverage";
import { integerExponentFacetMappings } from "./integer-exponent-coverage";
import { descriptiveStatisticsFacetMappings } from "./descriptive-statistics-coverage";
import { percentChangeFacetMappings } from "./percent-change-coverage";
import type { FacetMapping } from "./coverage";
import { inequalityFacetMappings } from "./inequality-coverage";
import { linearSystemFacetMappings } from "./linear-system-coverage";
import { rightTriangleFacetMappings } from "./right-triangle-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  ...volumeCoordinateFacetMappings,
  ...shapeFacetMappings,
  ...distributionFacetMappings,
  ...inferenceFacetMappings,
  ...linePlotFacetMappings,
  ...earlyDataFacetMappings,
  ...radicalFacetMappings,
  ...partWholeFacetMappings,
  ...decimalFacetMappings,
  ...timeMoneyFacetMappings,
  ...comparisonFacetMappings,
  ...addSubtractFacetMappings,
  ...factsFacetMappings,
  ...combinatoricsFacetMappings,
  ...patternFunctionFacetMappings,
  ...equationFacetMappings,
  ...rationalFacetMappings,
  ...circleMeasurementFacetMappings,
  ...integerExponentFacetMappings,
  ...descriptiveStatisticsFacetMappings,
  ...percentChangeFacetMappings,
  ...rightTriangleFacetMappings,
  ...inequalityFacetMappings,
  ...linearSystemFacetMappings,
];
