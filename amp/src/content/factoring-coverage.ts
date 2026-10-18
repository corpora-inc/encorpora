import type { FacetMapping } from "./coverage";
export const factoringFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "greatest-monomial-factor",
    facetId: "factor-quadratics.monomial-gcf",
    extent: "partial",
    rationale:
      "Extract a positive monomial GCF from two or three signed integer terms of degree one through three. Does not assess multivariable expressions, rational coefficients, general polynomial division, or complete factorization of the remaining polynomial.",
  },
  {
    templateId: "monic-quadratic-factorization",
    facetId: "factor-quadratics.monic-integer-factors",
    extent: "partial",
    rationale:
      "Recognize complete integer factorization of bounded monic quadratics with nonzero constants, including equal and conjugate factors. Does not assess irreducibility decisions, zero constants, rational or irrational factors, symbolic coefficients, or constructing a factorization without choices.",
  },
  {
    templateId: "nonmonic-quadratic-factorization",
    facetId: "factor-quadratics.nonmonic-integer-factors",
    extent: "partial",
    rationale:
      "Recognize complete bounded integer quadratic factorizations, retaining positive or negative numerical content and primitive linear factors. Does not assess irreducibility decisions, zero constants, rational or irrational factors, symbolic coefficients, or higher-degree factorization.",
  },
];
