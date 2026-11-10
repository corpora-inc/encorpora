import {
  congruenceCriterionProofContent,
  congruenceCriterionProofFacetMappings,
} from "../content/congruence-criterion-proof-lessons";
import {
  congruenceCriterionProofGenerate,
  congruenceCriterionProofTemplates,
} from "../math/congruence-criterion-proof-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.CO.B.8: SAS, ASA and SSS proved from the rigid-motion definition of
 * congruence (proof lines, step justifications, and flaws including SSA
 * and AAA). */
export const family = {
  id: "congruence-criterion-proof",
  practice: {
    templates: congruenceCriterionProofTemplates,
    generate: congruenceCriterionProofGenerate,
    preserveAlgebra: true,
  },
  lessons: congruenceCriterionProofContent.lessons,
  methods: congruenceCriterionProofContent.methods,
  principles: congruenceCriterionProofContent.principles,
  facetMappings: congruenceCriterionProofFacetMappings,
  archetypeLinks: {
    "rigid-motion-criterion-proof": [
      "triangle.congruence-transformations",
      "proof.geometry-written",
      "triangle.relationships",
    ],
    "rigid-motion-criterion-reason": [
      "triangle.congruence-transformations",
      "transformation.invariants",
    ],
    "rigid-motion-criterion-flaw": [
      "triangle.congruence-transformations",
      "triangle.uniqueness",
    ],
  },
} satisfies ContentFamily;
