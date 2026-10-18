import type { FacetMapping } from "./coverage";
export const integerExponentFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "negative-integer-power",
    facetId: "exponent-laws.negative-rational-powers",
    extent: "partial",
    rationale:
      "Evaluate negative integer powers of bounded nonzero rational bases. Bounded exact arithmetic; does not assess mixed operations, multiple variables, missing bases, fractional exponents, or contextual modeling.",
  },
  {
    templateId: "product-of-powers-exponent",
    facetId: "exponent-laws.same-base-product",
    extent: "partial",
    rationale:
      "Find the combined integer exponent of two powers with the same nonzero base. Bounded exact arithmetic; does not assess mixed operations, multiple variables, missing bases, fractional exponents, or contextual modeling.",
  },
  {
    templateId: "quotient-of-powers-exponent",
    facetId: "exponent-laws.same-base-quotient",
    extent: "partial",
    rationale:
      "Find the combined integer exponent of a quotient with the same nonzero base. Bounded exact arithmetic; does not assess mixed operations, multiple variables, missing bases, fractional exponents, or contextual modeling.",
  },
  {
    templateId: "power-of-power-exponent",
    facetId: "exponent-laws.nested-integer-powers",
    extent: "partial",
    rationale:
      "Find the combined integer exponent of a power raised to an integer power. Bounded exact arithmetic; does not assess mixed operations, multiple variables, missing bases, fractional exponents, or contextual modeling.",
  },
];
