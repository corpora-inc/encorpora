import type { FacetMapping } from "./coverage";
import { inequalityFacetMappings } from "./inequality-coverage";

/** Authored task-domain associations; evidence controls tested, reviewed and published states. */
export const actualFacetMappings: readonly FacetMapping[] = [
  ...inequalityFacetMappings,
];
