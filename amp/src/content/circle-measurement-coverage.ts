import type { FacetMapping } from "./coverage";
export const circleMeasurementFacetMappings: readonly FacetMapping[] = [
  [
    "circle-circumference-coefficient",
    "circle-measurement.exact-circumference",
    "Find circumference from a radius or diameter.",
  ],
  [
    "circle-area-coefficient",
    "circle-measurement.exact-area",
    "Find circle area from a radius or diameter.",
  ],
  [
    "arc-length-coefficient",
    "arc-sector-measure.degree-arc-length",
    "Find arc length from a radius or diameter and a stated central angle in degrees, including reflex angles.",
  ],
  [
    "sector-area-coefficient",
    "arc-sector-measure.degree-sector-area",
    "Find sector area from a radius or diameter and a stated central angle in degrees, including reflex angles.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Responses assess the exact rational coefficient of pi with bounded positive givens. Inverse formulas, radians, composite regions, approximations, independently supplied units and contextual modeling require separate assessment.`,
}));
