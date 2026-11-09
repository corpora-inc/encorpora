import type { ContentFamily } from "./registry/types";
import {
  generateRulerLinePlot,
  rulerLinePlotTemplates,
} from "../math/ruler-line-plot-practice";
import {
  rulerLinePlotFacetMappings,
  rulerLinePlotLessons,
  rulerLinePlotMethods,
  rulerLinePlotPrinciples,
} from "../content/ruler-line-plot-lessons";

/** Grade-2 measuring and line plots: how much longer one object is than
 * another (2.MD.A.4), a length to the nearest whole unit, and the line plot
 * for a list of measurements (2.MD.D.9). */
export const family = {
  id: "ruler-line-plot",
  practice: {
    templates: rulerLinePlotTemplates,
    generate: generateRulerLinePlot,
    preserveAlgebra: true,
  },
  lessons: rulerLinePlotLessons,
  methods: rulerLinePlotMethods,
  principles: rulerLinePlotPrinciples,
  facetMappings: rulerLinePlotFacetMappings,
  archetypeLinks: {
    "ruler-length-difference": ["measure.ruler"],
    "compare-measured-lengths": ["measure.ruler", "measure.compare-attributes"],
    "ruler-read-nearest-unit": ["measure.ruler"],
  },
} satisfies ContentFamily;
