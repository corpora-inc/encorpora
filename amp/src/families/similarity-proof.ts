import {
  similarityProofContent,
  similarityProofFacetMappings,
} from "../content/similarity-proof-lessons";
import {
  similarityProofGenerate,
  similarityProofTemplates,
} from "../math/similarity-proof-practice";
import type { ContentFamily } from "./registry/types";

/** Two-column AA similarity proofs ending in a proportion of sides
 * (structured-work-v1). */
export const family = {
  id: "similarity-proof",
  practice: {
    templates: similarityProofTemplates,
    generate: similarityProofGenerate,
    preserveAlgebra: true,
  },
  lessons: similarityProofContent.lessons,
  methods: similarityProofContent.methods,
  principles: similarityProofContent.principles,
  facetMappings: similarityProofFacetMappings,
  archetypeLinks: {
    "similarity-proof-aa": ["proof.geometry-written", "triangle.relationships"],
  },
} satisfies ContentFamily;
