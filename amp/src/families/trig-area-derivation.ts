import {
  trigAreaDerivationFacetMappings,
  trigAreaDerivationLessons,
  trigAreaDerivationMethods,
  trigAreaDerivationPrinciples,
} from "../content/trig-area-derivation-lessons";
import {
  trigAreaDerivationGenerate,
  trigAreaDerivationTemplates,
} from "../math/trig-area-derivation-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.SRT.D.9: derive area = ½ab sin C from the height to one given side
 * (point-plot foot, multi-part derivation, single-choice reasoning). */
export const family = {
  id: "trig-area-derivation",
  practice: {
    templates: trigAreaDerivationTemplates,
    generate: trigAreaDerivationGenerate,
    preserveAlgebra: true,
  },
  lessons: trigAreaDerivationLessons,
  methods: trigAreaDerivationMethods,
  principles: trigAreaDerivationPrinciples,
  facetMappings: trigAreaDerivationFacetMappings,
  archetypeLinks: {
    "trig-area-auxiliary-line": ["trig.triangle-area", "triangle.trig-ratio"],
    "trig-area-derivation-fill": [
      "trig.triangle-area",
      "proof.geometry-written",
    ],
    "trig-area-derivation-reasoning": [
      "trig.triangle-area",
      "proof.geometry-written",
    ],
  },
} satisfies ContentFamily;
