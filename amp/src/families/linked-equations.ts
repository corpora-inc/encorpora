import type { ContentFamily } from "./registry/types";
import {
  linkedEquationGenerate,
  linkedEquationTemplates,
} from "../math/linked-equation-practice";
import {
  linkedEquationFacetMappings,
  linkedEquationLessons,
  linkedEquationMethods,
  linkedEquationPrinciples,
} from "../content/linked-equation-lessons";

export const family = {
  id: "linked-equations",
  practice: {
    templates: linkedEquationTemplates,
    generate: linkedEquationGenerate,
    preserveAlgebra: true,
  },
  lessons: linkedEquationLessons,
  methods: linkedEquationMethods,
  principles: linkedEquationPrinciples,
  facetMappings: linkedEquationFacetMappings,
  archetypeLinks: {
    "linked-division-equations": ["expression.multistep-equations"],
    "linked-time-equations": [
      "expression.multistep-equations",
      "early.two-step-story",
    ],
  },
} satisfies ContentFamily;
