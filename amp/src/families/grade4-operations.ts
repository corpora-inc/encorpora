import {
  grade4OperationsFacetMappings,
  grade4OperationsLessons,
  grade4OperationsMethods,
  grade4OperationsPrinciples,
} from "../content/grade4-operations-lessons";
import {
  generateGrade4OperationsProblem,
  grade4OperationsTemplates,
} from "../math/grade4-operations-practice";
import type { ContentFamily } from "./registry/types";

/** Grade-4 number-and-operations practice that was missing from the catalog. */
export const family = {
  id: "grade4-operations",
  practice: {
    templates: grade4OperationsTemplates,
    generate: generateGrade4OperationsProblem,
    preserveAlgebra: true,
  },
  lessons: grade4OperationsLessons,
  methods: grade4OperationsMethods,
  principles: grade4OperationsPrinciples,
  facetMappings: grade4OperationsFacetMappings,
  archetypes: [
    {
      id: "number.facts-through-twelve",
      domain: "number",
      summary: "Multiply or divide when a factor or the divisor is 11 or 12.",
    },
    {
      id: "number.one-digit-multiples",
      domain: "number",
      summary: "Select the multiples of a one-digit whole number.",
    },
  ],
  archetypeLinks: {
    "multiply-two-digit": ["number.multidigit-multiply-context"],
    "quotient-remainder-one-digit": ["whole.divide-one-digit"],
    "factor-pairs-select": ["number.factor-pairs"],
    "multiples-select": ["number.one-digit-multiples"],
    "facts-to-twelve": ["number.facts-through-twelve"],
    "growing-shape-pattern": ["pattern.rule"],
  },
} satisfies ContentFamily;
