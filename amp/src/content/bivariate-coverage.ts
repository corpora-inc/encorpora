import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each grade 8 statistics family assesses. */
export const bivariateFacetMappings: readonly FacetMapping[] = [
  [
    "scatter-association-choice",
    "scatterplots.association-patterns",
    "Classify clear-cut scatter plots of 12 to 16 points as positive linear, negative linear, nonlinear or no association.",
    "Clusters, outliers and borderline patterns require separate assessment.",
  ],
  [
    "trend-line-predict",
    "scatterplots.trend-line-models",
    "Find a drawn trend line's integer slope from two marked points and predict a value on the grid.",
    "Choosing a line of fit and writing its equation require separate assessment.",
  ],
  [
    "trend-slope-meaning",
    "scatterplots.trend-line-models",
    "Choose the slope's meaning as a rate in context over an intercept, a point or swapped quantities.",
    "Interpreting intercepts in writing requires separate assessment.",
  ],
  [
    "two-way-missing",
    "two-way-tables.complete-tables",
    "Find a missing count from a column total when its row has two blanks.",
    "Building a table from raw categorical data requires separate assessment.",
  ],
  [
    "two-way-row-percent",
    "two-way-tables.relative-frequency-association",
    "Find a whole-number percent within one row of a two-way table.",
    "Column and joint relative frequencies require separate assessment.",
  ],
  [
    "two-way-association-choice",
    "two-way-tables.relative-frequency-association",
    "Judge association by comparing row percents when raw counts point the other way.",
    "Borderline differences and written arguments require separate assessment.",
  ],
].map(([templateId, facetId, scope, limit]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} ${limit}`,
}));
