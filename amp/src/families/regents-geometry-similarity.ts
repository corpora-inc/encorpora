import type { ContentFamily } from "./registry/types";
import {
  regentsGeometrySimilarityGenerate,
  regentsGeometrySimilarityTemplates,
} from "../math/regents-geometry-similarity-practice";
import {
  regentsGeometrySimilarityFacetMappings,
  regentsGeometrySimilarityLessons,
  regentsGeometrySimilarityMethods,
  regentsGeometrySimilarityPrinciples,
} from "../content/regents-geometry-similarity-lessons";

export const family = {
  id: "regents-geometry-similarity",
  practice: {
    templates: regentsGeometrySimilarityTemplates,
    generate: regentsGeometrySimilarityGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsGeometrySimilarityLessons,
  methods: regentsGeometrySimilarityMethods,
  principles: regentsGeometrySimilarityPrinciples,
  facetMappings: regentsGeometrySimilarityFacetMappings,
  archetypeLinks: {
    "geo-altitude-ratio": [
      "triangle.trig-ratio",
      "triangle.altitude-hypotenuse",
    ],
    "geo-parallel-perimeter": ["triangle.relationships", "measure.scale"],
    "geo-parallel-statement": ["triangle.relationships"],
    "geo-equal-legs-radical": ["triangle.relationships", "triangle.special"],
    "geo-elevation-depression": ["triangle.trig-ratio"],
    "geo-density-rank": ["ratio.proportion"],
  },
} satisfies ContentFamily;
