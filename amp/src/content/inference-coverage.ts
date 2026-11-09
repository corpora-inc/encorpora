import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each grade 7 statistics family assesses. */
export const inferenceFacetMappings: readonly FacetMapping[] = [
  [
    "scope-of-inference-choice",
    "study-design.core",
    "Distinguish simple random sampling, volunteer and convenience selection from random or self-selected treatment allocation; choose supported population generalization and causal inference in three question frames.",
    "Writing sampling plans, blocking, blinding and statistical significance calculations require separate assessment.",
  ],
  [
    "representative-sample-choice",
    "sampling.representative-samples",
    "Choose representative sampling methods and judge whether a stated population generalization is supported by the sample's selection method.",
    "Designing a sampling plan and explaining a bias in writing require separate assessment.",
  ],
  [
    "sample-proportion-estimate",
    "sampling.population-estimates",
    "Scale a random sample's count to a population and distinguish approximate population inferences from claims of exact counts.",
    "Estimating means and judging margins of error require separate assessment.",
  ],
  [
    "sample-estimates-plot",
    "sampling.sampling-variation",
    "Estimate population counts from sample means and gauge the range and largest distance from the class estimate in ten seeded simulated samples of equal size.",
    "The engine generates the samples; learners do not operate a sampling simulator or infer guaranteed bounds on the population count.",
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
