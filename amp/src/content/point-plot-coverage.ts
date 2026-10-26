import type { FacetMapping } from "./coverage";

/** Graphing responses: the learner places points on a coordinate grid. */
export const pointPlotFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "plot-points",
    facetId: "coordinate-four-quadrants.core",
    extent: "partial",
    rationale:
      "Plot three or four signed ordered pairs from −6 to 6 across quadrants and on an axis, two points described by their distances from the axes, and the reflections of a point across both axes, by placing points on a grid. Does not assess distances between points, polygons or rational coordinates.",
  },
  {
    templateId: "graph-linear-equation",
    facetId: "slope.core",
    extent: "partial",
    rationale:
      "Graph a line by placing two of its lattice points, from slope-intercept, standard or point-slope form with integer or fractional slope, a horizontal line, or a proportional relationship through the origin given one pair; any two distinct points on the line are accepted. Does not assess vertical lines, drawing lines through non-lattice points or inequalities.",
  },
  {
    templateId: "place-transformed-image",
    facetId: "rigid-motions.coordinate-images",
    extent: "partial",
    rationale:
      "Place the ordered images of a segment's endpoints or a scalene triangle's vertices under a translation, a reflection over the x- or y-axis, or a rotation of 90° either way or 180° about the origin, on a grid from −6 to 6. Does not assess sequences of motions, other centers or mirror lines, or describing a motion.",
  },
  {
    templateId: "graph-quadratic-points",
    facetId: "quadratic-graphs.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Graph a parabola from vertex form or standard form with integer or one-half leading coefficient by placing three lattice points on a grid from −6 to 6, sometimes including the vertex or the y-intercept; any three distinct points on the curve are accepted. Does not assess factored form, zeros that are not whole numbers, drawing the smooth curve, or labeling features.",
  },
  {
    templateId: "graph-absolute-value-points",
    facetId: "piecewise-functions.HSF.IF.C.7",
    extent: "partial",
    rationale:
      "Graph y = a|x − h| + k with integer or one-half a by placing three lattice points, sometimes including the vertex. Does not assess piecewise definitions, transformations described in words, or drawing the V.",
  },
  {
    templateId: "graph-exponential-points",
    facetId: "exponential-models.core",
    extent: "partial",
    rationale:
      "Graph y = a·b^x for a whole-number a and b of 2, 3, one half or one third by placing three lattice points with whole-number outputs on a window from x = −4 to 4. Does not assess the asymptote, growth from a context, fractional outputs, or drawing the curve.",
  },
  {
    templateId: "graph-sqrt-points",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Graph y = a√(x − h) + k with a of ±1 or ±2 by placing three lattice points whose radicands are perfect squares, sometimes including the starting point. Does not assess other transformation orders, domain and range statements, or drawing the curve.",
  },
];
