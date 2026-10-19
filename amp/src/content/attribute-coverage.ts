import type { FacetMapping } from "./coverage";

const scope = (templateIds: string[], facetId: string, rationale: string) =>
  templateIds.map((templateId) => ({
    templateId,
    facetId,
    extent: "partial" as const,
    rationale,
  }));
export const attributeFacetMappings: readonly FacetMapping[] = [
  ...scope(
    ["compare-lengths", "compare-weights", "compare-capacity"],
    "compare-attributes.length-weight-capacity-comparison",
    "Choices assess comparing drawn lengths, balances and pours. Describing attributes in words and hands-on comparison require separate assessment.",
  ),
  ...scope(
    ["measure-with-units", "correct-unit-measure", "order-lengths"],
    "measure-equal-units.unit-iteration",
    "Numeric responses and choices assess counting drawn units, judging unit layouts and ordering by transitivity. Measuring real objects requires separate assessment.",
  ),
  ...scope(
    ["read-liquid-volume", "balance-mass", "mass-volume-story"],
    "mass-volume.grams-liters-reading-and-stories",
    "Numeric responses assess reading drawn balances and scales and one-step measurement stories. Estimating masses and volumes requires separate assessment.",
  ),
];
