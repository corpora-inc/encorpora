import type { ContentFamily } from "./registry/types";
import {
  areaByCountingTemplates,
  generateAreaByCounting,
} from "../math/area-by-counting-practice";
import {
  areaByCountingFacetMappings,
  areaByCountingLessons,
  areaByCountingMethods,
  areaByCountingPrinciples,
} from "../content/area-by-counting-lessons";

/** Area by counting unit squares (3.MD.C.6): shaded figures in square
 * centimeters, inches, feet and meters, and surfaces measured with
 * improvised square units. */
export const family = {
  id: "area-by-counting",
  practice: {
    templates: areaByCountingTemplates,
    generate: generateAreaByCounting,
    preserveAlgebra: true,
  },
  lessons: areaByCountingLessons,
  methods: areaByCountingMethods,
  principles: areaByCountingPrinciples,
  facetMappings: areaByCountingFacetMappings,
  archetypeLinks: {
    "count-unit-squares": ["measure.area"],
    "unit-square-area-statement": ["measure.area", "measure.area-vs-perimeter"],
    "improvised-unit-count": ["measure.area"],
    "improvised-unit-covering": ["measure.area"],
    "improvised-unit-change": ["measure.area"],
  },
} satisfies ContentFamily;
