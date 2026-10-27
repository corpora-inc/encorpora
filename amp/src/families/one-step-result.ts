import type { ContentFamily } from "./registry/types";
import {
  oneStepResultGenerate,
  oneStepResultTemplates,
} from "../math/one-step-result-practice";
import {
  oneStepResultFacetMappings,
  oneStepResultLessons,
  oneStepResultMethods,
  oneStepResultPrinciples,
} from "../content/one-step-result-lessons";

export const family = {
  id: "one-step-result",
  practice: {
    templates: oneStepResultTemplates,
    generate: oneStepResultGenerate,
    preserveAlgebra: true,
  },
  lessons: oneStepResultLessons,
  methods: oneStepResultMethods,
  principles: oneStepResultPrinciples,
  facetMappings: oneStepResultFacetMappings,
  archetypeLinks: {
    "equation-after-one-step": ["linear.solve", "linear.structure"],
    "expression-after-first-step": ["expression.order-of-operations"],
    "factor-out-choice": ["expression.polynomial"],
    "step-reason-table": ["linear.step-justification"],
  },
  connections: [
    {
      from: "two-step-equations",
      to: "equation-reasoning",
      kind: "extension",
      explanation:
        "Choosing the equation after one step is the move whose reason equation-reasoning names: each step is a property of equality applied to both sides.",
      templateIds: ["step-reason-table"],
    },
    {
      from: "expression-properties",
      to: "two-step-equations",
      kind: "application",
      explanation:
        "Seeing $5(x+8)$ as one group multiplied by 5 is what lets an equation be divided by 5 in a single step; factoring a number out shows the common factor first.",
      templateIds: ["equation-after-one-step"],
    },
  ],
} satisfies ContentFamily;
