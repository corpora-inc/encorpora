import type { ContentFamily } from "./registry/types";
import { generateExponentialContextEquation, exponentialContextEquationTemplate } from "../math/exponential-context-equation-practice";
import {
  exponentialContextEquationFacetMappings,
  exponentialContextEquationLessons,
  exponentialContextEquationMethods,
  exponentialContextEquationPrinciples,
} from "../content/exponential-context-equation-lessons";

/** Exponential situation to equation, then a base-matched solution (HSA.CED.A.1). */
export const family = {
  id: "exponential-context-equation",
  practice: {
    templates: [exponentialContextEquationTemplate],
    generate: generateExponentialContextEquation,
    preserveAlgebra: true,
  },
  lessons: exponentialContextEquationLessons,
  methods: exponentialContextEquationMethods,
  principles: exponentialContextEquationPrinciples,
  facetMappings: exponentialContextEquationFacetMappings,
} satisfies ContentFamily;
