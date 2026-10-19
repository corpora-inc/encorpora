import type { FacetMapping } from "./coverage";

const scope = (templateIds: string[], facetId: string, rationale: string) =>
  templateIds.map((templateId) => ({
    templateId,
    facetId,
    extent: "partial" as const,
    rationale,
  }));
export const partWholeFacetMappings: readonly FacetMapping[] = [
  ...scope(
    ["find-equal-shares", "name-equal-share", "larger-share"],
    "halves-and-quarters.equal-share-recognition",
    "Choices assess recognition of equal two- and four-part partitions and their names from drawn models. Learner-made partitions and spoken or written descriptions require separate assessment.",
  ),
  ...scope(
    ["find-equal-thirds", "name-share", "same-share-different-shape"],
    "thirds-and-partitions.equal-share-naming",
    "Choices assess equal-share recognition, naming through quarters and same-whole comparison across cut styles. Learner-made partitions require separate assessment.",
  ),
  ...scope(
    ["equal-area-fraction", "equal-area-part-size"],
    "partition-area.equal-area-unit-fraction",
    "Numeric responses assess unit-fraction naming and part area for given equal-area grid partitions. Creating partitions requires separate assessment.",
  ),
  ...scope(
    ["compare-like-denominators", "compare-like-numerators"],
    "compare-fractions.same-whole-comparison",
    "Entering the greater or lesser fraction assesses comparison with denominators 2, 3, 4, 6 and 8. Comparison symbols and written justification require separate assessment.",
  ),
  ...scope(
    ["compare-unlike-fractions"],
    "fraction-comparison.unlike-fraction-comparison",
    "Entering the greater or lesser fraction assesses comparison with denominators from 2 through 12. Comparison symbols and written justification require separate assessment.",
  ),
];
