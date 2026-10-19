import { linePlotFacetMappings } from "./line-plot-coverage";
import { earlyDataFacetMappings } from "./early-data-coverage";
import { combinatoricsFacetMappings } from "./combinatorics-coverage";
import { radicalFacetMappings } from "./radical-coverage";
import { comparisonFacetMappings } from "./comparison-coverage";
import { multiplyDivideFacetMappings } from "./multiply-divide-coverage";
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
  ...linePlotFacetMappings,
  ...earlyDataFacetMappings,
  ...radicalFacetMappings,
  ...comparisonFacetMappings,
  ...multiplyDivideFacetMappings,
  ...combinatoricsFacetMappings,
  ...rationalFacetMappings,
  ...circleMeasurementFacetMappings,
  ...integerExponentFacetMappings,
  ...descriptiveStatisticsFacetMappings,
  ...percentChangeFacetMappings,
  ...rightTriangleFacetMappings,
  ...inequalityFacetMappings,
  ...linearSystemFacetMappings,
];
