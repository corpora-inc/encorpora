import type { ContentFamily } from "./registry/types";
import {
  clauseTemplates,
  generateClauseProblem,
} from "../math/clause-practice";
import {
  clauseLessons,
  clauseMethods,
  clausePrinciples,
  clauseFacetMappings,
} from "../content/clause-practice-lessons";
export const family = {
  id: "clause-practice",
  practice: {
    templates: clauseTemplates,
    generate: generateClauseProblem,
    preserveAlgebra: true,
  },
  lessons: clauseLessons,
  methods: clauseMethods,
  principles: clausePrinciples,
  facetMappings: clauseFacetMappings,
} satisfies ContentFamily;
