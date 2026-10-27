import {
  regentsShownWorkContent,
  regentsShownWorkFacetMappings,
} from "../content/regents-shown-work-lessons";
import {
  regentsShownWorkGenerate,
  regentsShownWorkTemplates,
} from "../math/regents-shown-work-practice";
import type { ContentFamily } from "./registry/types";

/** Regents constructed responses whose rating guides credit the shown work in
 * geometry, Algebra I and Algebra II, answered as labeled exact steps
 * (structured-work-v1). */
export const family = {
  id: "regents-shown-work",
  practice: {
    templates: regentsShownWorkTemplates,
    generate: regentsShownWorkGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsShownWorkContent.lessons,
  methods: regentsShownWorkContent.methods,
  principles: regentsShownWorkContent.principles,
  facetMappings: regentsShownWorkFacetMappings,
  archetypeLinks: {
    "density-volume-steps": ["measure.volume"],
    "sas-area-steps": ["trig.triangle-area"],
    "trig-leg-steps": ["triangle.trig-ratio"],
    "elevation-depression-steps": ["triangle.trig-ratio"],
    "isosceles-perimeter-steps": ["triangle.trig-ratio"],
    "ring-area-steps": ["measure.circle", "measure.area"],
    "parallelogram-angle-steps": ["angle.relationships", "proof.parallelogram"],
    "parallel-segment-steps": ["triangle.side-splitter"],
    "two-radical-steps": ["nonlinear.rational-radical"],
    "grouped-both-sides-steps": ["linear.solve"],
    "exponential-time-steps": ["exponential.context", "logarithm.solve"],
  },
} satisfies ContentFamily;
