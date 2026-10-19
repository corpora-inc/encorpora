import type { FacetMapping } from "./coverage";
export const volumeCoordinateFacetMappings: readonly FacetMapping[] = [
  ["unit-cube-volume", "volume-cubes.cube-prism-volume"],
  ["cube-layer-count", "volume-cubes.cube-prism-volume"],
  ["prism-volume-edges", "prism-volume.edge-product"],
  ["prism-missing-edge", "prism-volume.missing-edge"],
  ["composite-prism-volume", "prism-volume.additive-volume"],
  ["first-quadrant-locate", "coordinate-first-quadrant.ordered-pairs"],
  ["first-quadrant-coordinates", "coordinate-first-quadrant.ordered-pairs"],
  ["coordinate-move", "coordinate-first-quadrant.grid-moves"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items use bounded whole-number givens shown in an exact figure. Unit conversions, fractional edges, graph interpretation in context and constructed responses require separate assessment.",
}));
