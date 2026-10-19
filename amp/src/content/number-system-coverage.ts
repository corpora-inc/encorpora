import type { FacetMapping } from "./coverage";
export const numberSystemFacetMappings: readonly FacetMapping[] = [
  [
    "greatest-common-factor",
    "gcf-lcm.greatest-common-factor",
    "Find the greatest common factor of two whole numbers up to 100, bare or as the greatest number of identical sets or the largest square tile for a rectangle. Does not assess three or more numbers or algebraic expressions.",
  ],
  [
    "least-common-multiple",
    "gcf-lcm.least-common-multiple",
    "Find the least common multiple of two whole numbers from 2 to 12, bare or as matching package totals or the next shared time of two repeating events. Does not assess three or more numbers or larger values.",
  ],
  [
    "gcf-factor-sum",
    "gcf-lcm.distributive-gcf",
    "Choose the form a(b + c) of a sum of two whole numbers up to 100 in which a is their greatest common factor, against a smaller common factor and undivided terms. Does not assess writing the form without choices or factoring differences.",
  ],
  [
    "long-division-quotient",
    "integer-division.standard-algorithm",
    "Divide whole numbers up to 97,902 by two-digit divisors with exact two- or three-digit quotients, including zero quotient digits, bare or as equal sharing. Does not assess three-digit divisors or decimal quotients.",
  ],
  [
    "division-remainder-story",
    "integer-division.remainder-meaning",
    "Divide up to four-digit numbers by divisors from 12 to 60 in stories and answer with the quotient rounded up, the quotient, or the remainder. Does not assess fractional or decimal remainders.",
  ],
  [
    "signed-quantity",
    "signed-numbers.opposite-quantities",
    "Write the signed number for a quantity above or below a reference 0 (elevation, temperature, deposits, yards, floors) and for the opposite of a given signed quantity. Does not assess explaining the meaning of 0 in words.",
  ],
  [
    "opposite-on-line",
    "signed-numbers.opposites-on-line",
    "Read an integer from −9 to 9 on a number line with labels every 5 and give its opposite or the opposite of its opposite. Does not assess plotting points or rational numbers on the line.",
  ],
  [
    "signed-story",
    "rational-stories.signed-decimal-stories",
    "Solve temperature, elevation and account-balance stories with signed decimals in quarters or cents: a start, one change and one repeated change, or the change or distance between two signed values. Does not assess fractions, percents or writing equations.",
  ],
  [
    "signed-jumps",
    "rational-stories.signed-decimal-stories",
    "Add two or three alternating signed half-unit changes shown as arrows on a number line to a signed start. Method step toward signed stories.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
