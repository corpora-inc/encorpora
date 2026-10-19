import type { FacetMapping } from "./coverage";
export const ratioRateFacetMappings: readonly FacetMapping[] = [
  [
    "unit-rate",
    "unit-rates.whole-quantity-unit-rates",
    "Unit rates from printing, fuel, pay, price, baking, running pace and pencils-per-dollar contexts with 2 to 15 units; results are whole numbers, cents or fractions, and the question sets which quantity is at 1. Does not assess interpreting a rate in words, rates from tables or graphs, or unit conversion.",
  ],
  [
    "better-buy",
    "unit-rates.unit-price-comparison",
    "Two packs of 3 to 34 items or ounces with exact cent prices; the larger pack is cheaper per item, dearer per item, or equal. Does not assess more than two options, unit conversion, rounding or discounts stated as percents.",
  ],
  [
    "ratio-table-missing",
    "ratio-tables.missing-table-value",
    "Tables of three or four equivalent columns with simplest ratios of 1 to 9 and multipliers 1 to 12; the missing value may be in either row. Does not assess building a table, additive patterns, fractional entries or plotting the pairs.",
  ],
  [
    "double-number-line-missing",
    "ratio-tables.double-number-line-value",
    "Double number lines with 0, one known pair and one asked pair (top or bottom) for speed, price, reading and recipe contexts, whole-number unit rates. Does not assess drawing the lines, fractional marks or comparing two rates.",
  ],
  [
    "fraction-unit-rate",
    "rational-unit-rates.fraction-quotient-rates",
    "Unit rates for walking, recipe, cheese-price and lawn-mowing contexts where the amount and the number of units are proper fractions (denominators 2 to 8) or a whole-dollar price. Does not assess mixed numbers, complex-fraction notation or rates compared across contexts.",
  ],
  [
    "story-operation-choice",
    "multiplicative-stories.operation-model",
    "Equal-groups, array, length and liquid-volume stories within 100 with an unknown product, group size or number of groups; four equations with +, −, × and ÷. Does not assess equations with the unknown in another position, comparison stories or two-step stories.",
  ],
  [
    "multiplication-division-story",
    "multiplicative-stories.story-solution",
    "The same story structures solved numerically with factors 2 to 10. Does not assess remainders, comparison stories or two-step stories.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
