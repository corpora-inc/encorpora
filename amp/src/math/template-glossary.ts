import type { TemplateMetadata } from "./contracts";

/** How K–8 generated hints and explanations read ambiguous glossary words
 * (#1781): each template's sense map (lowercase form → glossary term id) and
 * the forms that are ordinary words in its text ("leaves 1 over", "the
 * ones digit changes"). Merged into the template metadata in `engine.ts`;
 * a template's own `glossarySenses`/`glossaryNoLink` win. */
export const templateGlossary: Readonly<
  Record<
    string,
    { senses?: Record<string, string>; noLink?: readonly string[] }
  >
> = {
  "add-ones-regroup": {
    senses: { "more than": "more-than" },
    noLink: ["leaves"],
  },
  "add-several-two-digit": {
    senses: { parts: "part" },
    noLink: ["mean", "units"],
  },
  "add-within-20": { noLink: ["change"] },
  "area-model-product": {
    senses: { product: "product-multiply" },
    noLink: ["whole"],
  },
  "bag-totals-chain": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "balanced-addition": {
    senses: { sides: "side-of-equation" },
    noLink: ["scale"],
  },
  "circle-estimate-blanks": { senses: { center: "center" }, noLink: ["edge"] },
  "clock-minute-match": { senses: { "more than": "more-than" } },
  "compare-like-denominators": { senses: { "more than": "more-than" } },
  "compare-like-numerators": { senses: { "more than": "more-than" } },
  "compare-three-digit": { noLink: ["change"] },
  "compare-two-digit": { noLink: ["change"] },
  "compare-unlike-fractions": { senses: { "more than": "more-than" } },
  "continue-count-to-120": {
    senses: { "more than": "more-than" },
    noLink: ["changes"],
  },
  "count-sequence-missing": { senses: { "more than": "more-than" } },
  "decimal-rename-chain": { senses: { part: "part", parts: "part" } },
  "decompose-flat-shape": { senses: { sides: "side" } },
  "divide-power-of-ten": { senses: { factor: "factor-number" } },
  "eighths-and-parts-beyond-one": {
    senses: { eighths: "eighth", part: "part", parts: "part", whole: "whole" },
  },
  "equal-area-fraction": {
    senses: { part: "part", parts: "part", squares: "square-shape" },
  },
  "equal-area-part-size": { senses: { parts: "part" } },
  "equation-after-one-step": {
    senses: {
      balance: "balance-scale",
      side: "side-of-equation",
      term: "term-expression",
    },
    noLink: ["whole"],
  },
  "equivalent-fractions-select": { noLink: ["changes", "part", "parts"] },
  "expression-after-first-step": { noLink: ["part"] },
  "factor-out-choice": {
    senses: { term: "term-expression" },
    noLink: ["part"],
  },
  "factor-partner": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "find-equal-shares": { senses: { parts: "part" } },
  "find-equal-thirds": { senses: { parts: "part" } },
  "fraction-line-names-select": { senses: { part: "part", parts: "part" } },
  "fraction-model": {
    senses: { part: "part", parts: "part", whole: "whole" },
    noLink: ["mean"],
  },
  "fraction-total-minus-parts": { senses: { parts: "part" } },
  "full-kits": { noLink: ["leaves"] },
  "greater-numeral": { noLink: ["faces", "side"] },
  "hundred-chart-missing": { noLink: ["square"] },
  "hundreds-model": {
    senses: { parts: "part", square: "square-shape", squares: "square-shape" },
    noLink: ["model"],
  },
  "inequality-solution-blanks": {
    senses: { sides: "side-of-equation" },
    noLink: ["rule"],
  },
  "integer-power": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "join-within-10": { noLink: ["square"] },
  "kit-leftovers": { noLink: ["leaves"] },
  "larger-share": { senses: { whole: "whole" } },
  "linear-equation": { senses: { sides: "side-of-equation" } },
  "make-hundred": {
    senses: { jump: "jump", jumps: "jump" },
    noLink: ["whole"],
  },
  "make-ten-remainder": { senses: { part: "part" } },
  "mean-data": { senses: { mean: "mean-average" } },
  "measurable-attribute-choice": { noLink: ["key"] },
  "mental-ten-hundred": { noLink: ["changes", "leaves"] },
  "multiply-by-one-digit": { senses: { part: "part", parts: "part" } },
  "multiply-facts": {
    senses: { factors: "factor-number" },
    noLink: ["change", "whole"],
  },
  "multiply-multidigit": { senses: { part: "part" } },
  "name-equal-share": {
    senses: {
      "one quarter": "fourth",
      part: "part",
      parts: "part",
      quarters: "fourth",
      square: "square-shape",
    },
  },
  "name-share": {
    senses: {
      part: "part",
      parts: "part",
      quarters: "fourth",
      square: "square-shape",
      thirds: "third",
      whole: "whole",
    },
  },
  "neighbor-product-change": { senses: { squares: "square-shape" } },
  "number-bond-missing": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "number-line-between-hundreds": { senses: { "more than": "more-than" } },
  "number-line-hops": { noLink: ["changes"] },
  "number-line-jump-story": { senses: { jump: "jump" } },
  "number-line-missing-hop": { senses: { jumps: "jump" } },
  "operation-property-identify": {
    senses: { part: "part" },
    noLink: ["change", "opposite", "rule"],
  },
  "operation-sentence-choice": { noLink: ["jump", "jumps"] },
  "pairing-leftover": { noLink: ["leaves"] },
  "power-compare": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      "more than": "more-than",
    },
    noLink: ["changes"],
  },
  "power-doubling-story": { senses: { factor: "factor-number" } },
  "power-missing-exponent": { senses: { factor: "factor-number" } },
  "power-order-trap": {
    senses: {
      squared: "square-number",
      squares: "square-number",
      squaring: "square-number",
    },
    noLink: ["whole"],
  },
  "power-repeated-product": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      product: "product-multiply",
    },
  },
  "price-count-chain": { noLink: ["whole"] },
  "purchase-change": { noLink: ["more than"] },
  "rectangle-area": { senses: { squares: "square-shape" } },
  "related-division-sentence": { senses: { side: "side-of-equation" } },
  "related-subtraction": { senses: { jumps: "jump" } },
  "related-subtraction-sentence": {
    senses: { part: "part", whole: "whole" },
    noLink: ["leaves"],
  },
  "right-triangle": { senses: { side: "side", sides: "side" } },
  "round-large": { noLink: ["rule"] },
  "round-to-hundred": { noLink: ["changes", "rule"] },
  "round-to-ten": { noLink: ["changes", "rule"] },
  "same-share-different-shape": {
    senses: { part: "part", parts: "part", squares: "square-shape" },
  },
  "scale-drawing-work": { senses: { unit: "unit" } },
  "scientific-notation-work": { senses: { average: "mean-average" } },
  "share-remainder-fractions": { senses: { part: "part", parts: "part" } },
  "show-work-rental-plans": { senses: { sides: "side-of-equation" } },
  "signed-changes-sum": { senses: { changes: "change" } },
  "skip-count-missing": { senses: { "more than": "more-than" } },
  "small-array-total": { senses: { squares: "square-shape" } },
  "subtract-through-ten": { senses: { part: "part", parts: "part" } },
  "subtract-whole-tens": { noLink: ["whole"] },
  "subtract-with-regrouping": { noLink: ["leaves"] },
  "tally-and-t-chart": { senses: { difference: "difference-subtract" } },
  "ten-more-or-less": {
    senses: { "more than": "more-than" },
    noLink: ["changes"],
  },
  "tens-contribution": { noLink: ["part"] },
  "tens-ones-model": {
    senses: { square: "square-shape", squares: "square-shape" },
  },
  "three-addend-story": { noLink: ["third"] },
  "three-digit-symbol": { noLink: ["change", "faces", "side"] },
  "times-table-pattern": { senses: { product: "product-multiply" } },
  "two-digit-symbol": { noLink: ["change", "faces", "side"] },
  "two-step-change": { senses: { changes: "change" } },
  "unit-size-and-count": { senses: { unit: "unit", units: "unit" } },
  "unknown-addend-story": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "whole-number-equality-choice": { senses: { sides: "side-of-equation" } },
};

/** A template with its K–8 glossary senses merged in. */
export function withTemplateGlossary(t: TemplateMetadata): TemplateMetadata {
  const g = templateGlossary[t.id];
  if (!g) return t;
  return {
    ...t,
    glossarySenses: { ...g.senses, ...t.glossarySenses },
    glossaryNoLink: [...(g.noLink ?? []), ...(t.glossaryNoLink ?? [])],
  };
}
