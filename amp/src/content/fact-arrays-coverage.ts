import type { FacetMapping } from "./coverage";
export const factArrayFacetMappings: readonly FacetMapping[] = [
  [
    "multiply-facts",
    "multiplication-facts.array-facts",
    "Factors 2 to 10, half drawn from 6 to 9, in four frames, each with a covered dot array.",
  ],
  [
    "divide-facts",
    "division-facts.related-facts",
    "Divisors and quotients 2 to 10, from an equation, an array, a given fact, or rows of chairs.",
  ],
  [
    "missing-factor-fact",
    "missing-factor.unknown-factor-divisor",
    "An unknown first factor, second factor, or divisor, with a covered array that hides the unknown side.",
  ],
  [
    "share-or-group",
    "division-meaning.share-measure",
    "Totals to 60 shared among 2 to 8 groups or measured into groups of 2 to 9, from counters or a story.",
  ],
  [
    "times-table-pattern",
    "arithmetic-patterns.table-patterns",
    "Products to 100 from a table window: a row's constant step, a doubled row, or the sum of two rows.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Untimed numeric answers show accuracy, not fluency or recall over time; explaining a pattern or modeling a story in words requires separate assessment.`,
}));
