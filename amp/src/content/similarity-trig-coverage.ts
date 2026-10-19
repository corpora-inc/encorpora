import type { FacetMapping } from "./coverage";
export const similarityTrigFacetMappings: readonly FacetMapping[] = [
  ["dilation-image", "dilation-properties.lengths-centers-invariants"],
  ["similar-triangle-side", "similarity-proofs.missing-side"],
  ["special-right-triangle", "special-right-triangles.side-ratios"],
  ["trig-ratio", "right-triangle-trigonometry.exact-ratios"],
  ["complementary-trig", "complementary-trigonometry.cofunctions"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items give exact lengths, coordinates, ratios or angle expressions, with exact triangle and coordinate figures, and ask for one exact number. Written similarity proofs, calculator values of trigonometric functions, angles from inverse functions and non-right triangles require separate assessment.",
}));
