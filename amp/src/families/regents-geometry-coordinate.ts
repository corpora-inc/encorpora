import type { ContentFamily } from "./registry/types";
import {
  regentsGeometryCoordinateGenerate,
  regentsGeometryCoordinateTemplates,
} from "../math/regents-geometry-coordinate-practice";
import {
  regentsGeometryCoordinateFacetMappings,
  regentsGeometryCoordinateLessons,
  regentsGeometryCoordinateMethods,
  regentsGeometryCoordinatePrinciples,
} from "../content/regents-geometry-coordinate-lessons";

export const family = {
  id: "regents-geometry-coordinate",
  practice: {
    templates: regentsGeometryCoordinateTemplates,
    generate: regentsGeometryCoordinateGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsGeometryCoordinateLessons,
  methods: regentsGeometryCoordinateMethods,
  principles: regentsGeometryCoordinatePrinciples,
  facetMappings: regentsGeometryCoordinateFacetMappings,
  archetypeLinks: {
    "geo-segment-partition-point": ["coordinate.segment-partition"],
    "geo-circle-general-form": ["circle.coordinate"],
    "geo-line-point-slope-choice": [
      "line.parallel-perpendicular",
      "line.slope-equation",
    ],
    "geo-line-pair-relationship": ["line.parallel-perpendicular"],
    "geo-dilation-line-image": ["transformation.dilation"],
  },
} satisfies ContentFamily;
