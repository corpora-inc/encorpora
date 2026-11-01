/** Which glossary entry each ambiguous word means in a K–2, 3–5 or 6–8
 * template's generated hints and explanations, and which words are ordinary
 * prose there ("leaves 1 over", "the ones digit changes", the "open side" of
 * >). Merged by `withTemplateGlossary` in `template-glossary.ts`. */
export const k8TemplateGlossary: Record<
  string,
  { senses?: Record<string, string>; noLink?: string[] }
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
  "arithmetic-term": { senses: { term: "term-sequence" }, noLink: ["change"] },
  "bag-totals-chain": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "balanced-addition": {
    senses: { sides: "side-of-equation" },
    noLink: ["scale"],
  },
  "benchmark-fraction-estimate": { senses: { "more than": "more-than" } },
  "circle-estimate-blanks": { senses: { center: "center" }, noLink: ["edge"] },
  "clock-minute-match": { senses: { "more than": "more-than" } },
  "compare-decimals-hundredths": { noLink: ["changes"] },
  "compare-decimals-thousandths": { noLink: ["changes"] },
  "compare-fractions": { senses: { multiple: "multiple", rename: "rename" } },
  "compare-irrational-values": {
    senses: { root: "root-radical", square: "square-number" },
  },
  "compare-like-denominators": { senses: { "more than": "more-than" } },
  "compare-like-numerators": { senses: { "more than": "more-than" } },
  "compare-three-digit": { noLink: ["change"] },
  "compare-two-digit": { noLink: ["change"] },
  "compare-unlike-fractions": { senses: { "more than": "more-than" } },
  "compatible-number-estimate": {
    senses: { multiple: "multiple", multiples: "multiple" },
  },
  "compound-event-simulation": {
    senses: { event: "event", trial: "trial", trials: "trial" },
  },
  "continue-count-to-120": {
    senses: { "more than": "more-than" },
    noLink: ["changes"],
  },
  "coordinate-context-points": { senses: { "more than": "more-than" } },
  "count-sequence-missing": { senses: { "more than": "more-than" } },
  "customary-unit-reverse": { noLink: ["whole"] },
  "decimal-grid-read": { senses: { part: "part", whole: "whole" } },
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
  "equivalent-denominator": { senses: { whole: "whole" } },
  "equivalent-fractions-select": { noLink: ["changes", "part", "parts"] },
  "equivalent-numerator": { senses: { whole: "whole" } },
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
  "fraction-choice-compare": {
    senses: { "more than": "more-than", multiple: "multiple" },
    noLink: ["part", "parts", "whole"],
  },
  "fraction-division-expression": {
    senses: { parts: "part", unit: "unit" },
    noLink: ["whole"],
  },
  "fraction-group-count": { noLink: ["part"] },
  "fraction-line-names-select": { senses: { part: "part", parts: "part" } },
  "fraction-line-position": { senses: { whole: "whole" } },
  "fraction-model": {
    senses: { part: "part", parts: "part", whole: "whole" },
    noLink: ["mean"],
  },
  "fraction-share-amount": { senses: { part: "part" } },
  "fraction-total-minus-parts": { senses: { parts: "part" } },
  "fraction-unit-count": { senses: { whole: "whole" } },
  "fraction-whole-as-parts": { senses: { whole: "whole" } },
  "full-kits": { noLink: ["leaves"] },
  "gcf-factor-sum": { senses: { factor: "factor-number" } },
  "greater-numeral": { noLink: ["faces", "side"] },
  "greatest-common-factor": {
    senses: { factor: "factor-number", factors: "factor-number" },
  },
  "hundred-chart-missing": { noLink: ["square"] },
  "hundreds-model": {
    senses: { parts: "part", square: "square-shape", squares: "square-shape" },
    noLink: ["model"],
  },
  "improper-fractional-part": { senses: { whole: "whole", wholes: "whole" } },
  "improper-whole-part": { senses: { whole: "whole", wholes: "whole" } },
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
  "least-common-multiple": {
    senses: { multiple: "multiple", multiples: "multiple" },
  },
  "like-fraction-difference": { senses: { whole: "whole" } },
  "like-fraction-missing-part": { senses: { part: "part" } },
  "line-slope": { senses: { change: "change" }, noLink: ["changes"] },
  "linear-equation": { senses: { sides: "side-of-equation" } },
  "make-hundred": {
    senses: { jump: "jump", jumps: "jump" },
    noLink: ["whole"],
  },
  "make-ten-remainder": { senses: { part: "part" } },
  "mean-data": { senses: { mean: "mean-average" } },
  "measurable-attribute-choice": { noLink: ["key"] },
  "mental-ten-hundred": { noLink: ["changes", "leaves"] },
  "mixed-fraction-difference": {
    senses: { difference: "difference-subtract", whole: "whole" },
    noLink: ["parts"],
  },
  "mixed-to-improper-numerator": {
    senses: { whole: "whole", wholes: "whole" },
  },
  "multidigit-decimal-quotient": { noLink: ["whole"] },
  "multidigit-decimal-sum": { noLink: ["changes"] },
  "multiply-by-one-digit": { senses: { part: "part", parts: "part" } },
  "multiply-facts": {
    senses: { factors: "factor-number" },
    noLink: ["change", "whole"],
  },
  "multiply-fractions": {
    senses: { part: "part", parts: "part", whole: "whole" },
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
  "operation-order": { noLink: ["rule"] },
  "operation-property-identify": {
    senses: { part: "part" },
    noLink: ["change", "opposite", "rule"],
  },
  "operation-sentence-choice": { noLink: ["jump", "jumps"] },
  "pairing-leftover": { noLink: ["leaves"] },
  "pattern-pair-relationship": {
    senses: {
      difference: "difference-subtract",
      factor: "factor-number",
      term: "term-sequence",
      terms: "term-sequence",
    },
  },
  "percent-applications": { noLink: ["base"] },
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
  "power-of-power-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
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
  "prime-composite-sort": { senses: { factors: "factor-number" } },
  "prime-factorization-exponents": {
    senses: {
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "prime-factorization-value": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
      product: "product-multiply",
    },
  },
  "product-of-powers-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
  },
  "purchase-change": { noLink: ["more than"] },
  "quotient-of-powers-exponent": {
    senses: {
      base: "base-exponent",
      factor: "factor-number",
      factors: "factor-number",
    },
    noLink: ["rule"],
  },
  "rectangle-area": { senses: { squares: "square-shape" } },
  "related-division-sentence": { senses: { side: "side-of-equation" } },
  "related-subtraction": { senses: { jumps: "jump" } },
  "related-subtraction-sentence": {
    senses: { part: "part", whole: "whole" },
    noLink: ["leaves"],
  },
  "repeating-decimal-to-fraction": { noLink: ["tail", "whole"] },
  "right-triangle": { senses: { side: "side", sides: "side" } },
  "root-between-integers": { senses: { factor: "factor-number" } },
  "root-nearest-tenth": { senses: { squaring: "square-number" } },
  "round-large": { noLink: ["rule"] },
  "round-to-hundred": { noLink: ["changes", "rule"] },
  "round-to-ten": { noLink: ["changes", "rule"] },
  "same-share-different-shape": {
    senses: { part: "part", parts: "part", squares: "square-shape" },
  },
  "scale-drawing-work": { senses: { unit: "unit" } },
  "scientific-notation-work": { senses: { average: "mean-average" } },
  "scientific-operations": {
    senses: { factors: "factor-number", product: "product-multiply" },
    noLink: ["change", "part"],
  },
  "scientific-times-larger": { senses: { factors: "factor-number" } },
  "scientific-to-standard": {
    senses: { "standard form": "standard-form-number" },
  },
  "share-remainder-fractions": { senses: { part: "part", parts: "part" } },
  "show-work-rental-plans": { senses: { sides: "side-of-equation" } },
  "signed-changes-sum": { senses: { changes: "change" } },
  "signed-fraction-product": { senses: { factor: "factor-number" } },
  "signed-fraction-sum": {
    senses: { factor: "factor-number", rename: "rename" },
  },
  "signed-quantity": { noLink: ["opposite"] },
  "skip-count-missing": { senses: { "more than": "more-than" } },
  "small-array-total": { senses: { squares: "square-shape" } },
  "solve-square-cube-equation": {
    senses: { factor: "factor-number", squaring: "square-number" },
  },
  "story-graph-match": {
    senses: { decreasing: "decreasing", increasing: "increasing" },
    noLink: ["changes", "part"],
  },
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
  "tenths-as-hundredths": { senses: { parts: "part", rename: "rename" } },
  "three-addend-story": { noLink: ["third"] },
  "three-digit-symbol": { noLink: ["change", "faces", "side"] },
  "times-table-pattern": { senses: { product: "product-multiply" } },
  "triangle-uniqueness": { senses: { "more than": "more-than" } },
  "two-digit-symbol": { noLink: ["change", "faces", "side"] },
  "two-step-change": { senses: { changes: "change" } },
  "unit-fraction-share": { senses: { part: "part", parts: "part" } },
  "unit-piece-size": {
    senses: { part: "part", whole: "whole" },
    noLink: ["mean"],
  },
  "unit-size-and-count": { senses: { unit: "unit", units: "unit" } },
  "unknown-addend-story": {
    senses: { part: "part", parts: "part", whole: "whole" },
  },
  "unlike-fraction-difference": {
    senses: { multiple: "multiple" },
    noLink: ["leaves"],
  },
  "whole-number-equality-choice": { senses: { sides: "side-of-equation" } },
  "whole-sharing-fraction": { senses: { part: "part", parts: "part" } },
};
