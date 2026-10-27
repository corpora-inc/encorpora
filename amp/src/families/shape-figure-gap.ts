import type { ContentFamily } from "./registry/types";
import {
  shapeFigureGapGenerate,
  shapeFigureGapTemplates,
} from "../math/shape-figure-gap-practice";
import {
  shapeFigureGapFacetMappings,
  shapeFigureGapLessons,
  shapeFigureGapMethods,
  shapeFigureGapPrinciples,
} from "../content/shape-figure-gap-lessons";

export const family = {
  id: "shape-figure-gap",
  practice: {
    templates: shapeFigureGapTemplates,
    generate: shapeFigureGapGenerate,
    preserveAlgebra: true,
  },
  lessons: shapeFigureGapLessons,
  methods: shapeFigureGapMethods,
  principles: shapeFigureGapPrinciples,
  facetMappings: shapeFigureGapFacetMappings,
  archetypeLinks: {
    "congruent-figure-pair": ["shape.congruent-figures"],
    "classify-triangle-by-sides": ["triangle.classify-sides"],
    "name-cut-shape-pieces": ["shape.subdivide-name"],
  },
  connections: [
    {
      from: "polygon-properties",
      to: "shape-hierarchy",
      kind: "extension",
      explanation:
        "Counting the sides of a polygon to name it grows into sorting triangles by how many of their sides are equal, the first step toward categories that sit inside one another.",
      templateIds: ["classify-triangle-by-sides"],
    },
    {
      from: "polygon-properties",
      to: "congruence-criteria",
      kind: "extension",
      explanation:
        "Telling congruent figures from near copies by their sides and corners is the informal idea that congruence criteria later make exact for triangles.",
      templateIds: ["triangle-congruence-criteria"],
    },
  ],
} satisfies ContentFamily;
