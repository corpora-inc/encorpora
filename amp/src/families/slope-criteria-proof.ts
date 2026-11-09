import type { ContentFamily } from "./registry/types";
import {
  generateSlopeCriteriaProof,
  slopeCriteriaProofTemplate,
} from "../math/slope-criteria-proof-practice";
import {
  slopeCriteriaProofFacetMappings,
  slopeCriteriaProofLessons,
  slopeCriteriaProofMethods,
  slopeCriteriaProofPrinciples,
} from "../content/slope-criteria-proof-lessons";

/** Ordered reasons for the parallel and perpendicular slope criteria (HSG.GPE.B.5). */
export const family = {
  id: "slope-criteria-proof",
  practice: {
    templates: [slopeCriteriaProofTemplate],
    generate: generateSlopeCriteriaProof,
    preserveAlgebra: true,
  },
  lessons: slopeCriteriaProofLessons,
  methods: slopeCriteriaProofMethods,
  principles: slopeCriteriaProofPrinciples,
  facetMappings: slopeCriteriaProofFacetMappings,
} satisfies ContentFamily;
