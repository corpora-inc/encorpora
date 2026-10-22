import type { FacetMapping } from "./coverage";
export const assessmentGapFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "measurement-error-bound",
    facetId: "units-and-precision.HSN.Q.A.3",
    extent: "partial",
    rationale:
      "Find an exact inclusive bound for an explicitly stated absolute error or percentage of the reported positive mass. Does not assess selecting precision, significant figures, rounding intervals or propagating several measurement errors.",
  },
  {
    templateId: "margin-of-error-interval",
    facetId: "statistical-inference.HSS.IC.A.1",
    extent: "partial",
    rationale:
      "Select the symmetric confidence interval from a stated sample estimate and margin of error for a population mean or proportion. Does not assess computing margins, simulating coverage, sample-size effects or selecting a sampling design.",
  },
  {
    templateId: "radian-arc-ratio",
    facetId: "radians-unit-circle.HSF.TF.A.1",
    extent: "partial",
    rationale:
      "Compute a positive swept angle as arc length divided by radius, including arcs exceeding a semicircle and exact fractions. Does not assess degree conversion, signed rotations or unit-circle trigonometric coordinates.",
  },
];
