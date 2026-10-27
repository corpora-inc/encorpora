import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 7 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade7 = defineLedger(
  {
    id: "staar-2024-7",
    test: "STAAR Grade 7 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-7-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "0e5048a13ab6534fbc5f714a5d845f63b18ffa19a53dce7185d2fe59e44d5b02",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-7-math-answer-key.pdf",
        sha256:
          "ce1b7edd33bac2264adc95a9d71985314b69811054b31e67d1f9b894df1fefb5",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:staar-2024-first-pass",
    labeledAt: "2026-10-26",
    section: "Test form",
  },
  [
    {
      item: { number: "1", page: "rationale PDF p.1" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.5.C"],
      archetypeIds: ["ratio.proportion", "measure.scale"],
      demand:
        "Find the inches across a map of Texas from a scale of one inch to twenty-five miles",
      status: "covered",
      templateIds: ["ratio-missing", "scale-drawing"],
      limitations:
        "ratio-missing scales a ratio to find a missing quantity by entry; the choices are plain numbers.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.A"],
      archetypeIds: ["number.rational-operations"],
      demand: "Subtract two fifths from forty-five hundredths",
      status: "partial",
      templateIds: [
        "staar-decimal-operations",
        "signed-fraction-sum",
        "multidigit-decimal-sum",
      ],
      limitations:
        "staar-decimal-operations and multidigit-decimal-sum work with decimals and signed-fraction-sum with two fractions; renaming a fraction as a decimal to subtract from a decimal is not practiced.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.1.2.A"],
      archetypeIds: ["number.number-classification"],
      demand:
        "Drag set names into a diagram showing natural, whole, integer and rational numbers",
      status: "partial",
      templateIds: ["staar-number-sets"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. staar-number-sets places a number among nested sets by choice; labeling the nested sets by drag and drop has no multi-part family.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume of a pyramid with a triangular base from its base area and height",
      status: "partial",
      templateIds: ["solid-volume-context", "prism-volume-edges"],
      limitations:
        "solid-volume-context uses pyramid volumes with a base given; a base that is itself a triangle to be measured is not practiced.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.B"],
      archetypeIds: [
        "number.rational-operations",
        "fractions.add-subtract-unlike",
      ],
      demand:
        "Find the milk left after four days of uses written as sixteenths, eighths and fourths",
      status: "partial",
      templateIds: ["signed-fraction-sum", "add-fractions"],
      limitations:
        "signed-fraction-sum adds two fractions; a four-term sum with three denominators and a final subtraction is not practiced.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.1.6.H"],
      archetypeIds: [
        "data.frequency-table-read",
        "whole.multiplicative-comparison",
      ],
      demand:
        "Drag book types into a statement about which type is more than twice as likely as another",
      status: "covered",
      templateIds: ["times-as-many-blanks", "comparison-factor"],
      limitations:
        "times-as-many-blanks completes a times-as-many sentence or a more-than-twice-as-likely sentence from a table of three counts. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.11.C"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Write and solve an equation for a triangle whose angles are given in terms of x",
      status: "covered",
      templateIds: ["triangle-angle-sum"],
      limitations:
        "triangle-angle-sum uses the angle sum with an unknown or expression; the choices are plain numbers.",
    },
    {
      item: { number: "8", page: "rationale PDF p.8" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.C"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Find the constant of proportionality from a distance in feet after six minutes",
      status: "covered",
      templateIds: ["variation-constant"],
      limitations:
        "variation-constant finds the constant of direct variation by choice.",
    },
    {
      item: { number: "9", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.4.E"],
      archetypeIds: ["ratio.units"],
      demand:
        "Find the meters closest to a fifteen-foot height when one meter is about 3.28 feet",
      status: "partial",
      templateIds: ["ratio-missing", "metric-length-rename"],
      limitations:
        "ratio-missing scales with whole ratios and metric-length-rename converts whole counts of metric units; a decimal conversion factor between systems is not practiced.",
    },
    {
      item: { number: "10", page: "rationale PDF p.10" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.2.11.A"],
      archetypeIds: ["inequality.solve"],
      demand:
        "Drag the solution to each of two inequalities with a negative coefficient",
      status: "covered",
      templateIds: ["inequality-solution-blanks", "affine-linear-inequality"],
      limitations:
        "inequality-solution-blanks chooses the solution of each of two inequalities with a negative coefficient. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "11", page: "rationale PDF p.11" },
      responseFormat: "choice",
      standards: ["TEKS.7.4.6.G"],
      archetypeIds: ["percent.of"],
      demand:
        "Find how many more commuters drive than bike from percents in a circle graph of one hundred fifty people",
      status: "covered",
      templateIds: [
        "percent-of",
        "share-remainder-percent",
        "circle-graph-read",
      ],
      limitations:
        "circle-graph-read (display: drawn-graph) reads percents from a drawn circle graph and finds how many more are in one sector than another; share-remainder-percent (difference-of-shares) covers totals up to 500 such as this item's 150.",
      labeledBy: "agent:scene-components",
      labeledAt: "2026-10-27",
    },
    {
      item: { number: "12", page: "rationale PDF p.12" },
      responseFormat: "numeric",
      standards: ["TEKS.7.3.9.C"],
      archetypeIds: ["measure.area"],
      demand: "Find the area of a tabletop split into two congruent trapezoids",
      status: "covered",
      templateIds: ["polygon-area-decompose"],
      limitations:
        "STAAR interaction: equation editor. polygon-area-decompose finds the area of a trapezoid by splitting it into rectangles and triangles with numeric entry.",
    },
    {
      item: { number: "13", page: "rationale PDF p.13" },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.I"],
      archetypeIds: ["probability.compound-event"],
      demand:
        "Find the probability that one spinner lands on two and another on blue",
      status: "covered",
      templateIds: [
        "compound-event-simulation",
        "staar-experiment-probability",
      ],
      limitations:
        "compound-event-simulation finds a probability of independent outcomes from two spinners by choice.",
    },
    {
      item: { number: "14", page: "rationale PDF p.14" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.B"],
      archetypeIds: ["measure.circle"],
      demand:
        "Find the radius of a circle from its area of about 28.26 square centimeters",
      status: "partial",
      templateIds: ["circle-area-coefficient"],
      limitations:
        "circle-area-coefficient finds an exact area from a radius or diameter; recovering the radius from an area with 3.14 is not practiced.",
    },
    {
      item: { number: "15", page: "rationale PDF p.15" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.7.A"],
      archetypeIds: ["pattern.graph-relationship"],
      demand: "Choose the graph of a line where y is three more than half of x",
      status: "partial",
      templateIds: ["graph-linear-equation"],
      limitations:
        "graph-linear-equation places points of a line and is point-plot only; choosing among four drawn graphs has no choice family for a rule with a fraction coefficient.",
    },
    {
      item: { number: "16", page: "rationale PDF p.16" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.A"],
      archetypeIds: ["pattern.graph-relationship"],
      demand: "Choose the graph of a cost of twelve cents per kilowatt-hour",
      status: "partial",
      templateIds: ["graph-linear-equation", "graph-of-proportional-rate"],
      limitations:
        "graph-of-proportional-rate chooses among drawn graphs for a stated rate on unit and scaled vertical axes, but its contexts and rates do not include a price in cents per kilowatt-hour such as 12.",
    },
    {
      item: { number: "17", page: "rationale PDF p.17" },
      responseFormat: "choice",
      standards: ["TEKS.7.4.12.A"],
      archetypeIds: ["univariate.compare-distributions"],
      demand:
        "Choose the statement supported by two box plots of spending, comparing interquartile ranges",
      status: "partial",
      templateIds: ["compare-distributions-choice", "skewed-box-compare"],
      limitations:
        "compare-distributions-choice compares medians and interquartile ranges and skewed-box-compare shapes and ranges; the statements here combine measures drawn from two box plots.",
    },
    {
      item: { number: "18", page: "rationale PDF p.18" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.2.7.A"],
      archetypeIds: ["function.representations"],
      demand:
        "Mark the table, equation and graph that show four miles per hour with a starting two miles",
      status: "partial",
      templateIds: ["proportional-rule-choice", "graph-equation-choice"],
      limitations:
        "STAAR interaction: hot spot. proportional-rule-choice and graph-equation-choice match one representation by choice; selecting every matching representation by hot spot has no response protocol.",
    },
    {
      item: { number: "19", page: "rationale PDF p.19" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.5.C"],
      archetypeIds: ["triangle.relationships", "measure.scale"],
      demand: "Find a side of one triangle from a similar triangle",
      status: "covered",
      templateIds: ["similar-triangles-side"],
      limitations:
        "similar-triangles-side finds a missing side of a similar triangle with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "20", page: "rationale PDF p.20" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.D"],
      archetypeIds: ["percent.change", "percent.of"],
      demand: "Find the grocery cost after a twenty-five percent coupon",
      status: "covered",
      templateIds: ["percent-applications", "percent-change-final"],
      limitations:
        "percent-applications and percent-change-final apply one exact markdown or percent change; the choices are plain numbers.",
    },
    {
      item: { number: "21", page: "rationale PDF p.21" },
      responseFormat: "multi-select",
      standards: ["TEKS.7.4.6.G"],
      archetypeIds: ["univariate.displays"],
      demand: "Select the statements a dot plot of thirty game turns supports",
      status: "partial",
      templateIds: ["dot-plot-mean", "line-plot-whole"],
      limitations:
        "STAAR interaction: multiselect, 2 points. dot-plot-mean and line-plot-whole read counts and the mean from a dot plot; no family judges statements about shares of the data or takes a multi-select.",
    },
    {
      item: { number: "22", page: "rationale PDF p.22" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.10.A"],
      archetypeIds: ["linear.context"],
      demand:
        "Choose the equation that finds the games a fifty-dollar card buys with a five-dollar coupon",
      status: "covered",
      templateIds: ["two-step-equation-model"],
      limitations:
        "two-step-equation-model chooses the two-step equation that distinguishes a rate from a fixed amount.",
    },
    {
      item: { number: "23", page: "rationale PDF p.23" },
      responseFormat: "choice",
      standards: ["TEKS.7.4.13.C"],
      archetypeIds: ["finance.net-worth"],
      demand:
        "Find a savings account balance from a net worth and a list of assets and liabilities",
      status: "missing",
      templateIds: [],
      limitations: "No family practices assets, liabilities or net worth.",
    },
    {
      item: { number: "24", page: "rationale PDF p.24" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.B"],
      archetypeIds: ["fractions.multiply-whole"],
      demand:
        "Find the snow days from the whole-number fractions of ninety days that are sunny and rainy",
      status: "covered",
      templateIds: [
        "fraction-of-quantity",
        "staar-multistep-stories",
        "share-remainder-fractions",
      ],
      limitations:
        "share-remainder-fractions (remaining-part) takes two whole-number fractions of a whole up to 120 and subtracts both parts from the whole; choices are plain numbers, so numeric entry fits.",
    },
    {
      item: { number: "25", page: "rationale PDF p.25" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.B"],
      archetypeIds: ["measure.circle"],
      demand: "Find the area of the circular lawn a sprinkler waters",
      status: "partial",
      templateIds: ["circle-area-coefficient"],
      limitations:
        "circle-area-coefficient with pi-form=pi-3-14 practices this task (a whole radius or even diameter, pi as 3.14, a decimal area); the row stays partial only because the template's archetype link in the frozen template-archetypes list is circle.parts, not measure.circle.",
    },
    {
      item: { number: "26", page: "rationale PDF p.26" },
      responseFormat: "other",
      standards: ["TEKS.7.2.4.B"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Complete two statements giving the pages per minute printed in black and white and in color",
      status: "covered",
      templateIds: ["unit-rate-pair-blanks", "unit-rate", "fraction-unit-rate"],
      limitations:
        "unit-rate-pair-blanks chooses two decimal unit rates from two totals and two times. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "27", page: "rationale PDF p.27" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.D"],
      archetypeIds: ["measure.surface"],
      demand: "Find the surface area of a rectangular prism from its net",
      status: "covered",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area adds the face areas of a prism net with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "28", page: "rationale PDF p.28" },
      responseFormat: "other",
      standards: ["TEKS.7.2.11.B"],
      archetypeIds: ["equation.truth", "linear.solve"],
      demand:
        "Mark each of several equations true or not true when m is negative five",
      status: "covered",
      templateIds: ["check-equation-candidate", "substitution-match-table"],
      limitations:
        "substitution-match-table (multi-part-choice-v1, match table): mark each of four or five equations true or not true for a stated negative or positive integer value.",
    },
    {
      item: { number: "29", page: "rationale PDF p.29" },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.H"],
      archetypeIds: ["probability.direct"],
      demand:
        "Choose the true statement comparing how many students prefer dogs with all other pets",
      status: "partial",
      templateIds: ["simple-probability"],
      limitations:
        "simple-probability finds a probability from equally likely objects by entry; comparing a category's share with the combined others from a table is not practiced.",
    },
    {
      item: { number: "30", page: "rationale PDF p.30" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.2.4.A"],
      archetypeIds: ["line.graph-equation"],
      demand:
        "Plot two points on the line for cups of nuts per cup of fruit at a rate of three halves",
      status: "covered",
      templateIds: ["graph-linear-equation"],
      limitations:
        "STAAR interaction: graphing. graph-linear-equation graphs a proportional relationship through the origin by placing two points.",
    },
    {
      item: { number: "31", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.I"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the experimental probability of drawing red or orange from a table of results",
      status: "covered",
      templateIds: ["staar-experiment-probability"],
      limitations:
        "staar-experiment-probability finds the experimental probability of one of two outcomes from a frequency table.",
    },
    {
      item: { number: "32", page: "rationale PDF p.32" },
      responseFormat: "choice",
      standards: ["TEKS.7.4.12.A"],
      archetypeIds: ["univariate.compare-distributions", "univariate.shape"],
      demand:
        "Choose the statement supported by two dot plots about symmetry and spread",
      status: "partial",
      templateIds: ["compare-distributions-choice", "skewed-box-compare"],
      limitations:
        "compare-distributions-choice and skewed-box-compare compare box plots; judging symmetry of dot plots is not practiced.",
    },
    {
      item: { number: "33", page: "rationale PDF p.33" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.5.B"],
      archetypeIds: ["measure.circle"],
      demand:
        "Choose the expression that gives pi from a circle with radius ten inches and its circumference",
      status: "partial",
      templateIds: ["circle-circumference-coefficient"],
      limitations:
        "circle-circumference-coefficient finds a circumference from a radius or diameter; writing pi as a ratio of circumference to diameter is not practiced.",
    },
    {
      item: { number: "34", page: "rationale PDF p.34" },
      responseFormat: "choice",
      standards: ["TEKS.7.2.11.A"],
      archetypeIds: ["linear.solve"],
      demand:
        "Solve an equation with a half-coefficient variable term and constants to combine",
      status: "partial",
      templateIds: ["staar-multistep-equations", "combine-like-coefficient"],
      limitations:
        "staar-multistep-equations and combine-like-coefficient solve with integer coefficients or combine only the coefficient; a fractional coefficient with constants on one side is not practiced.",
    },
    {
      item: { number: "35", page: "rationale PDF p.35" },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.4.12.C"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Drag the subjects best supported by a comparative bar graph of two grades",
      status: "partial",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. scaled-bar-graph reads a single bar graph by entry; inferences from two bar graphs side by side have no family.",
    },
    {
      item: { number: "36", page: "rationale PDF p.36" },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.C"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the area of a barn's side wall made of a rectangle and a trapezoid",
      status: "covered",
      templateIds: ["polygon-area-decompose", "composite-area"],
      limitations:
        "polygon-area-decompose and composite-area find areas of figures split into rectangles, triangles and trapezoids with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "37", page: "rationale PDF p.37" },
      responseFormat: "other",
      standards: ["TEKS.7.2.4.D"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Complete two blanks with the blue gumballs from twenty-four yellow at a ratio of four to three and a related count",
      status: "covered",
      templateIds: ["ratio-pair-blanks", "ratio-missing"],
      limitations:
        "ratio-pair-blanks chooses the count of the other color and the total from a ratio and one count. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "38", page: "rationale PDF p.38" },
      responseFormat: "choice",
      standards: ["TEKS.7.4.12.B"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Choose the prediction supported by a dot plot of sandwich orders",
      status: "partial",
      templateIds: ["line-plot-whole"],
      limitations:
        "line-plot-whole reads counts from a dot plot; comparing totals of two groups of values to support a prediction is not practiced.",
    },
  ],
);
