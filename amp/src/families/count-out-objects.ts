import type { ContentFamily } from "./registry/types";
import {
  generateCountOutObjects,
  countOutObjectsTemplates,
} from "../math/count-out-objects-practice";
import {
  countOutObjectsFacetMappings,
  countOutObjectsLessons,
  countOutObjectsMethods,
  countOutObjectsPrinciples,
} from "../content/count-out-objects-lessons";

/** Choose the ten-frame that shows a given count from 1 to 20 (K.CC.B.5). */
export const family = {
  id: "count-out-objects",
  practice: {
    templates: countOutObjectsTemplates,
    generate: generateCountOutObjects,
    preserveAlgebra: true,
  },
  lessons: countOutObjectsLessons,
  methods: countOutObjectsMethods,
  principles: countOutObjectsPrinciples,
  facetMappings: countOutObjectsFacetMappings,
  archetypeLinks: {
    "count-out-objects": ["early.count-to-20"],
  },
} satisfies ContentFamily;
