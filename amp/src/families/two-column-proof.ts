import {
  twoColumnProofContent,
  twoColumnProofFacetMappings,
} from "../content/two-column-proof-lessons";
import {
  twoColumnProofGenerate,
  twoColumnProofTemplates,
} from "../math/two-column-proof-practice";
import type { ContentFamily } from "./registry/types";

/** Two-column proofs built from statement and reason banks
 * (structured-work-v1). */
export const family = {
  id: "two-column-proof",
  practice: {
    templates: twoColumnProofTemplates,
    generate: twoColumnProofGenerate,
    preserveAlgebra: true,
  },
  lessons: twoColumnProofContent.lessons,
  methods: twoColumnProofContent.methods,
  principles: twoColumnProofContent.principles,
  facetMappings: twoColumnProofFacetMappings,
  archetypeLinks: {
    "two-column-congruence-proof": [
      "proof.geometry-written",
      "triangle.relationships",
    ],
    "two-column-angle-proof": [
      "proof.geometry-written",
      "proof.line-angle",
      "angle.relationships",
    ],
  },
} satisfies ContentFamily;
