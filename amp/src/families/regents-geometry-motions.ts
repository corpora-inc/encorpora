import type { ContentFamily } from "./registry/types";
import {
  regentsGeometryMotionGenerate,
  regentsGeometryMotionTemplates,
} from "../math/regents-geometry-motions-practice";
import {
  regentsGeometryMotionFacetMappings,
  regentsGeometryMotionLessons,
  regentsGeometryMotionMethods,
  regentsGeometryMotionPrinciples,
} from "../content/regents-geometry-motions-lessons";

export const family = {
  id: "regents-geometry-motions",
  practice: {
    templates: regentsGeometryMotionTemplates,
    generate: regentsGeometryMotionGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsGeometryMotionLessons,
  methods: regentsGeometryMotionMethods,
  principles: regentsGeometryMotionPrinciples,
  facetMappings: regentsGeometryMotionFacetMappings,
  archetypeLinks: {
    "geo-dilation-center": ["transformation.dilation"],
    "geo-dilation-line-center": ["transformation.dilation"],
    "geo-motion-chain": ["transformation.identify"],
    "geo-reflection-side": ["triangle.congruence-transformations"],
    "geo-rigid-statement": [
      "triangle.congruence-transformations",
      "transformation.invariants",
    ],
  },
} satisfies ContentFamily;
