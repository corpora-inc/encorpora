import type { ContentFamily } from "./registry/types";
import {
  shareRemainderGenerate,
  shareRemainderTemplates,
} from "../math/share-remainder-practice";
import {
  shareRemainderFacetMappings,
  shareRemainderLessons,
  shareRemainderMethods,
  shareRemainderPrinciples,
} from "../content/share-remainder-lessons";

export const family = {
  id: "share-remainder",
  practice: {
    templates: shareRemainderTemplates,
    generate: shareRemainderGenerate,
    preserveAlgebra: true,
  },
  lessons: shareRemainderLessons,
  methods: shareRemainderMethods,
  principles: shareRemainderPrinciples,
  facetMappings: shareRemainderFacetMappings,
  archetypeLinks: {
    "share-remainder-fractions": [
      "fractions.multiply-whole",
      "ratio.proportion",
    ],
    "share-remainder-percent": ["percent.of"],
  },
  connections: [
    {
      from: "fraction-multiplication",
      to: "percentages",
      kind: "related",
      explanation:
        "A fraction of a whole and a percent of a whole both pick a part of the same total. A percent is a fraction with denominator 100, and the rest of the whole is found by subtraction either way.",
      templateIds: ["share-remainder-fractions", "share-remainder-percent"],
    },
  ],
} satisfies ContentFamily;
