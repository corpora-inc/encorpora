import type { FacetMapping } from "./coverage";
export const satGeometryDataFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "trig-context-triangle",
    facetId: "right-triangle-trigonometry.core",
    extent: "partial",
    rationale:
      "Choose the sine, cosine or tangent relation, or its inverse, for angle-of-elevation, angle-of-depression, ladder, ramp and shadow descriptions, including the depression angle's alternate interior angle, with a stated rounding. Drawing the triangle, trigonometric identities and the laws of sines and cosines are not assessed.",
  },
  {
    templateId: "midpoint-endpoint",
    facetId: "coordinate-distance.core",
    extent: "partial",
    rationale:
      "Find a midpoint with integer endpoints, a missing endpoint from a midpoint, the center of a circle from a diameter, and the circle's equation from the diameter's endpoints. Proofs, non-integer coordinates and division of a segment in other ratios are not assessed here.",
  },
  {
    templateId: "space-diagonal",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Apply the Pythagorean theorem twice for the diagonal of a rectangular box or cube, or a missing edge, with integer edges or a simplified radical. Other solids, angles between a diagonal and a face, and written justification are not assessed.",
  },
  {
    templateId: "circle-segment-lengths",
    facetId: "circle-theorems.core",
    extent: "partial",
    rationale:
      "Use products of intersecting chord segments, two secants, or a tangent and a secant, and the negative reciprocal of the radius slope for a tangent slope. Proofs of the segment theorems, arc measures, and angles formed by secants and tangents are not assessed.",
  },
  {
    templateId: "frequency-table-center",
    facetId: "mean-median.core",
    extent: "partial",
    rationale:
      "Find a mean or median from a frequency table, a weighted or combined mean, the mean after one value is added or removed, and the direction each of the mean and median moves when a value is added. Spread, shape and grouped-interval estimates are not assessed.",
  },
  {
    templateId: "independence-test",
    facetId: "independent-events.core",
    extent: "partial",
    rationale:
      "Decide independence from the counts in a two-way table by comparing conditional and overall proportions, find an expected joint count or probability under independence, and interpret conditional-probability wording. Chi-square tests, causation and tables with more than two variables are not assessed.",
  },
];
