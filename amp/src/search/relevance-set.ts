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

/**
 * Skill queries: what a learner types into Pathways or Inventory to find a
 * skill. `skills` lists every catalog skill a good answer may show, written
 * from the catalog's own titles, descriptions and strands (the reasoning
 * strand's proofs and justifications for "logic"; every fractions-strand
 * skill for a misspelled "fractions"). Scored on the Skills group: a hit
 * is a listed skill among its first three, and precision is the share of
 * its first five that are listed (a wrong skill shown counts against it).
 */
export type SkillRelevanceCase = { query: string; skills: readonly string[] };

const reasoning = [
  "geometric-proof",
  "line-angle-proofs",
  "triangle-proofs",
  "parallelogram-proofs",
  "measurement-formula-proofs",
  "slope-proofs",
  "similarity-theorems",
  "similarity-proofs",
  "congruence-criteria",
  "coordinate-proofs",
  "circle-similarity",
  "triangle-law-proofs",
  "cavalieri-principle",
  "equation-reasoning",
  "elimination-proof",
  "polynomial-identities",
  "number-system-closure",
  "matrix-properties",
];
const fractions = [
  "halves-and-quarters",
  "thirds-and-partitions",
  "unit-fractions",
  "fraction-model",
  "fractions-number-line",
  "equivalent-fractions",
  "compare-fractions",
  "partition-area",
  "fraction-equivalence",
  "fraction-comparison",
  "like-fraction-addition",
  "mixed-numbers",
  "fraction-times-whole",
  "fraction-addition",
  "fraction-as-division",
  "fraction-multiplication",
  "unit-fraction-division",
  "fraction-division",
  "complex-fractions",
  "fraction-line-plots",
  "decimal-fractions",
];
const geometry = [
  "name-shapes",
  "compose-shapes",
  "shape-attributes",
  "polygon-properties",
  "rectangle-area",
  "perimeter",
  "quadrilateral-categories",
  "area-perimeter-models",
  "angle-measure",
  "lines-symmetry",
  "coordinate-first-quadrant",
  "volume-cubes",
  "prism-volume",
  "shape-hierarchy",
  "coordinate-four-quadrants",
  "triangle-area",
  "fractional-prism-volume",
  "coordinate-polygons",
  "surface-area",
  "scale-drawings",
  "triangle-construction",
  "solid-cross-sections",
  "circle-measurement",
  "angle-relationships",
  "composite-measurement",
  "rigid-motions",
  "dilations-similarity",
  "triangle-angle-theorems",
  "pythagorean-theorem",
  "coordinate-distance",
  "curved-solid-volume",
  "geometric-definitions",
  "geometric-proof",
  "congruence-criteria",
  "similarity-proofs",
  "geometric-constructions",
  "circle-theorems",
  "arc-sector-measure",
  "circle-equations",
  "coordinate-proofs",
  "conic-sections",
  "triangle-circles",
  "tangent-construction",
  "transformation-invariants",
  "polygon-symmetries",
  "transformation-constructions",
  "inscribed-polygons",
  "sections-and-revolutions",
  "parabola-locus",
  "segment-division",
  "coordinate-measurement",
  "dilation-properties",
  "build-and-draw-shapes",
  "composite-shapes",
  "area-by-counting-squares",
  "rigid-motion-properties",
  "line-angle-proofs",
  "triangle-proofs",
  "parallelogram-proofs",
  "right-triangle-trigonometry",
];

export const skillRelevanceSet: readonly SkillRelevanceCase[] = [
  { query: "logic", skills: reasoning },
  {
    query: "reasoning",
    skills: [...reasoning, "statistical-report-critique", "causal-claims"],
  },
  { query: "proof", skills: reasoning },
  {
    query: "fractions of a set",
    skills: ["fraction-times-whole", "fraction-multiplication"],
  },
  {
    query: "area of a triangle",
    skills: ["triangle-area", "trigonometric-area", "composite-measurement"],
  },
  {
    query: "money",
    skills: [
      "money-values",
      "decimal-money-operations",
      "financial-literacy-elementary",
      "financial-literacy-middle",
    ],
  },
  {
    query: "time",
    skills: ["clock-half-hours", "clock-five-minutes", "elapsed-time"],
  },
  {
    query: "graphs",
    skills: [
      "picture-bar-graphs",
      "scaled-graphs",
      "frequency-bar-graphs",
      "coordinate-first-quadrant",
      "coordinate-four-quadrants",
      "dependent-variables",
      "slope",
      "compare-functions",
      "qualitative-graphs",
      "quadratic-graphs",
      "trigonometric-graphs",
      "polynomial-zeros",
      "graph-solution-sets",
      "graphical-equation-solving",
      "inequality-regions",
      "average-rate-change",
      "function-transformations",
      "fraction-line-plots",
    ],
  },
  {
    query: "equations",
    skills: [
      "equality",
      "missing-addend",
      "multiplication-division-equality",
      "whole-number-equality",
      "one-step-equations",
      "two-step-equations",
      "absolute-value-equations",
      "linear-equations",
      "linear-systems",
      "linear-equation-modeling",
      "systems-modeling",
      "quadratic-equations",
      "circle-equations",
      "square-root-equations",
      "radical-equations",
      "rational-equation-one-denominator",
      "rational-equations",
      "exponential-equations",
      "trigonometric-equations",
      "equation-reasoning",
      "symbolic-linear-constraints",
      "matrix-systems",
      "graph-solution-sets",
      "addition-stories",
    ],
  },
  {
    query: "negative numbers",
    skills: [
      "signed-numbers",
      "absolute-value",
      "signed-addition",
      "signed-multiplication",
      "coordinate-four-quadrants",
      "rational-stories",
      "signed-data-summaries",
    ],
  },
  { query: "fracions", skills: fractions },
  { query: "geometery", skills: geometry },
];
