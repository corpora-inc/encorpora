import type { FacetMapping } from "./coverage";
export const exponentialFacetMappings: readonly FacetMapping[] = [
  ["exponential-model-value", "exponential-models.evaluate"],
  ["exponential-model-rule", "exponential-models.construct"],
  ["linear-or-exponential", "growth-comparison.classify"],
  ["exponential-overtakes", "growth-comparison.eventual"],
  ["same-base-equation", "exponential-equations.common-base"],
  ["exponential-log-solution", "exponential-equations.log-solution"],
  ["log-equation", "exponential-equations.log-domain"],
  ["geometric-series-sum", "sequence-sums.finite-geometric"],
  ["log-rules-evaluate", "logarithm-properties.rules"],
  ["log-expand", "logarithm-properties.rules"],
  ["change-of-base", "logarithm-properties.change-of-base"],
  ["logarithm-value", "logarithms.exact-values"],
  ["log-exponential-form", "logarithms.forms"],
  ["geometric-sequence-rule", "geometric-sequences.ratio-terms"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items give exact tables, graphs, stories or symbolic expressions and ask for an exact value or a choice. Building models from data, interpreting parameters in writing and modeling with technology require separate assessment.",
}));
