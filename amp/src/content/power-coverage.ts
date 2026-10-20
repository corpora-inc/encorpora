import type { FacetMapping } from "./coverage";
export const powerFacetMappings: readonly FacetMapping[] = [
  "integer-power",
  "power-missing-exponent",
  "power-repeated-product",
  "power-compare",
  "power-order-trap",
  "power-doubling-story",
].map((templateId) => ({
  templateId,
  facetId: "integer-powers.whole-number-powers",
  extent: "partial",
  rationale:
    "Items use whole-number bases and exponents with values small enough to find without a calculator, and ask for one number or one choice. Writing and explaining numerical expressions with exponents in context requires separate assessment.",
}));
