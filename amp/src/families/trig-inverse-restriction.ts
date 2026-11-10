import {
  trigInverseRestrictionFacetMappings,
  trigInverseRestrictionLessons,
  trigInverseRestrictionMethods,
  trigInverseRestrictionPrinciples,
} from "../content/trig-inverse-restriction-lessons";
import {
  trigInverseRestrictionGenerate,
  trigInverseRestrictionTemplates,
} from "../math/trig-inverse-restriction-practice";
import type { ContentFamily } from "./registry/types";

/** HSF.TF.B.6: restrict a trigonometric function so its inverse can be
 * built (single-choice, figure-choice, multi-select, multi-part-choice). */
export const family = {
  id: "trig-inverse-restriction",
  practice: {
    templates: trigInverseRestrictionTemplates,
    generate: trigInverseRestrictionGenerate,
    preserveAlgebra: true,
  },
  lessons: trigInverseRestrictionLessons,
  methods: trigInverseRestrictionMethods,
  principles: trigInverseRestrictionPrinciples,
  facetMappings: trigInverseRestrictionFacetMappings,
  archetypeLinks: {
    "trig-restriction-domain": ["trig.inverse", "function.domain-range"],
    "trig-restriction-domain-graph": ["trig.inverse", "function.domain-range"],
    "trig-one-to-one-intervals": ["function.domain-range"],
    "restricted-trig-inverse": ["trig.inverse", "function.inverse"],
    "trig-inverse-why-restrict": ["trig.inverse", "function.inverse"],
  },
} satisfies ContentFamily;
