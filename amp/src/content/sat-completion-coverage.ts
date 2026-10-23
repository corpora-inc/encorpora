import type { FacetMapping } from "./coverage";
export const satCompletionFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "sample-mean-estimate",
    facetId: "statistical-inference.HSS.IC.A.1",
    extent: "partial",
    rationale:
      "Estimate a population mean or total from a stated simple random sample mean; does not calculate confidence bounds.",
  },
  {
    templateId: "probability-missing-count",
    facetId: "probability.core",
    extent: "partial",
    rationale:
      "Recover the unknown event count from a probability and complementary count for equally likely objects. Does not assess unknown two-way table cells conditioned on a third variable.",
  },
  {
    templateId: "standard-deviation-compare",
    facetId: "statistical-summary-comparison.HSS.ID.A.2",
    extent: "partial",
    rationale:
      "Compare spread under a translation, scaling, or a change in distances from a shared mean. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "sample-size-margin",
    facetId: "sampling-margin-error.HSS.IC.B.4",
    extent: "partial",
    rationale:
      "Compare margins of error for comparable random samples at the same confidence level. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "compound-unit-conversion",
    facetId: "units-and-precision.HSN.Q.A.1",
    extent: "partial",
    rationale:
      "Convert rates, squared and cubed units, density, and energy from power and time. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "degree-radian-conversion",
    facetId: "radians-unit-circle.HSF.TF.A.1",
    extent: "partial",
    rationale:
      "Convert in either direction using the exact relationship between a half turn and pi radians. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "unit-circle-coordinate",
    facetId: "radians-unit-circle.HSF.TF.A.2",
    extent: "partial",
    rationale:
      "Use exact sine and cosine values and quadrant signs for angles around the unit circle. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "similar-solid-volume",
    facetId: "dilation-properties.lengths-centers-invariants",
    extent: "partial",
    rationale:
      "Use a cubed scale factor to connect corresponding lengths and volumes, in either direction. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "nonlinear-formula-isolate",
    facetId: "formula-rearrangement.HSA.CED.A.4",
    extent: "partial",
    rationale:
      "Isolate a positive quantity appearing squared, retaining the stated domain. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "quadratic-context-model",
    facetId: "nonlinear-equation-modeling.HSF.BF.A.1",
    extent: "partial",
    rationale:
      "Build an area or height model and interpret its maximum or positive zero. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "exponential-time-scale",
    facetId: "exponential-models.HSF.IF.C.8",
    extent: "partial",
    rationale:
      "Rewrite a growth or decay model for another time interval and interpret its factor. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "symbolic-rational-exponent",
    facetId: "rational-exponents.HSN.RN.A.2",
    extent: "partial",
    rationale:
      "Recognize equivalent symbolic radical and rational-exponent expressions on a positive domain. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "rational-expression-operation",
    facetId: "rational-expressions.HSA.APR.D.7",
    extent: "partial",
    rationale:
      "Add, subtract, or multiply rational expressions while retaining excluded inputs. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "nonlinear-data-model",
    facetId: "regression-interpretation.core",
    extent: "partial",
    rationale:
      "Choose a linear, quadratic, or exponential model fitting plotted observations by comparing squared residuals. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "quadratic-parameter-root",
    facetId: "quadratic-formula.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Find a coefficient giving exactly one distinct real root using a zero discriminant. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
  {
    templateId: "rational-function-representation",
    facetId: "cross-representation-comparison.features",
    extent: "partial",
    rationale:
      "Connect a rational rule with a table or graph, or solve for an input, respecting the excluded denominator. Uses bounded original instances; does not establish exhaustive coverage of the aligned standard.",
  },
];
