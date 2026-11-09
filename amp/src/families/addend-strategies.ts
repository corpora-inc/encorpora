import type { ContentFamily } from "./registry/types";
import {
  addendStrategiesTemplates,
  generateAddendStrategies,
} from "../math/addend-strategies-practice";
import {
  addendStrategiesFacetMappings,
  addendStrategiesLessons,
  addendStrategiesMethods,
  addendStrategiesPrinciples,
} from "../content/addend-strategies-lessons";

/** Turnaround facts and making ten with three addends (1.OA.B.3), and equal
 * addends on arrays (2.OA.C.4). */
export const family = {
  id: "addend-strategies",
  practice: {
    templates: addendStrategiesTemplates,
    generate: generateAddendStrategies,
    preserveAlgebra: true,
  },
  lessons: addendStrategiesLessons,
  methods: addendStrategiesMethods,
  principles: addendStrategiesPrinciples,
  facetMappings: addendStrategiesFacetMappings,
  archetypeLinks: {
    "make-ten-grouping": ["early.three-addends"],
    "make-ten-step": ["early.three-addends"],
    "array-add-rows-total": ["early.array-total"],
  },
} satisfies ContentFamily;
