import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each grade 6 statistics family assesses. */
export const distributionFacetMappings: readonly FacetMapping[] = [
  [
    "statistical-question-choice",
    "statistical-questions.recognize-variability",
    "Choose the one statistical question among four everyday questions with single answers.",
    "Writing statistical questions and naming sources of variability require separate assessment.",
  ],
  [
    "dot-plot-mean",
    "mean-median.dot-plot-mean",
    "Find the exact mean of six to ten whole-number values shown in a dot plot.",
    "Interpreting the mean in context beyond the balance model requires separate assessment.",
  ],
  [
    "mean-missing-value",
    "mean-median.mean-total-relation",
    "Recover a missing quiz score from a stated whole-number mean and the other three to five scores.",
    "Medians of stated data are assessed by the signed data summaries families.",
  ],
  [
    "histogram-read",
    "distribution-plots.histograms",
    "Count values in one bin, at least or below a bin edge, or in all, from five- or six-bin histograms.",
    "Drawing histograms and choosing intervals require separate assessment.",
  ],
  [
    "box-plot-read",
    "distribution-plots.box-plots",
    "Read the median, range and interquartile range from a box plot, and the approximate percent of data beyond a quartile or within the box.",
    "Constructing box plots from data and dot plots from lists require separate assessment.",
  ],
  [
    "dot-plot-mad",
    "variability.mean-absolute-deviation",
    "Find the exact mean absolute deviation of five to eight dot-plot values with a whole-number mean.",
    "Comparing variability across data sets is assessed in later families.",
  ],
  [
    "dot-plot-iqr",
    "variability.dot-plot-iqr",
    "Find the interquartile range of seven to twelve dot-plot values by the stated median-of-halves convention.",
    "Other quartile conventions require separate assessment.",
  ],
  [
    "typical-value-choice",
    "variability.appropriate-center",
    "Choose the median as the typical value when one value lies far above the rest.",
    "Describing shape and choosing summaries for skewed data without a single outlier require separate assessment.",
  ],
].map(([templateId, facetId, scope, limit]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} ${limit}`,
}));
