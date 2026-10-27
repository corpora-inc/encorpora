import type { ContentFamily } from "./registry/types";
import {
  tableFitsGenerate,
  tableFitsTemplates,
} from "../math/table-fits-practice";
import {
  tableFitsFacetMappings,
  tableFitsLessons,
  tableFitsMethods,
  tableFitsPrinciples,
} from "../content/table-fits-lessons";

export const family = {
  id: "table-fits",
  practice: {
    templates: tableFitsTemplates,
    generate: tableFitsGenerate,
    preserveAlgebra: true,
  },
  lessons: tableFitsLessons,
  methods: tableFitsMethods,
  principles: tableFitsPrinciples,
  facetMappings: tableFitsFacetMappings,
  // data.frequency-table-read is not used for the match-a-table task: it
  // joins data.graph-error (see the archetype rule in docs/assessment-coverage.md).
  archetypeLinks: { "table-fits-description": ["data.graph-error"] },
} satisfies ContentFamily;
