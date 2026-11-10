import type { ContentFamily } from "./registry/types";
import {
  equalAddendsTemplates,
  generateEqualAddends,
} from "../math/equal-addends-practice";
import {
  equalAddendsLesson,
  equalAddendsMethod,
  equalAddendsPrinciple,
} from "../content/equal-addends-lessons";

export const family = {
  id: "equal-addends",
  practice: {
    templates: equalAddendsTemplates,
    generate: generateEqualAddends,
    preserveAlgebra: true,
  },
  lessons: [equalAddendsLesson],
  methods: { "array-equal-addends-equation": equalAddendsMethod },
  principles: { "array-equal-addends-equation": equalAddendsPrinciple },
  facetMappings: [
    {
      templateId: "array-equal-addends-equation",
      facetId: "arrays.core",
      extent: "complete",
      rationale:
        "Builds arrays up to 5 by 5 and writes equal-addend sums for rows or columns, with exact totals.",
    },
  ],
} satisfies ContentFamily;
