import type { ContentFamily } from "./registry/types";
import {
  rationalExponentMeaningGenerate,
  rationalExponentMeaningTemplates,
} from "../math/rational-exponent-meaning-practice";
import {
  rationalExponentMeaningFacetMappings,
  rationalExponentMeaningLessons,
  rationalExponentMeaningMethods,
  rationalExponentMeaningPrinciples,
} from "../content/rational-exponent-meaning-lessons";

/** Why a fraction exponent is a root (HSN.RN.A.1): build, test and explain
 * the argument from the power-of-a-power law (single-choice-v1). */
export const family = {
  id: "rational-exponent-meaning",
  practice: {
    templates: rationalExponentMeaningTemplates,
    generate: rationalExponentMeaningGenerate,
    preserveAlgebra: true,
  },
  lessons: rationalExponentMeaningLessons,
  methods: rationalExponentMeaningMethods,
  principles: rationalExponentMeaningPrinciples,
  facetMappings: rationalExponentMeaningFacetMappings,
  archetypeLinks: {
    "rational-exponent-derivation": ["expression.radical"],
    "rational-exponent-definition-test": ["expression.radical"],
    "radical-exponent-notation-reason": ["expression.radical"],
  },
} satisfies ContentFamily;
