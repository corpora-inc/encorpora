import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each grade 7 statistics family assesses. */
export const inferenceFacetMappings: readonly FacetMapping[] = [
  [
    "representative-sample-choice",
    "sampling.representative-samples",
    "Choose the one method that samples at random from the whole population among three convenience, volunteer or subgroup samples.",
    "Designing a sampling plan and explaining a bias in writing require separate assessment.",
  ],
  [
    "sample-proportion-estimate",
    "sampling.population-estimates",
    "Scale a random sample's whole-number count to a population of 400 to 5,000.",
    "Estimating means and judging margins of error require separate assessment.",
  ],
  [
    "sample-estimates-plot",
    "sampling.sampling-variation",
    "Estimate a population count from the mean of ten random samples of 20 shown as a dot plot.",
    "Simulating samples and judging how far estimates may stray require separate assessment.",
  ],
  [
    "means-in-mads",
    "compare-distributions.centers-in-mads",
    "Find two means from a double dot plot and express their difference in multiples of a stated shared MAD.",
    "Groups with unequal variability require separate assessment.",
  ],
  [
    "double-box-compare",
    "compare-distributions.box-plot-comparison",
    "Subtract medians or IQRs read from two box plots, or express the median gap in multiples of an equal IQR.",
    "Written comparative inferences require separate assessment.",
  ],
  [
    "compare-distributions-choice",
    "compare-distributions.box-plot-comparison",
    "Choose the true statement about which of two box plots has the greater median and the greater IQR.",
    "Written comparative inferences require separate assessment.",
  ],
].map(([templateId, facetId, scope, limit]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} ${limit}`,
}));
