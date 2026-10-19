import type { FacetMapping } from "./coverage";
export const transformationFacetMappings: readonly FacetMapping[] = [
  [
    "coordinate-side-length",
    "coordinate-polygons.aligned-side-lengths",
    "Find a horizontal or vertical side of a graphed rectangle, right triangle, right trapezoid or L-shaped hexagon with vertices from −8 to 11, including sides that cross or touch an axis. Does not assess drawing the polygon or slanted sides.",
  ],
  [
    "coordinate-rectangle-measure",
    "coordinate-polygons.rectangle-perimeter-area",
    "Find the perimeter or area of a graphed rectangle with horizontal and vertical sides 2 to 12 units long in any quadrants. Does not assess composite or slanted polygons.",
  ],
  [
    "coordinate-distance",
    "coordinate-distance.pythagorean-distance",
    "Find whole-number distances from 5 to 20 between two points with coordinates from −10 to 10, using Pythagorean triples. Does not assess horizontal or vertical segments or graphs.",
  ],
  [
    "coordinate-distance-exact",
    "coordinate-distance.pythagorean-distance",
    "Choose the exact distance between two graphed points with legs from 1 to 9 as a whole number or simplest radical, against sign, addition, unsimplified and unrooted errors. Does not assess decimal approximations.",
  ],
  [
    "transformation-image",
    "rigid-motions.coordinate-images",
    "Choose a vertex image of a graphed scalene triangle under a translation, a reflection over the x- or y-axis or a rotation of 90° either way or 180° about the origin. Does not assess reflections over other lines or rotations about other centers.",
  ],
  [
    "identify-rigid-motion",
    "rigid-motions.identify-motion",
    "Identify the single translation, axis reflection or origin rotation that maps a graphed scalene triangle onto its labeled image. Does not assess sequences of motions or congruence arguments.",
  ],
  [
    "dilation-image",
    "dilations-similarity.origin-dilations",
    "Choose a vertex image under a dilation centered at the origin with scale factor 2, 3, 1/2, 1/3, 3/2 or 2/3. Does not assess centers other than the origin.",
  ],
  [
    "dilation-scale-factor",
    "dilations-similarity.origin-dilations",
    "Find the scale factor of a dilation centered at the origin from a graphed triangle and its image. Does not assess negative scale factors.",
  ],
  [
    "similar-triangles-side",
    "dilations-similarity.similar-triangle-sides",
    "Find a missing side of a triangle similar to one with three known sides, with ratios from 1/2 to 3 and a stated vertex correspondence. Does not assess proving similarity or angle-angle reasoning.",
  ],
  [
    "scale-drawing",
    "scale-drawings.lengths-and-areas",
    "Convert lengths both ways on maps and plans with scales such as 1 cm : 5 km and 2 cm : 5 m, and find actual areas of rectangles and regions by the square of the scale. Does not assess reproducing a drawing at a new scale.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
