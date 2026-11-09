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
      "Form symmetric intervals for means or proportions and derive a margin from a frequency table of 100 seeded simulated sample estimates. Does not assess choosing a sampling design or operating a simulator.",
  },
  {
    templateId: "margin-of-error-interval",
    facetId: "statistical-inference.HSS.IC.B.4",
    extent: "partial",
    rationale:
      "Find the smallest centered band containing at least 95 of 100 simulated sample means or proportions, then calculate both interval endpoints. The engine runs the simulation; the learner develops its empirical margin.",
  },
  {
    templateId: "radian-arc-ratio",
    facetId: "radians-unit-circle.HSF.TF.A.1",
    extent: "partial",
    rationale:
      "Compute a positive swept angle as arc length divided by radius, including arcs exceeding a semicircle and exact fractions. Does not assess degree conversion, signed rotations or unit-circle trigonometric coordinates.",
  },
];
