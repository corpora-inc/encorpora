import {
  parabolaDerivationContent,
  parabolaDerivationFacetMappings,
} from "../content/parabola-derivation-lessons";
import {
  parabolaDerivationGenerate,
  parabolaDerivationTemplates,
} from "../math/parabola-derivation-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.GPE.A.2: derive a parabola's equation from its focus and directrix
 * line by line, check a derivation, and apply the equal-distance rule at one
 * point (multi-part-choice-v1 and single-choice-v1). */
export const family = {
  id: "parabola-derivation",
  practice: {
    templates: parabolaDerivationTemplates,
    generate: parabolaDerivationGenerate,
    preserveAlgebra: true,
  },
  lessons: parabolaDerivationContent.lessons,
  methods: parabolaDerivationContent.methods,
  principles: parabolaDerivationContent.principles,
  facetMappings: parabolaDerivationFacetMappings,
  archetypeLinks: {
    "parabola-derive-equation": ["conic.parabola"],
    "parabola-derivation-check": ["conic.parabola"],
    "parabola-point-equidistance": [
      "conic.parabola",
      "coordinate.distance-midpoint",
    ],
  },
} satisfies ContentFamily;
