import type { FacetMapping } from "./coverage";

const scope = (templateIds: string[], facetId: string, rationale: string) =>
  templateIds.map((templateId) => ({
    templateId,
    facetId,
    extent: "partial" as const,
    rationale,
  }));
export const decimalFacetMappings: readonly FacetMapping[] = [
  ...scope(
    ["decimal-grid-read", "tenths-as-hundredths", "decimal-line-point"],
    "decimal-fractions.tenths-hundredths-notation",
    "Numeric responses assess naming given tenths and hundredths models, renaming tenths as hundredths and reading given number lines. Models drawn by the learner require separate assessment.",
  ),
  ...scope(
    ["compare-decimals-hundredths"],
    "compare-decimals.hundredths-comparison",
    "Entering the greater or lesser decimal assesses comparison to hundredths. Comparison symbols and written justification require separate assessment.",
  ),
  ...scope(
    [
      "decimal-digit-value",
      "expanded-decimal",
      "compare-decimals-thousandths",
      "round-decimal",
      "inverse-round-decimal",
    ],
    "decimal-place-value.thousandths-read-compare-round",
    "Numeric responses assess digit value, expanded form, comparison and forward rounding to thousandths. One-choice responses assess which positive decimal rounds to a given tenth or hundredth. General inverse intervals, decimal number names and powers-of-ten patterns require separate assessment.",
  ),
  ...scope(
    [
      "multidigit-decimal-sum",
      "multidigit-decimal-product",
      "multidigit-decimal-quotient",
    ],
    "decimal-algorithms.multidigit-decimal-operations",
    "Numeric responses assess exact sums, differences, products and terminating quotients. Written algorithm layout requires separate assessment.",
  ),
];
