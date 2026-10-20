import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each Algebra 1 statistics family assesses. */
export const algebraStatisticsFacetMappings: readonly FacetMapping[] = [
  [
    "outlier-center-shift",
    "statistical-summary-comparison.outliers-and-shape",
    "Decide how removing, adding or correcting one outlier changes the mean and the median of dot-plot data.",
    "Computing standard deviations and writing comparisons require separate assessment.",
  ],
  [
    "skewed-box-compare",
    "statistical-summary-comparison.outliers-and-shape",
    "Describe two box plots as skewed or symmetric, choose medians and IQRs for skewed data, and tell the range from the IQR.",
    "Histograms and comparisons that use standard deviations require separate assessment.",
  ],
  [
    "relative-frequency-percent",
    "categorical-association.relative-frequencies",
    "Find whole-number joint, marginal and conditional percents from a 2 × 2 table with totals.",
    "Larger tables and building tables from raw data require separate assessment.",
  ],
  [
    "conditional-frequency-choice",
    "categorical-association.relative-frequencies",
    "Tell a conditional percent from its reverse and from joint and marginal percents, and judge association by conditional percents.",
    "Written arguments about association require separate assessment.",
  ],
  [
    "regression-coefficient-meaning",
    "regression-interpretation.slope-intercept",
    "Interpret a least-squares slope with units, and decide whether its intercept is meaningful or an extrapolation.",
    "Fitting the line and nonlinear models require separate assessment.",
  ],
  [
    "regression-line-predict",
    "regression-interpretation.slope-intercept",
    "Predict from a least-squares line, find predicted differences, and solve for the input of a prediction.",
    "Judging when extrapolation is reasonable requires separate assessment.",
  ],
  [
    "residual-value",
    "residuals-correlation.residuals-and-r",
    "Find a residual from a scatter plot or table, and an observed value from its residual.",
    "Computing a least-squares line or r by hand requires separate assessment.",
  ],
  [
    "correlation-choice",
    "residuals-correlation.residuals-and-r",
    "Estimate r from a scatter plot, compare strengths, read residual plots, and recognize a curve with r near 0.",
    "Computing r requires separate assessment.",
  ],
  [
    "causal-claim-choice",
    "causal-claims.association-causation",
    "Choose the conclusion observed data support, a lurking variable, or a reverse causal explanation.",
    "Writing causal critiques requires separate assessment.",
  ],
  [
    "study-design-choice",
    "causal-claims.association-causation",
    "Choose a randomized design, classify a study, and draw the conclusion its design supports from a results table.",
    "Designing blocking, blinding or sampling plans requires separate assessment.",
  ],
].map(([templateId, facetId, scope, limit]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} ${limit}`,
}));
