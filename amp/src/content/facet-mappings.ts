import { descriptiveStatisticsFacetMappings } from "./descriptive-statistics-coverage";
import type { FacetMapping } from "./coverage";
import { inequalityFacetMappings } from "./inequality-coverage";
import { linearSystemFacetMappings } from "./linear-system-coverage";
import { rightTriangleFacetMappings } from "./right-triangle-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  ...descriptiveStatisticsFacetMappings,
  ...rightTriangleFacetMappings,
  ...inequalityFacetMappings,
  ...linearSystemFacetMappings,
];
