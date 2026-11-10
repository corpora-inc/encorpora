import {
  trigSymmetryReasoningFacetMappings,
  trigSymmetryReasoningLessons,
  trigSymmetryReasoningMethods,
  trigSymmetryReasoningPrinciples,
} from "../content/trig-symmetry-reasoning-lessons";
import {
  trigSymmetryReasoningGenerate,
  trigSymmetryReasoningTemplates,
} from "../math/trig-symmetry-reasoning-practice";
import type { ContentFamily } from "./registry/types";

/** HSF.TF.A.4: unit-circle explanations of even, odd and periodic
 * trigonometric functions (multi-part-choice, single-choice, multi-select). */
export const family = {
  id: "trig-symmetry-reasoning",
  practice: {
    templates: trigSymmetryReasoningTemplates,
    generate: trigSymmetryReasoningGenerate,
    preserveAlgebra: true,
  },
  lessons: trigSymmetryReasoningLessons,
  methods: trigSymmetryReasoningMethods,
  principles: trigSymmetryReasoningPrinciples,
  facetMappings: trigSymmetryReasoningFacetMappings,
  archetypeLinks: {
    "unit-circle-symmetry-derivation": ["circle.unit-trig"],
    "trig-periodicity-explanation": ["circle.unit-trig"],
    "unit-circle-claim-check": ["circle.unit-trig"],
  },
} satisfies ContentFamily;
