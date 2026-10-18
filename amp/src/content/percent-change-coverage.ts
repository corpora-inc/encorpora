import type { FacetMapping } from "./coverage";
export const percentChangeFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "percent-change-rate",
    facetId: "percent-change.relative-change",
    extent: "partial",
    rationale:
      "Exact numeric relative increases and decreases with positive bases, including percentage-valued shares. The direction is stated; explanations, independent direction classification, percentage-point answers, rounding and all contextual transfers are not assessed.",
  },
  {
    templateId: "percent-change-final",
    facetId: "percent-change.changed-quantity",
    extent: "partial",
    rationale:
      "One exact change of a nonnegative quantity, including zero change, complete removal and increases greater than 100%. Successive changes, interest over time, rounding and explanations are not assessed.",
  },
  {
    templateId: "percent-change-original",
    facetId: "percent-change.original-quantity",
    extent: "partial",
    rationale:
      "Exact inverse changes with positive original and final quantities and a nonzero multiplier. The underdetermined 100% decrease, general symbolic modeling, rounding and explanations are not assessed.",
  },
];
