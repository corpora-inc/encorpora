import type { ContentFamily } from "./registry/types";
import {
  dataListGenerate,
  dataListTemplates,
} from "../math/data-list-practice";
import {
  dataListFacetMappings,
  dataListLessons,
  dataListMethods,
  dataListPrinciples,
} from "../content/data-list-lessons";

export const family = {
  id: "data-list",
  practice: {
    templates: dataListTemplates,
    generate: dataListGenerate,
    preserveAlgebra: true,
  },
  lessons: dataListLessons,
  methods: dataListMethods,
  principles: dataListPrinciples,
  facetMappings: dataListFacetMappings,
  archetypeLinks: { "data-list-for-display": ["univariate.displays"] },
  connections: [
    {
      from: "scaled-graphs",
      to: "line-plots",
      kind: "related",
      explanation:
        "A table of counts and a dot plot are two ways to show how often each value occurs; each count in a table is a stack of dots, and each dot is one value in the original list.",
      templateIds: ["data-list-for-display"],
    },
  ],
} satisfies ContentFamily;
