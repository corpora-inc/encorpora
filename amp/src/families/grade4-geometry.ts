import type { ContentFamily } from "./registry/types";
import {
  generateGrade4Geometry,
  grade4GeometryTemplates,
} from "../math/grade4-geometry-practice";
import {
  grade4GeometryFacetMappings,
  grade4GeometryLessons,
  grade4GeometryMethods,
  grade4GeometryPrinciples,
} from "../content/grade4-geometry-lessons";

export const family = {
  id: "grade4-geometry",
  practice: {
    templates: grade4GeometryTemplates,
    generate: generateGrade4Geometry,
    preserveAlgebra: true,
  },
  lessons: grade4GeometryLessons,
  methods: grade4GeometryMethods,
  principles: grade4GeometryPrinciples,
  facetMappings: grade4GeometryFacetMappings,
  archetypeLinks: {
    "protractor-ray-choice": ["angle.measure"],
    "adjacent-angle-equation": ["angle.additive"],
    "angle-benchmark-estimate": ["angle.classify"],
    "triangle-sides-angles-blanks": [
      "triangle.classify-sides",
      "angle.classify",
    ],
    "quadrilateral-attributes": [
      "shape.quadrilateral-hierarchy",
      "shape.attribute-classify",
    ],
    "composite-rectangle-measure": ["measure.area"],
    "rectangle-formula-select": ["measure.area-vs-perimeter"],
  },
} satisfies ContentFamily;
