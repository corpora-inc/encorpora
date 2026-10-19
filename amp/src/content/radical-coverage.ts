import type { FacetMapping } from "./coverage";
export const radicalFacetMappings: readonly FacetMapping[] = [
  [
    "simplify-square-root",
    "numeric-square-root-simplification",
    "Simplify square roots of nonnegative integers at most 400 with square-free parts at most 100, including zero, perfect squares and square-factor extraction.",
  ],
  [
    "combine-square-roots",
    "numeric-radical-sums",
    "Simplify sums and differences of two signed square-root terms with integer coefficients of magnitude at most 6 and radicands 1 through 200, including unlike roots and cancellation.",
  ],
  [
    "multiply-square-roots",
    "numeric-radical-products",
    "Multiply two signed square-root terms with integer coefficients of magnitude at most 6 and radicands 1 through 100.",
  ],
  [
    "rationalize-radical-denominator",
    "single-radical-denominator",
    "Rationalize a nonzero integer numerator of magnitude at most 12 over b times a nonsquare square root, with b from 1 through 6 and radicand 2 through 100.",
  ],
].map(([templateId, suffix, scope]) => ({
  templateId: templateId!,
  facetId: `rational-exponents.${suffix}`,
  extent: "partial",
  rationale: `${scope} Four canonical exact choices assess recognition of equivalent expressions; estimation and elimination can also distinguish choices. Written production, variable domains, higher roots, rational powers and binomial denominators require separate assessment.`,
}));
