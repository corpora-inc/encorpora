import type { ContentFamily } from "./registry/types";
import {
  fractionChoiceGenerate,
  fractionChoiceTemplates,
} from "../math/fraction-choice-practice";
import {
  fractionChoiceFacetMappings,
  fractionChoiceLessons,
  fractionChoiceMethods,
  fractionChoicePrinciples,
} from "../content/fraction-choice-lessons";

export const family = {
  id: "fraction-choice",
  practice: {
    templates: fractionChoiceTemplates,
    generate: fractionChoiceGenerate,
    preserveAlgebra: true,
  },
  lessons: fractionChoiceLessons,
  methods: fractionChoiceMethods,
  principles: fractionChoicePrinciples,
  facetMappings: fractionChoiceFacetMappings,
  archetypeLinks: { "fraction-choice-compare": ["fractions.compare"] },
  connections: [
    {
      from: "fraction-comparison",
      to: "fraction-addition",
      kind: "application",
      explanation:
        "Deciding which of two fractions is greater with a common denominator is the same rewriting that adds and subtracts unlike fractions, and it lets a sum or difference be estimated from the nearest of 0, one half and 1.",
      templateIds: ["benchmark-fraction-estimate"],
    },
  ],
} satisfies ContentFamily;
