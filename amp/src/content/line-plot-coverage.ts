import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each line-plot family assesses. */
export const linePlotFacetMappings: readonly FacetMapping[] = [
  [
    "line-plot-whole",
    "line-plots.read-whole-unit-plots",
    "Read eight to fourteen whole-inch or whole-centimeter lengths from a line plot: count at a length, longer than a length, total measured, and longest minus shortest.",
  ],
  [
    "fraction-line-plot",
    "fraction-line-plots.read-half-quarter-plots",
    "Count measurements at or longer than a half- or quarter-inch length on a two- or three-unit line plot.",
  ],
  [
    "fraction-plot-difference",
    "fraction-plot-arithmetic.like-fraction-plot-operations",
    "Subtract or add the longest and shortest lengths, or total repeated lengths, from fourths or eighths line plots.",
  ],
  [
    "fraction-plot-equal-share",
    "fraction-plot-computation.equal-share",
    "Pool four to eight halves, fourths or eighths of a liter and share the total equally, with an exact share on the plot's scale.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Measuring objects and drawing the plot require separate assessment.`,
}));
