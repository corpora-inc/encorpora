import type { FacetMapping } from "./coverage";
import { rightTriangleFacetMappings } from "./right-triangle-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  ...rightTriangleFacetMappings,
];
