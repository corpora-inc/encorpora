import type { ContentFamily } from "./registry/types";
import {
  congruentPartsGenerate,
  congruentPartsTemplates,
} from "../math/congruent-parts-practice";
import {
  congruentPartsFacetMappings,
  congruentPartsLessons,
  congruentPartsMethods,
  congruentPartsPrinciples,
} from "../content/congruent-parts-lessons";

export const family = {
  id: "congruent-parts",
  practice: {
    templates: congruentPartsTemplates,
    generate: congruentPartsGenerate,
    preserveAlgebra: true,
  },
  lessons: congruentPartsLessons,
  methods: congruentPartsMethods,
  principles: congruentPartsPrinciples,
  facetMappings: congruentPartsFacetMappings,
  archetypeLinks: { "congruent-fourths-pair": ["shape.congruent-equal-parts"] },
} satisfies ContentFamily;
