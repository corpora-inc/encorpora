import {
  parallelogramProofContent,
  parallelogramProofFacetMappings,
} from "../content/parallelogram-proof-lessons";
import {
  parallelogramProofGenerate,
  parallelogramProofTemplates,
} from "../math/parallelogram-proof-practice";
import type { ContentFamily } from "./registry/types";

/** Proofs of the parallelogram theorems and their converses (HSG.CO.C.11):
 * fill in or order a two-column proof (structured-work-v1), and audit
 * arguments, near-converses and explanations (single-choice-v1). */
export const family = {
  id: "parallelogram-proof",
  practice: {
    templates: parallelogramProofTemplates,
    generate: parallelogramProofGenerate,
    preserveAlgebra: true,
  },
  lessons: parallelogramProofContent.lessons,
  methods: parallelogramProofContent.methods,
  principles: parallelogramProofContent.principles,
  facetMappings: parallelogramProofFacetMappings,
  archetypeLinks: {
    "parallelogram-proof-fill": [
      "proof.parallelogram",
      "proof.geometry-written",
    ],
    "parallelogram-proof-order": [
      "proof.parallelogram",
      "proof.geometry-written",
    ],
    "parallelogram-converse-reasoning": [
      "proof.parallelogram",
      "proof.geometry-written",
    ],
  },
} satisfies ContentFamily;
