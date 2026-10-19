import type { FacetMapping } from "./coverage";
export const factsFacetMappings: readonly FacetMapping[] = [
  [
    "facts-to-five",
    "facts-within-5.sums-differences-to-five",
    "Single additions and subtractions within five, including zero.",
  ],
  [
    "count-on-back",
    "counting-arithmetic.count-on-back-steps",
    "Count on or back 1 to 4 steps from a marked start on a 0–20 line, half of them across ten.",
  ],
  [
    "counted-steps",
    "counting-arithmetic.count-on-back-steps",
    "Name the number added or subtracted by a shown count of 2 to 5 steps.",
  ],
  [
    "make-ten-fact",
    "addition-facts.facts-across-ten",
    "Sums of two one-digit numbers from 11 to 18, shown on two ten-frames.",
  ],
  [
    "related-subtraction",
    "addition-facts.facts-across-ten",
    "Differences within 20 with a one-digit subtrahend, four in five across ten.",
  ],
  [
    "mental-ten-hundred",
    "mental-tens-hundreds.ten-hundred-more-less",
    "Plus or minus 10 or 100 from starts of 100 to 900, a quarter of them regrouping across a hundred.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Untimed numeric answers show accuracy, not fluency or recall over time; oral strategies and learner-made models require separate assessment.`,
}));
