import type { ContentFamily } from "./registry/types";
import {
  angleArgumentTemplates,
  generateAngleArgument,
} from "../math/angle-arguments-practice";
import {
  angleArgumentFacetMappings,
  angleArgumentLessons,
  angleArgumentMethods,
  angleArgumentPrinciples,
} from "../content/angle-arguments-lessons";

/** Informal arguments about angles (8.G.A.5): the reasons behind a
 * triangle's angle sum, the exterior angle, parallel lines cut by a
 * transversal and the angle-angle criterion for similar triangles. */
export const family = {
  id: "angle-arguments",
  practice: {
    templates: angleArgumentTemplates,
    generate: generateAngleArgument,
    preserveAlgebra: true,
  },
  lessons: angleArgumentLessons,
  methods: angleArgumentMethods,
  principles: angleArgumentPrinciples,
  facetMappings: angleArgumentFacetMappings,
} satisfies ContentFamily;
