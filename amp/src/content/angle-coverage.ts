import type { FacetMapping } from "./coverage";
export const angleFacetMappings: readonly FacetMapping[] = [
  ["protractor-reading", "angle-measure.protractor"],
  ["adjacent-angles", "angle-measure.additive"],
  ["turn-degrees", "angle-measure.turns"],
  ["angle-classify", "lines-symmetry.lines-angles"],
  ["line-ray-segment", "lines-symmetry.lines-angles"],
  ["line-relationship", "lines-symmetry.lines-angles"],
  ["classify-triangle-angles", "lines-symmetry.lines-angles"],
  ["symmetry-line-count", "lines-symmetry.symmetry"],
  ["symmetry-line-check", "lines-symmetry.symmetry"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items read exact drawn figures and ask for a number or a choice. Drawing angles of a given measure, sketching lines and symmetry lines, and explaining reasoning require separate assessment.",
}));
