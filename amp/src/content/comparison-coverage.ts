import type { FacetMapping } from "./coverage";
export const comparisonFacetMappings: readonly FacetMapping[] = [
  [
    "compare-groups",
    "compare-small-groups.paired-rows",
    "Rows of 2 to 10 circles and squares, a quarter of them equal, with the fewer row spread wider in half of the unequal cases.",
  ],
  [
    "greater-numeral",
    "compare-numerals.numerals-to-ten",
    "Two different numerals from 0 to 10; the learner names the greater or the lesser.",
  ],
  [
    "compare-two-digit",
    "compare-two-digit.tens-then-ones",
    "Two different two-digit numbers shown as rods and cubes, including reversed digits and pairs where the lesser number has more ones.",
  ],
  [
    "two-digit-symbol",
    "compare-two-digit.tens-then-ones",
    "Select the true <, = or > statement for two two-digit numbers, including equal pairs.",
  ],
  [
    "compare-three-digit",
    "compare-three-digit.highest-differing-place",
    "Two different three-digit numbers decided at the hundreds, tens or ones, including reversed digits and zero placeholders.",
  ],
  [
    "three-digit-symbol",
    "compare-three-digit.highest-differing-place",
    "Select the true <, = or > statement for two three-digit numbers, including equal pairs.",
  ],
  [
    "multidigit-digit-value",
    "large-place-value.digit-value-and-comparison",
    "Value of a nonzero digit that appears once in a four- to six-digit number, in the tens through hundred thousands place.",
  ],
  [
    "compare-multidigit",
    "large-place-value.digit-value-and-comparison",
    "Two whole numbers from 1,000 to 999,999 with different digit counts or a differing place anywhere from the hundred thousands to the ones.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} The response is a numeric answer or one selected statement; written symbols, oral explanations and learner-built models require separate assessment.`,
}));
