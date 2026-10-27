import type { ContentFamily } from "./registry/types";
import {
  regentsGeometryMeasureGenerate,
  regentsGeometryMeasureTemplates,
} from "../math/regents-geometry-measure-practice";
import {
  regentsGeometryMeasureFacetMappings,
  regentsGeometryMeasureLessons,
  regentsGeometryMeasureMethods,
  regentsGeometryMeasurePrinciples,
} from "../content/regents-geometry-measure-lessons";

export const family = {
  id: "regents-geometry-measure",
  practice: {
    templates: regentsGeometryMeasureTemplates,
    generate: regentsGeometryMeasureGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsGeometryMeasureLessons,
  methods: regentsGeometryMeasureMethods,
  principles: regentsGeometryMeasurePrinciples,
  facetMappings: regentsGeometryMeasureFacetMappings,
  archetypeLinks: {
    "geo-arc-length-rounded": ["circle.arc-sector"],
    "geo-trig-leg-degrees": ["triangle.trig-ratio"],
    "geo-sas-triangle-area": ["trig.triangle-area"],
    "geo-ring-area": ["measure.circle", "measure.area"],
    "geo-sphere-diameter": ["measure.volume"],
    "geo-isosceles-trig": ["triangle.trig-ratio"],
    "geo-volume-context": [
      "measure.volume",
      "ratio.units",
      "number.whole-unit-stories",
    ],
  },
} satisfies ContentFamily;
