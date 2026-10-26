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
];
