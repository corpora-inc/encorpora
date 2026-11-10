/**
 * A fixed relevance set: queries people type, each with the documents a
 * good search shows in its top three (any one of them is a hit). Written
 * from the catalog, not from any engine's output. (After the first run, four
 * correct documents missed when writing it were added: the multiplication
 * table patterns lesson, "Exchange to subtract", and two comparison
 * lessons. No other expectation was changed.) `semantic` marks queries
 * that share no useful word with their answers; only the vector half is
 * expected to find those.
 */
export type RelevanceCase = {
  query: string;
  expect: readonly string[];
  semantic?: true;
};

export const relevanceSet: readonly RelevanceCase[] = [
  // The founder's query, typed partway.
  {
    query: "numbers and",
    expect: [
      "lesson:signed-numbers",
      "lesson:mcas-number-forms-select",
      "lesson:staar-number-sets",
    ],
  },
  {
    query: "times tables",
    expect: [
      "type:multiply-facts",
      "skill:multiplication-facts",
      "lesson:multiplication",
      "lesson:times-table-patterns",
    ],
  },
  {
    query: "take away",
    expect: [
      "lesson:subtraction",
      "skill:subtraction-within-10",
      "skill:subtraction-within-20",
      "lesson:k-build-represent-sentences-lesson",
    ],
  },
  {
    query: "pemdas",
    expect: [
      "type:operation-order",
      "term:order-of-operations",
      "type:staar-signed-exponent-order",
    ],
  },
  {
    query: "fractions of a number",
    expect: [
      "lesson:fraction-of-set",
      "type:fraction-of-set",
      "skill:fraction-times-whole",
    ],
  },
  {
    query: "how do I split a pizza fairly",
    expect: [
      "lesson:fractions",
      "lesson:halves-and-quarters",
      "lesson:halves-thirds-and-quarters",
      "skill:halves-and-quarters",
      "skill:thirds-and-partitions",
      "type:same-share-different-shape",
    ],
    semantic: true,
  },
  {
    query: "sharing cookies equally among friends",
    expect: [
      "type:share-whole-items",
      "skill:division-meaning",
      "lesson:division",
      "type:same-share-different-shape",
    ],
    semantic: true,
  },
  {
    query: "hypotenuse",
    expect: [
      "term:hypotenuse",
      "lesson:pythagorean-theorem",
      "lesson:right-triangle-missing-leg",
    ],
  },
  {
    query: "pythagorus",
    expect: [
      "lesson:pythagorean-theorem",
      "skill:pythagorean-theorem",
      "lesson:pythagorean-converse",
    ],
  },
  {
    query: "fractoins",
    expect: [
      "lesson:fractions",
      "skill:fraction-model",
      "skill:unit-fractions",
      "lesson:fraction-addition",
      "lesson:fractions-of-one-whole",
    ],
  },
  {
    query: "slope",
    expect: [
      "term:slope",
      "lesson:inline-linear-features",
      "lesson:staar-lines-from-data",
      "lesson:slope-triangle-statements",
      "lesson:interpret-linear-parameters",
    ],
  },
  {
    query: "long division",
    expect: [
      "lesson:long-division",
      "skill:whole-division",
      "lesson:quotient-remainder-one-digit",
    ],
  },
  {
    query: "telling time",
    expect: [
      "lesson:hours-and-half-hours",
      "lesson:time-to-five-minutes",
      "lesson:clock-minute-match",
      "skill:clock-half-hours",
      "skill:clock-five-minutes",
    ],
  },
  {
    query: "counting money",
    expect: [
      "lesson:coins-and-bills",
      "lesson:coin-name-and-cent-value",
      "skill:money-values",
      "lesson:compare-money-sets",
    ],
  },
  {
    query: "round to the nearest ten",
    expect: ["lesson:rounding", "skill:round-whole-numbers"],
  },
  {
    query: "average",
    expect: [
      "term:mean-average",
      "lesson:mean-median",
      "lesson:measure-meaning-lesson",
    ],
  },
  {
    query: "lcm",
    expect: [
      "lesson:least-common-multiple",
      "type:least-common-multiple",
      "skill:gcf-lcm",
    ],
  },
  {
    query: "gcf",
    expect: [
      "lesson:greatest-common-factor",
      "type:greatest-common-factor",
      "skill:gcf-lcm",
    ],
  },
  {
    query: "sohcahtoa",
    expect: [
      "skill:right-triangle-trigonometry",
      "lesson:regents-geometry-altitude-ratio",
      "lesson:trig-leg-steps",
      "lesson:regents-geometry-calculator-trig",
    ],
  },
  {
    query: "borrowing",
    expect: [
      "lesson:subtract-within-100",
      "type:subtract-two-digit-regroup",
      "lesson:three-digit-regrouping",
      "skill:subtraction-within-100",
      "type:subtract-with-regrouping",
    ],
  },
  {
    query: "percent off",
    expect: [
      "lesson:incentive-compare",
      "type:incentive-compare",
      "skill:percent-change",
      "type:percent-applications",
    ],
  },
  {
    query: "chance of rolling a six",
    expect: [
      "lesson:experimental-probability",
      "term:probability",
      "lesson:combination-probability",
      "lesson:theoretical-distributions",
    ],
    semantic: true,
  },
  {
    query: "4.NF.B.3",
    expect: [
      "lesson:fraction-benchmarks",
      "lesson:fraction-decompositions-select-lesson",
      "lesson:mixed-fraction-sum-lesson",
      "lesson:like-fraction-sum-story-lesson",
      "skill:mixed-numbers",
      "skill:like-fraction-addition",
    ],
  },
  {
    query: "quadratic formula",
    expect: [
      "lesson:quadratic-irrational-solutions",
      "lesson:complex-quadratic-solve",
    ],
  },
  {
    query: "negative numbers",
    expect: [
      "lesson:signed-numbers",
      "lesson:integer-multiply-divide",
      "lesson:signed-context-order",
    ],
  },
  {
    query: "place value",
    expect: [
      "lesson:large-place-value",
      "skill:large-place-value",
      "skill:hundreds-place-value",
      "skill:teen-place-value",
      "lesson:grade4-place-value",
    ],
  },
  {
    query: "area of a rectangle",
    expect: [
      "type:rectangle-area",
      "skill:rectangle-area",
      "film:rectangle-area",
      "lesson:area-tiling-distributive",
      "lesson:grade4-rectangle-measures-lesson",
    ],
  },
  {
    query: "which number is bigger",
    expect: [
      "lesson:compare-numerals",
      "skill:compare-numerals",
      "lesson:compare-by-place",
      "skill:compare-two-digit",
      "skill:compare-three-digit",
      "lesson:compare-symbol-blanks",
      "lesson:true-comparison-statement-lesson",
    ],
  },
  {
    query: "distance between two points",
    expect: ["lesson:coordinate-distance"],
  },
  {
    query: "skip counting",
    expect: ["skill:skip-counting", "type:skip-count-missing"],
  },
  {
    query: "equivalent fractions",
    expect: [
      "term:equivalent-fractions",
      "skill:equivalent-fractions",
      "lesson:equivalent-fractions-select-lesson",
      "skill:fraction-equivalence",
    ],
  },
  {
    query: "adding fractions with the same bottom number",
    expect: [
      "skill:like-fraction-addition",
      "lesson:like-fraction-sum-story-lesson",
      "lesson:fraction-addition",
      "type:add-fractions",
    ],
    semantic: true,
  },
];
