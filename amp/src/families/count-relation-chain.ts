import type { ContentFamily } from "./registry/types";
import {
  countRelationGenerate,
  countRelationTemplates,
} from "../math/count-relation-practice";
import {
  countRelationFacetMappings,
  countRelationLessons,
  countRelationMethods,
  countRelationPrinciples,
} from "../content/count-relation-lessons";

export const family = {
  id: "count-relation-chain",
  practice: {
    templates: countRelationTemplates,
    generate: countRelationGenerate,
    preserveAlgebra: true,
  },
  lessons: countRelationLessons,
  methods: countRelationMethods,
  principles: countRelationPrinciples,
  facetMappings: countRelationFacetMappings,
  archetypeLinks: {
    "count-relation-chain": ["line.constraint", "linear.context"],
  },
} satisfies ContentFamily;
