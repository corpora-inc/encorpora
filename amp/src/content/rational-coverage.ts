import type { FacetMapping } from "./coverage";
export const rationalFacetMappings: readonly FacetMapping[] = [
  [
    "signed-fraction-sum",
    "signed-addition.signed-fraction-sums",
    "Add or subtract two signed lowest-terms fractions with different denominators from 2, 3, 4, 5, 6, 8, 9 and 12 and numerators below twice the denominator.",
  ],
  [
    "signed-fraction-product",
    "signed-multiplication.signed-fraction-products",
    "Multiply or divide two signed lowest-terms fractions with denominators from 2, 3, 4, 5, 6, 8, 9 and 12 and numerators below twice the denominator.",
  ],
  [
    "complex-fraction",
    "complex-fractions.numeric-complex-fractions",
    "Simplify a complex fraction whose numerator and denominator are each a positive fraction or a sum or difference of a fraction and a fraction or a whole number from 1 to 3.",
  ],
  [
    "rational-power",
    "rational-exponents.rational-base-fractional-powers",
    "Evaluate (a/b)^(m/n) for coprime positive integers a and b, roots n from 2 to 5 and exponents m from −3 to 3 in lowest terms, with every root exact.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} A typed exact value is graded by numeric equivalence. Contextual problems, decimal operands, variable expressions, irrational roots and negative bases require separate assessment.`,
}));
