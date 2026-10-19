import type { FacetMapping } from "./coverage";
export const coordinateCircleFacetMappings: readonly FacetMapping[] = [
  ["circle-equation", "circle-equations.center-radius"],
  ["coordinate-polygon", "coordinate-measurement.perimeter-area"],
  ["segment-partition", "segment-division.internal-ratio"],
  ["perpendicular-slopes", "slope-proofs.parallel-perpendicular"],
  ["circle-angles", "circle-theorems.inscribed-tangent"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items give exact integer coordinates, equations or angle measures, often with an exact coordinate or circle figure, and ask for one exact number. Writing coordinate proofs, external division, chord and secant products, and deriving the equations require separate assessment.",
}));
