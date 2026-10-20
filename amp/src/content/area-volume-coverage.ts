import type { FacetMapping } from "./coverage";
export const areaVolumeFacetMappings: readonly FacetMapping[] = [
  [
    "triangle-area-base-height",
    "triangle-area.base-height-triangles",
    "Find the area of acute, right and obtuse triangles drawn to scale with whole-number bases of 3 to 24 and heights of 3 to 15, choosing the perpendicular height over labeled slanted sides; heights may fall outside the triangle. Does not assess fractional dimensions, finding a missing base or height, or coordinates.",
  ],
  [
    "polygon-area-decompose",
    "triangle-area.polygon-decomposition",
    "Find the area of parallelograms, general and right trapezoids, and rectangle-plus-triangle pentagons with whole-number dimensions up to 16, using a perpendicular height or a total height. Does not assess kites, irregular polygons with more than five sides, or coordinate polygons.",
  ],
  [
    "net-surface-area",
    "surface-area.prism-pyramid-nets",
    "Add the face areas in exact nets of rectangular prisms (edges 2 to 12), triangular prisms with right, isosceles or scalene ends from whole-number side lengths, and square pyramids with a given slant height. Does not assess drawing nets, real-world wrapping contexts or finding a missing dimension.",
  ],
  [
    "unit-fraction-cube-packing",
    "fractional-prism-volume.unit-fraction-packing",
    "Count cubes with edges 1/2, 1/3 or 1/4 that pack a drawn rectangular prism (2 to 8 per edge) and find the prism's exact volume. Does not assess non-unit-fraction cubes or prisms that cubes do not fill exactly.",
  ],
  [
    "fraction-edge-volume",
    "fractional-prism-volume.fraction-edge-formula",
    "Find the exact volume of a rectangular prism with edges in halves, thirds or quarters up to 6, or a missing edge from the volume and the other two edges. Does not assess V = Bh with a given base area or multi-step real-world contexts.",
  ],
  [
    "composite-area",
    "composite-measurement.composite-polygon-area",
    "Find the area of right-angled L-, T- and U-shaped figures with one or two unlabeled sides, and of rectangles with a right-triangular corner removed, with whole-number lengths up to 15. Does not assess figures with curved parts or scale drawings.",
  ],
  [
    "composite-face-prism-volume",
    "composite-measurement.composite-prism-volume",
    "Find the volume of right prisms whose front faces are right-angled L or T shapes with two or three edges to derive, depths 2 to 10. Does not assess prisms with triangular or trapezoidal composite faces or stacked prisms of different depths.",
  ],
  [
    "composite-face-prism-surface-area",
    "composite-measurement.composite-prism-surface-area",
    "Find the surface area of right prisms whose front faces are right-angled L or T shapes, depths 2 to 10, including derived inner edges in the perimeter. Does not assess open boxes, hidden glued faces between stacked solids or real-world painting contexts.",
  ],
  [
    "cylinder-volume",
    "curved-solid-volume.cylinder-volume",
    "Find a cylinder's volume from a radius of 1 to 10 or a diameter, exactly as aπ or with 3.14 for π, and find its height from an exact volume. Does not assess finding a radius from the volume or real-world capacity conversions.",
  ],
  [
    "cone-sphere-volume",
    "curved-solid-volume.cone-sphere-volume",
    "Find the volume of a cone (height between one and four radii), sphere or hemisphere from a radius up to 9 or a diameter, exactly as aπ or with 3.14 for π. Does not assess missing dimensions, composite solids or comparing solids.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
