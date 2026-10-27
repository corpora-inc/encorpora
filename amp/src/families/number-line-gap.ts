import type { ContentFamily } from "./registry/types";
import {
  numberLineGapGenerate,
  numberLineGapTemplates,
} from "../math/number-line-gap-practice";
import {
  numberLineGapFacetMappings,
  numberLineGapLessons,
  numberLineGapMethods,
  numberLineGapPrinciples,
} from "../content/number-line-gap-lessons";

export const family = {
  id: "number-line-gap",
  practice: {
    templates: numberLineGapTemplates,
    generate: numberLineGapGenerate,
    preserveAlgebra: true,
  },
  lessons: numberLineGapLessons,
  methods: numberLineGapMethods,
  principles: numberLineGapPrinciples,
  facetMappings: numberLineGapFacetMappings,
  archetypeLinks: {
    "number-line-between-hundreds": ["number.number-line-position"],
    // number.number-line-equation is merged into early.number-line-hops.
    "number-line-jump-story": ["early.number-line-hops"],
  },
  connections: [
    {
      from: "number-line-arithmetic",
      to: "round-whole-numbers",
      kind: "related",
      explanation:
        "A number line cut into equal steps shows where a number lies between two hundreds. The halfway mark is what decides which hundred a number rounds to.",
      templateIds: ["number-line-between-hundreds"],
    },
  ],
} satisfies ContentFamily;
