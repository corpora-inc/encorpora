import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 6 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade6 = defineLedger(
  {
    id: "staar-2024-6",
    test: "STAAR Grade 6 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-6-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "a152a33fa1a39e1ea47f5618a34443a0a85a11fa1bfe3c053d3ee5550799072b",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-6-math-answer-key.pdf",
        sha256:
          "7e8daa8bc6f253a8e935da7bcc7b46c6186c8e3c0e6995a7175c3ad82faf6eee",
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
      standards: ["TEKS.6.2.10.B"],
      archetypeIds: ["equation.truth", "linear.solve"],
      demand: "Choose the equation that is true when x is five",
      status: "partial",
      templateIds: ["check-equation-candidate"],
      limitations:
        "check-equation-candidate checks one proposed integer in one equation; testing four equations against a stated value is not practiced.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.12.D"],
      archetypeIds: ["data.frequency-table-read", "univariate.center"],
      demand:
        "Read a tally chart of colors and name the colors that are the mode",
      status: "missing",
      templateIds: [],
      limitations:
        "No family practices reading tally marks or finding the mode of categorical data.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "choice",
      standards: ["TEKS.6.3.11.A"],
      archetypeIds: ["coordinate.plane-point"],
      demand:
        "Choose the ordered pair of a third point that forms a right triangle with two plotted points",
      status: "partial",
      templateIds: ["coordinate-point-reading", "plot-points"],
      limitations:
        "coordinate-point-reading reads one coordinate of a labeled point and plot-points places signed points; reasoning about a vertex that makes a right angle is not practiced.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "other",
      standards: ["TEKS.6.4.12.B"],
      archetypeIds: ["univariate.center", "univariate.shape"],
      demand:
        "Complete statements giving the mean of a dot plot and the shape of its distribution",
      status: "partial",
      templateIds: ["dot-plot-mean"],
      limitations:
        "STAAR interaction: inline choice, 2 points. dot-plot-mean finds the mean of whole-number dot-plot data by entry; naming the shape of the distribution has no family, and the answer is two dropdown blanks.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.10.A"],
      archetypeIds: ["linear.solve"],
      demand: "Solve an equation with the variable on both sides",
      status: "covered",
      templateIds: ["both-sides-linear-equation"],
      limitations:
        "both-sides-linear-equation solves a unique-solution equation with the variable on both sides; the choices are plain numbers.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "choice",
      standards: ["TEKS.6.1.7.D"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Find the expression not equivalent to one half times a difference",
      status: "covered",
      templateIds: ["equivalent-expressions-check"],
      limitations:
        "equivalent-expressions-check with coefficients=fractional-factor asks which expression is not equivalent to a fraction times a binomial, such as one half times a difference.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "choice",
      standards: ["TEKS.6.3.8.D"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the height of a prism from its volume and the area of its base",
      status: "partial",
      templateIds: ["prism-missing-edge", "prism-volume-edges"],
      limitations:
        "prism-missing-edge recovers an edge from the volume and two edges; a given base area with the height unknown is not practiced.",
    },
    {
      item: { number: "8", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.B"],
      archetypeIds: ["rational.order-absolute"],
      demand:
        "Pick the labeled point on a number line with the greatest absolute value",
      status: "partial",
      templateIds: ["signed-context-order", "number-line-distance"],
      limitations:
        "signed-context-order and number-line-distance use absolute value as a size or distance; choosing among labeled points on a number line is not practiced.",
    },
    {
      item: { number: "9", page: "rationale PDF p.10" },
      responseFormat: "choice",
      standards: ["TEKS.6.3.8.A"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Order a triangle's sides from greatest to least using two given angles",
      status: "partial",
      templateIds: ["triangle-angle-sum"],
      limitations:
        "triangle-angle-sum finds the third angle; relating the largest angle to the longest side is not practiced.",
    },
    {
      item: { number: "10", page: "rationale PDF p.12" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.13.B"],
      archetypeIds: ["study.statistical-question"],
      demand: "Pick the situation that yields data with no variability",
      status: "partial",
      templateIds: ["statistical-question-choice"],
      limitations:
        "statistical-question-choice chooses the question that anticipates variability; choosing the situation that does not is not practiced.",
    },
    {
      item: { number: "11", page: "rationale PDF p.13" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.2.5.B"],
      archetypeIds: ["percent.of"],
      demand:
        "Drag values to complete a statement of how many of thirty-five books fall in each of two percent groups",
      status: "covered",
      templateIds: ["percent-amounts-blanks", "percent-of"],
      limitations:
        "percent-amounts-blanks chooses two percents of a whole as counts, or as budget amounts each compared with its limit. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "12", page: "rationale PDF p.14" },
      responseFormat: "choice",
      standards: ["TEKS.6.3.4.H"],
      archetypeIds: ["measure.customary-units"],
      demand:
        "Convert one and a half gallons to cups using the reference chart",
      status: "covered",
      templateIds: ["customary-unit-rename", "conversion-chain-story"],
      limitations:
        "conversion-chain-story (capacity-chart) chains gallons, quarts, pints and cups from a stated chart for a decimal or mixed-number amount; choices are plain numbers, so numeric entry fits.",
    },
    {
      item: { number: "13", page: "rationale PDF p.15" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.1.2.D"],
      archetypeIds: ["rational.order-absolute"],
      demand:
        "Drag signed fractions and decimals into order from least to greatest",
      status: "covered",
      templateIds: [
        "order-rationals-slots",
        "staar-order-mixed-forms",
        "signed-context-order",
      ],
      limitations:
        "order-rationals-slots orders four or five signed decimals and fractions in either direction, with the order of absolute values as the trap. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "14", page: "rationale PDF p.16" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.5.A"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Choose the proportion that finds a model length from a scale of two inches to three feet",
      status: "partial",
      templateIds: ["ratio-missing", "staar-rate-equation-choice"],
      limitations:
        "ratio-missing scales a ratio by entry and staar-rate-equation-choice picks a rate equation; writing the proportion from a scale is not practiced.",
    },
    {
      item: { number: "15", page: "rationale PDF p.18" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.1.7.D"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Mark the two equivalent expressions among several using the commutative property",
      status: "partial",
      templateIds: ["equivalent-expressions-check"],
      limitations:
        "STAAR interaction: hot spot, 1 point. equivalent-expressions-check chooses one equivalent expression by choice; selecting two from a list by hot spot has no response protocol.",
    },
    {
      item: { number: "16", page: "rationale PDF p.19" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.6.C"],
      archetypeIds: ["function.relation-equation"],
      demand: "Choose the equation for a trailer six feet shorter than another",
      status: "covered",
      templateIds: ["dependent-variable-equation"],
      limitations:
        "dependent-variable-equation chooses the equation that expresses one variable in terms of another, including a constant difference.",
    },
    {
      item: { number: "17", page: "rationale PDF p.20" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.4.12.D"],
      archetypeIds: ["data.percent-bar-graph"],
      demand:
        "Drag counts of projects after reading each type's share from a percentage bar graph",
      status: "missing",
      templateIds: [],
      limitations:
        "STAAR interaction: drag and drop, 2 points. No family practices reading a percentage bar graph.",
    },
    {
      item: { number: "18", page: "rationale PDF p.21" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.4.A"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Describe how x and y relate in y equals 3x and y equals 3 plus x",
      status: "partial",
      templateIds: ["pattern-pair-relationship"],
      limitations:
        "pattern-pair-relationship builds paired terms from rules; judging two equations as multiplicative and additive is not practiced.",
    },
    {
      item: { number: "19", page: "rationale PDF p.22" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.12.C"],
      archetypeIds: ["univariate.center", "univariate.spread"],
      demand:
        "Choose the true statement about a six-value data set's mean, median, mode and range",
      status: "partial",
      templateIds: ["mean-data", "median-data", "range-data"],
      limitations:
        "mean-data, median-data and range-data compute one measure by entry; the choices are statements combining several measures.",
    },
    {
      item: { number: "20", page: "rationale PDF p.24" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.2.9.B"],
      archetypeIds: ["inequality.solve", "inequality.number-line"],
      demand:
        "Graph the solution of three times p greater than eighteen with an open circle and an arrow",
      status: "partial",
      templateIds: ["inequality-number-line-choice"],
      limitations:
        "STAAR interaction: number line, 2 points. inequality-number-line-choice chooses the number line for a simple inequality; constructing the circle and arrow on a number line has no response protocol.",
    },
    {
      item: { number: "21", page: "rationale PDF p.25" },
      responseFormat: "choice",
      standards: ["TEKS.6.1.4.G"],
      archetypeIds: ["number.decimal-fraction-equivalent"],
      demand: "Choose the measure equal to 0.05 inch from fractions",
      status: "covered",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal with direction=decimal-to-fraction chooses the fraction in lowest terms equal to a two-place decimal such as 0.05; the measurement setting is not stated.",
    },
    {
      item: { number: "22", page: "rationale PDF p.26" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.D"],
      archetypeIds: ["expression.order-of-operations"],
      demand: "Evaluate a negative thirty plus two times negative seven",
      status: "covered",
      templateIds: ["staar-signed-exponent-order"],
      limitations:
        "staar-signed-exponent-order evaluates integer expressions that mix a negative factor and a sum; the choices are plain numbers.",
    },
    {
      item: { number: "23", page: "rationale PDF p.27" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.14.A"],
      archetypeIds: ["finance.fee-compare"],
      demand:
        "Compare the total fees at two banks from monthly charges and overdraft charges",
      status: "covered",
      templateIds: ["linear-model-value", "fee-plan-chain"],
      limitations:
        "fee-plan-chain (compare-plans) totals each plan's monthly charges and per-event charges and finds how much more one costs; choices are plain amounts, so numeric entry fits.",
    },
    {
      item: { number: "24", page: "rationale PDF p.29" },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.A"],
      archetypeIds: ["number.number-classification"],
      demand:
        "Choose the Venn diagram that places listed numbers among rationals, integers and whole numbers",
      status: "partial",
      templateIds: ["staar-number-sets"],
      limitations:
        "staar-number-sets places numbers among nested sets described in words by choice; the drawn Venn diagram options are not shown.",
    },
    {
      item: { number: "25", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.13.A"],
      archetypeIds: ["data.stem-leaf-read"],
      demand:
        "Choose the true statement about the range and mode of a stem-and-leaf plot of volunteer ages",
      status: "partial",
      templateIds: ["stem-leaf-read"],
      limitations:
        "stem-leaf-read reads one extreme, range or mode from a plot with numeric choices; the choices here are statements combining measures.",
    },
    {
      item: { number: "26", page: "rationale PDF p.32" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.5.B"],
      archetypeIds: ["percent.of"],
      demand: "Find forty percent of five hundred trees",
      status: "covered",
      templateIds: ["percent-of"],
      limitations:
        "percent-of finds an exact percentage of a whole-number quantity; the choices are plain numbers.",
    },
    {
      item: { number: "27", page: "rationale PDF p.33" },
      responseFormat: "multi-select",
      standards: ["TEKS.6.1.4.C"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Select the volunteer groups that keep a ratio of five students to two adults",
      status: "partial",
      templateIds: ["ratio-missing", "ratio-table-missing"],
      limitations:
        "STAAR interaction: multiselect, 2 points. ratio-missing and ratio-table-missing scale a ratio by entry; no family takes a multi-select of equivalent ratios.",
    },
    {
      item: { number: "28", page: "rationale PDF p.35" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.6.B"],
      archetypeIds: ["function.relation-equation"],
      demand: "Choose the equation for figs as twice the pears",
      status: "covered",
      templateIds: ["dependent-variable-equation"],
      limitations:
        "dependent-variable-equation chooses the equation that expresses a dependent variable in a multiplicative relationship.",
    },
    {
      item: { number: "29", page: "rationale PDF p.36" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.3.11.A"],
      archetypeIds: ["coordinate.four-quadrant"],
      demand: "Plot the endpoints of a vertical segment in two quadrants",
      status: "covered",
      templateIds: ["plot-points"],
      limitations:
        "STAAR interaction: graphing, 2 points. plot-points places signed coordinate pairs on a four-quadrant grid; the item asks for two endpoints.",
    },
    {
      item: { number: "30", page: "rationale PDF p.37" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.9.A"],
      archetypeIds: ["linear.context"],
      demand: "Choose the equation for people on a bus after four get off",
      status: "covered",
      templateIds: ["one-step-equation-story"],
      limitations:
        "one-step-equation-story chooses the one-step equation that represents a story.",
    },
    {
      item: { number: "31", page: "rationale PDF p.38" },
      responseFormat: "choice",
      standards: ["TEKS.6.1.7.D"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Choose the pair of equivalent expressions after combining like terms and removing a fractional coefficient",
      status: "partial",
      templateIds: ["equivalent-expressions-check"],
      limitations:
        "equivalent-expressions-check tests equivalence with integer coefficients; a pair involving a fractional coefficient is not practiced.",
    },
    {
      item: { number: "32", page: "rationale PDF p.39" },
      responseFormat: "numeric",
      standards: ["TEKS.6.3.8.D"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume of a prism with a decimal base edge and a height of one",
      status: "partial",
      templateIds: ["prism-volume-edges"],
      limitations:
        "STAAR interaction: equation editor, 1 point. prism-volume-edges multiplies whole-number edges; a decimal edge is outside its range.",
    },
    {
      item: { number: "33", page: "rationale PDF p.40" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.4.B"],
      archetypeIds: ["ratio.part-whole"],
      demand:
        "Find the math books on a shelf from a science-to-math ratio of four to three",
      status: "covered",
      templateIds: ["ratio-missing", "staar-ratio-statements"],
      limitations:
        "ratio-missing scales a ratio to find a missing quantity by entry; the choices are plain numbers.",
    },
    {
      item: { number: "34", page: "rationale PDF p.41" },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.1.4.G"],
      archetypeIds: ["number.percent-fraction-decimal"],
      demand: "Drag the decimal and the percent equal to three eighths",
      status: "covered",
      templateIds: [
        "fraction-forms-blanks",
        "staar-rename-percent-fraction-decimal",
      ],
      limitations:
        "fraction-forms-blanks writes a fraction as a decimal and as a percent. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "35", page: "rationale PDF p.42" },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.E"],
      archetypeIds: ["decimal.divide"],
      demand: "Divide 31.5 ounces among students at 1.5 ounces each",
      status: "covered",
      templateIds: ["multidigit-decimal-quotient"],
      limitations:
        "multidigit-decimal-quotient divides a decimal by a decimal with a terminating quotient; the choices are plain numbers.",
    },
    {
      item: { number: "36", page: "rationale PDF p.43" },
      responseFormat: "choice",
      standards: ["TEKS.6.4.14.G"],
      archetypeIds: ["finance.credit-concept"],
      demand:
        "Name the kind of government financial aid that is a loan to be repaid with interest",
      status: "missing",
      templateIds: [],
      limitations:
        "No family practices the types of financial aid or student loans.",
    },
  ],
);
