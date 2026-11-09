import type { FacetMapping } from "./coverage";
export const realNumberFacetMappings: readonly FacetMapping[] = [
  [
    "classify-real-number",
    "irrational-numbers.classify-forms",
    "Pick the one rational or one irrational number among four: square roots of 2 to 169, cube roots of 2 to 125, negative integers, fractions, terminating and one- or two-digit repeating decimals, π and its multiples or halves to fifths, and a decimal with lengthening runs of zeros. Does not assess sums or products of irrational numbers or proofs of irrationality.",
  ],
  [
    "repeating-decimal-to-fraction",
    "irrational-numbers.repeating-to-fraction",
    "Write repeating decimals with one-, two- or three-digit blocks, one digit before the block, or a whole-number part of 1 to 3 as fractions in simplest form. Does not assess longer delays or blocks, or fraction-to-decimal division.",
  ],
  [
    "root-between-integers",
    "approximate-roots.integer-bounds",
    "Name the smaller or larger consecutive whole number around the square root of 2 to 300 or the cube root of 2 to 999 (non-perfect powers). Does not assess negative radicands or roots of decimals.",
  ],
  [
    "root-nearest-tenth",
    "approximate-roots.nearest-tenth",
    "Round the square root of a non-square whole number from 2 to 200 to the nearest tenth by squaring tenths and the halfway point. Does not assess hundredths, cube roots to tenths, or estimation in context.",
  ],
  [
    "compare-irrational-values",
    "approximate-roots.compare-forms",
    "Choose the greatest or least of four numbers between consecutive whole numbers from 2 to 10: square roots, cube roots, fractions and two-place decimals, each in a different tenth. Does not assess numbers in the same tenth, π, or placing values on a drawn number line.",
  ],
  [
    "solve-square-cube-equation",
    "approximate-roots.root-equations",
    "Choose all real solutions of x² = p for perfect squares, squares of proper fractions and non-square whole numbers, and of x³ = p for positive or negative perfect cubes and non-cube whole numbers. Does not assess x² = p with p ≤ 0, simplifying radical solutions, or equations needing rearrangement.",
  ],
  [
    "scientific-to-standard",
    "scientific-notation.standard-form",
    "Write a × 10ⁿ with one to four significant digits and n from −7 to 9 (not 0) in standard form, and read a calculator E or superscript display, including a product or quotient the display could not fit. Does not assess negative numbers.",
  ],
  [
    "standard-to-scientific",
    "scientific-notation.standard-form",
    "Choose the scientific notation of a positive number with one to four significant digits and exponent from −7 to 9 (not 0), against sign, place-count and coefficient-form errors, and estimate it as one digit times a power of 10. Does not assess negative numbers.",
  ],
  [
    "scientific-times-larger",
    "scientific-notation.compare-magnitude",
    "Find exactly how many times as large one number a × 10ᵐ is as another b × 10ⁿ, and estimate each of two quantities as one digit times a power of 10 before dividing those estimates. The ratio of the digits has at most one decimal place.",
  ],
  [
    "scientific-operations",
    "scientific-notation.operations",
    "Multiply, divide, add or subtract two positive numbers in scientific notation (exponents −8 to 9; sums with exponents up to 3 apart) and choose the result in scientific notation. Does not assess mixed standard and scientific forms or calculator notation.",
  ],
  [
    "choose-unit-size",
    "scientific-notation.standard-form",
    "Choose the unit, on a ladder of thousands, that writes a very large or very small measure as a number from 1 up to 1,000, then choose that number. Does not assess a free numeric entry or a ladder whose steps are not 1,000.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
