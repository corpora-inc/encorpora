import type { FacetMapping } from "./coverage";
export const descriptiveStatisticsFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "median-data",
    facetId: "signed-data-summaries.finite-median",
    extent: "partial",
    rationale:
      "Calculate the exact median of five to nine explicitly listed signed whole or decimal observations, including repetitions. Does not assess missing observations, frequency tables, graphical reading, modeling, or choosing an appropriate measure of center.",
  },
  {
    templateId: "range-data",
    facetId: "signed-data-summaries.finite-range",
    extent: "partial",
    rationale:
      "Calculate maximum minus minimum for five to nine listed signed whole or decimal observations. Does not assess graphical reading, missing values, transformations, or contextual comparisons of distributions.",
  },
  {
    templateId: "interquartile-range-data",
    facetId: "signed-data-summaries.median-halves-iqr",
    extent: "partial",
    rationale:
      "Calculate the exact interquartile range of five to nine listed values under the explicit median-of-halves convention, excluding the overall median for odd counts. Does not assess alternative quartile definitions, boxplot reading, outlier rules, distribution comparison, or standard deviation.",
  },
];
