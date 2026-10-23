import type { FacetMapping } from "./coverage";
// Scope: CCSS HSG.CO.B.8, https://www.thecorestandards.org/Math/Content/HSG/CO/
export const congruenceFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "triangle-congruence-criteria",
    facetId: "congruence-criteria.HSG.CO.B.8",
    extent: "partial",
    rationale:
      "Select SSS, SAS, ASA or AAS from explicit corresponding side/angle givens, reject concrete ambiguous SSA and scalable AAA configurations, or select the missing pair for a specified criterion. Does not assess deriving criteria from rigid motions, constructing a congruence transformation, writing proofs, or all special SSA cases.",
  },
];
