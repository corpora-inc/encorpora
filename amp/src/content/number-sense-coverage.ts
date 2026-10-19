import type { FacetMapping } from "./coverage";
export const numberSenseFacetMappings: readonly FacetMapping[] = [
  [
    "count-sequence-missing",
    "count-to-100.counts-and-chart",
    "Four-term counts by ones or tens within 100 with one missing term after the first; most counts by ones cross a ten.",
  ],
  [
    "hundred-chart-missing",
    "count-to-100.counts-and-chart",
    "Windows of two or three rows and three to five columns of the hundred chart with one empty square.",
  ],
  [
    "numeral-for-quantity",
    "write-numerals.frames-to-twenty",
    "0 to 20 counters filled in order in one or two ten-frames, including 0, 10 and 20.",
  ],
  [
    "number-line-hops",
    "number-line-arithmetic.tens-and-ones-hops",
    "A tens hop of 10 to 30 then an ones hop of 1 to 9 in the same direction, staying within 1 to 99.",
  ],
  [
    "number-line-missing-hop",
    "number-line-arithmetic.tens-and-ones-hops",
    "The length of one hop of 12 to 40 between numbers from 10 to 95, in either direction.",
  ],
  [
    "round-to-ten",
    "round-whole-numbers.nearest-ten-hundred",
    "Whole numbers from 11 to 999, including halfway values, carries into the next hundred and multiples of ten.",
  ],
  [
    "round-to-hundred",
    "round-whole-numbers.nearest-ten-hundred",
    "Three-digit numbers including halfway values, tens digit 4 with ones 5 to 9, carries to 1,000 and multiples of a hundred.",
  ],
  [
    "round-large",
    "large-place-value.rounding-large",
    "Five- and six-digit numbers rounded to the hundred, thousand or ten thousand, including halfway values, values just below halfway and carries.",
  ],
  [
    "multiply-power-of-ten",
    "powers-of-ten.shift-by-powers",
    "Whole numbers and decimals with one or two places times 10, 100 or 1,000, sometimes written as 10¹, 10² or 10³.",
  ],
  [
    "divide-power-of-ten",
    "powers-of-ten.shift-by-powers",
    "Whole numbers up to 999,000 divided by 10, 100 or 1,000 with whole or decimal quotients to thousandths.",
  ],
  [
    "digit-value-ratio",
    "powers-of-ten.shift-by-powers",
    "One nonzero digit in two places one to three apart in a four- to six-digit number.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} The response is a typed number; oral counting, learner-drawn number lines and written explanations require separate assessment.`,
}));
