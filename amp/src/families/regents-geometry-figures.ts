import type { ContentFamily } from "./registry/types";
import {
  regentsGeometryFiguresGenerate,
  regentsGeometryFiguresTemplates,
} from "../math/regents-geometry-figures-practice";
import {
  regentsGeometryFiguresFacetMappings,
  regentsGeometryFiguresLessons,
  regentsGeometryFiguresMethods,
  regentsGeometryFiguresPrinciples,
} from "../content/regents-geometry-figures-lessons";

export const family = {
  id: "regents-geometry-figures",
  practice: {
    templates: regentsGeometryFiguresTemplates,
    generate: regentsGeometryFiguresGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsGeometryFiguresLessons,
  methods: regentsGeometryFiguresMethods,
  principles: regentsGeometryFiguresPrinciples,
  facetMappings: regentsGeometryFiguresFacetMappings,
  archetypeLinks: {
    "geo-altitude-hypotenuse": ["triangle.altitude-hypotenuse"],
    "geo-centroid-median": ["triangle.centroid"],
    "geo-polygon-rotation": ["shape.symmetry"],
    "geo-isosceles-exterior-angle": ["angle.relationships"],
    "geo-complementary-trig-choice": ["triangle.complement"],
    "geo-parallel-segment-length": ["triangle.side-splitter"],
    "geo-area-changing-transformation": ["transformation.invariants"],
    "geo-section-impossible": ["solid.cross-section"],
    "geo-parallelogram-sufficient": [
      "proof.parallelogram",
      "shape.quadrilateral-hierarchy",
    ],
  },
} satisfies ContentFamily;
