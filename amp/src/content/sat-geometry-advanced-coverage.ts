import type { FacetMapping } from "./coverage";
export const satGeometryAdvancedFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "corresponding-angle-transfer",
    facetId: "similarity-proofs.core",
    extent: "partial",
    rationale:
      "Read the vertex correspondence from the order of letters in a similarity or congruence statement and choose the measure of a corresponding angle, including after a side scale factor and after a third angle or the complement in a right triangle. Proving similarity or congruence, side lengths and constructions are not assessed.",
  },
  {
    templateId: "crossing-segment-similarity",
    facetId: "similarity-proofs.core",
    extent: "partial",
    rationale:
      "Find a missing length from similar triangles formed by two crossing segments, using vertical angles and either a parallel pair or one stated pair of equal angles. Written proofs, other crossing configurations and nonintegral lengths are not assessed.",
  },
  {
    templateId: "angle-chase-chain",
    facetId: "triangle-angle-theorems.core",
    extent: "partial",
    rationale:
      "Chain a vertical-angle equation with same-side interior angles, or a triangle angle sum with corresponding angles of a segment parallel to a side and a straight angle. Written justification, exterior-angle proofs and figures with more than two parallel lines are not assessed.",
  },
  {
    templateId: "angle-claim-reasoning",
    facetId: "angle-relationships.core",
    extent: "partial",
    rationale:
      "Choose which angle measure is possible or impossible from the triangle angle sum, compare vertical or adjacent angles, and decide which expression cannot be a sum of two angles formed by crossing lines. Constructed arguments and angles formed by more than two lines are not assessed.",
  },
  {
    templateId: "circle-radii-triangle",
    facetId: "circle-theorems.core",
    extent: "partial",
    rationale:
      "Use equal radii to find a base angle or central angle of the isosceles triangle with a chord, and the chord or radius from the triangle's perimeter. Inscribed angles, tangents, arc length and sector area are practiced by other families.",
  },
  {
    templateId: "shifted-polynomial-features",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Find the extreme point of a horizontally shifted quadratic given in standard form, the sum of the x-intercepts of a horizontally shifted factored cubic, and a value of a vertically shifted factored cubic. Graph selection, reflections, stretches and exponential or rational parents are not assessed.",
  },
  {
    templateId: "radical-side-entry",
    facetId: "pythagorean-theorem.core",
    extent: "partial",
    rationale:
      "Enter the radicand or coefficient of a simplified radical hypotenuse from two integer legs, and find a missing leg when all sides are decimal lengths. Choosing among radical expressions, nonright triangles and written proofs are not assessed.",
  },
  {
    templateId: "special-triangle-in-figure",
    facetId: "special-right-triangles.core",
    extent: "partial",
    rationale:
      "Identify an acute angle from equal legs, a 1:sqrt3 leg ratio or a leg half the hypotenuse, and use 45-45-90 and 30-60-90 triangles for an equilateral triangle's altitude and circumradius and for a square inscribed in a circle. Trigonometric ratios and rectangles in circles are not assessed.",
  },
];
