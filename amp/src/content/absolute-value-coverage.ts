import type { FacetMapping } from "./coverage";
export const absoluteValueFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "absolute-value-direct-equation",
    facetId: "absolute-value-equations.direct-solution-set",
    extent: "partial",
    rationale:
      "Select complete solution sets of |x| = c with reduced rational targets of numerator magnitude at most 12 and denominator at most 4, including positive, zero, and negative targets. Construction of answers and contextual modeling require separate assessment.",
  },
  {
    templateId: "absolute-value-affine-equation",
    facetId: "absolute-value-equations.affine-solution-set",
    extent: "partial",
    rationale:
      "Select complete solution sets with nonzero integer inside coefficients of magnitude at most 6, nonzero integer constants of magnitude at most 12, and bounded rational targets. Symbolic parameters, arbitrary rational coefficients, and written justification require separate assessment.",
  },
  {
    templateId: "absolute-value-transformed-equation",
    facetId: "absolute-value-equations.transformed-solution-set",
    extent: "partial",
    rationale:
      "Select complete solution sets after outside scaling and shifting with integer multipliers of magnitude at most 4, inside coefficients at most 6, constants at most 12, and exact bounded rational targets. Includes true and false constant equations from zero coefficients. Multiple absolute values, absolute-value inequalities, modeling, and symbolic parameters require separate assessment.",
  },
];
