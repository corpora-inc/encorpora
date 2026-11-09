import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each grade 8 statistics family assesses. */
export const bivariateFacetMappings: readonly FacetMapping[] = [
  [
    "scatter-association-choice",
    "scatterplots.association-patterns",
    "Classify scatter plots by direction and shape, identify clusters and outliers, and construct four-point plots from paired measurements.",
    "Larger constructed plots and borderline patterns require separate assessment.",
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
    "Interpret slope as a rate and the intercept as a prediction at zero, including contexts where zero has no practical meaning.",
    "Written justifications require separate assessment.",
  ],
  [
    "two-way-missing",
    "two-way-tables.complete-tables",
    "Find missing counts and construct a two-way table by tallying a roster with two categorical variables for each student.",
    "Tables with more than two categories per variable require separate assessment.",
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
    "Judge association by comparing row or column percentages when unequal group sizes make raw counts misleading.",
    "Borderline differences and written arguments require separate assessment.",
  ],
].map(([templateId, facetId, scope, limit]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} ${limit}`,
}));
