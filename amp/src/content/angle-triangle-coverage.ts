import type { FacetMapping } from "./coverage";
export const angleTriangleFacetMappings: readonly FacetMapping[] = [
  [
    "angle-pair-measure",
    "angle-relationships.known-angle-pairs",
    "Find an unknown angle from one or two known angles in a linear pair, a right angle split by a ray, vertical or adjacent angles at crossing lines, or three angles around a point, drawn at true measure. Does not assess angles named only in words without a figure, or reflex angles.",
  ],
  [
    "angle-equation",
    "angle-relationships.angle-equations",
    "Write and solve a linear equation for x from supplementary, complementary, adjacent or vertical angles given as expressions with coefficients 1 to 5, then optionally evaluate an angle. Does not assess equations with x on both sides beyond vertical angles, or multi-step figure chains.",
  ],
  [
    "triangle-angle-sum",
    "triangle-angle-theorems.triangle-sum",
    "Find a triangle's third angle, including right triangles, or solve for x when all three angles are linear expressions. Does not assess proving the theorem or isosceles-triangle reasoning.",
  ],
  [
    "triangle-exterior-angle",
    "triangle-angle-theorems.exterior-angle",
    "Find an exterior angle from its remote interior angles, a remote angle from the exterior angle, or x when all three are expressions. Does not assess exterior angle sums of polygons.",
  ],
  [
    "parallel-lines-angle",
    "triangle-angle-theorems.parallel-transversal",
    "Find an angle where a transversal crosses two parallel lines using corresponding, alternate interior, alternate exterior, same-side interior, vertical and linear-pair relationships, in one or two steps or as an equation in x. Does not assess proving lines parallel or triangles inside parallel-line figures.",
  ],
  [
    "triangle-side-test",
    "triangle-construction.side-lengths",
    "Choose the one set of three lengths that forms a triangle among sets sharing a longest side, with flat (equal-sum) and too-short distractors. Does not assess constructing the triangle with tools.",
  ],
  [
    "triangle-third-side",
    "triangle-construction.third-side-range",
    "Find the greatest or least whole-number third side, or how many whole-number lengths are possible, from two given sides of 3 to 31 units. Does not assess non-integer bounds.",
  ],
  [
    "triangle-conditions",
    "triangle-construction.determining-conditions",
    "Decide whether three angles, three sides, two sides with the included angle, two angles with the included side, two angles and a side, or two angles alone determine exactly one triangle, more than one, or none. Does not assess the ambiguous two-sides-and-a-non-included-angle case or drawing with tools.",
  ],
  [
    "cross-section-shape",
    "solid-cross-sections.prism-pyramid-sections",
    "Name the cross-section (rectangle, square, triangle or trapezoid) of a right rectangular prism or pyramid cut parallel to the base, perpendicular to the base parallel to an edge or through diagonal edges, through the apex, or through three vertices at a corner. Does not assess cylinders, cones, spheres or oblique slices with five or six sides.",
  ],
  [
    "cross-section-area",
    "solid-cross-sections.section-areas",
    "Find the area of a prism section parallel to a face, a pyramid section through the apex, or a pyramid section parallel to the base halfway up. Does not assess sections at other heights or slanted sections.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
