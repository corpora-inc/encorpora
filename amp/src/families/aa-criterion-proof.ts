import {
  aaCriterionProofContent,
  aaCriterionProofFacetMappings,
} from "../content/aa-criterion-proof-lessons";
import {
  aaCriterionGenerate,
  aaCriterionTemplates,
} from "../math/aa-criterion-proof-practice";
import type { ContentFamily } from "./registry/types";

/** The AA criterion established from similarity transformations
 * (HSG.SRT.A.3): build or justify the proof (structured-work-v1), name the
 * property behind a step, and find the flaw in an argument
 * (single-choice-v1). */
export const family = {
  id: "aa-criterion-proof",
  practice: {
    templates: aaCriterionTemplates,
    generate: aaCriterionGenerate,
    preserveAlgebra: true,
  },
  lessons: aaCriterionProofContent.lessons,
  methods: aaCriterionProofContent.methods,
  principles: aaCriterionProofContent.principles,
  facetMappings: aaCriterionProofFacetMappings,
  archetypeLinks: {
    "aa-criterion-proof-build": [
      "proof.geometry-written",
      "triangle.relationships",
    ],
    "aa-criterion-step-reason": [
      "triangle.relationships",
      "transformation.invariants",
    ],
    "aa-criterion-argument-check": [
      "triangle.relationships",
      "proof.geometry-written",
    ],
  },
} satisfies ContentFamily;
