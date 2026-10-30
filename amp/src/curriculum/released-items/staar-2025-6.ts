import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 6 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade6 = defineLedger(
  {
    id: "staar-2025-6",
    test: "STAAR Grade 6 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-6-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "b1f12662b3fee9e204d3a5953ce366f0fb383ef874add9240148ffd0b291f31f",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-6-answer-key.pdf",
        sha256:
          "517ec58262c10053ae4753e4c27d035f84bf9de17a7c6882d057a17b3aa47179",
      },
    ],
    complete: true,
  },
  {
    labeledBy: "agent:staar-first-pass",
    labeledAt: "2026-10-26",
    section: "Test form",
  },
  [
    {
      item: {
        number: "1",
        page: "rationale PDF p.1",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.4.E"],
      archetypeIds: ["number.percent-fraction-decimal"],
      demand: "Write a percent as a decimal",
      status: "covered",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal chooses the decimal for a percent, including percents above 100 and tenths of a percent.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.D"],
      archetypeIds: ["rational.signed-context"],
      demand:
        "Add seven signed daily changes to find the net change in a count",
      status: "covered",
      templateIds: ["signed-changes-sum", "integer-addition", "signed-story"],
      limitations:
        "signed-changes-sum adds five to seven signed integer changes read from a table to find the net change; choices are plain integers, so numeric entry practices the same answer.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.4.D"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Choose the unit rate of students per classroom, with the right unit order",
      status: "covered",
      templateIds: ["staar-ratio-statements", "unit-rate"],
      limitations:
        "staar-ratio-statements chooses a unit rate in which the units are in the right order and the reversed order is a distractor.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.10.B"],
      archetypeIds: ["inequality.solution-set"],
      demand:
        "Choose the inequality that must be true for every n below a negative number after adding a constant",
      status: "partial",
      templateIds: ["inequality-solution-set"],
      limitations:
        "inequality-solution-set tests numbers against x > c style inequalities; deciding which shifted inequality follows from a stated one is not practiced.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "other",
      standards: ["TEKS.6.4.14.B"],
      archetypeIds: ["finance.credit-concept"],
      demand:
        "Decide for each statement whether it describes a debit card or a credit card",
      status: "partial",
      templateIds: ["credit-cost-concepts"],
      limitations:
        "credit-cost-concepts practices what a debit card and a credit card cost and how the monthly rate follows from the APR, by single choice with computed amounts; deciding for each statement whether it describes a debit card or a credit card, a match table grid worth 2 points, is not practiced.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.4.B"],
      archetypeIds: ["ratio.part-whole"],
      demand:
        "Use a part-to-part tile ratio and a total to find how many tiles are one color",
      status: "covered",
      templateIds: [
        "staar-ratio-statements",
        "ratio-missing",
        "ratio-table-missing",
      ],
      limitations:
        "staar-ratio-statements finds how many tiles are one color from a part-to-part ratio and a stated total, by choice.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.A"],
      archetypeIds: ["number.number-classification"],
      demand:
        "Choose the value outside a Venn region of integers within rational numbers",
      status: "partial",
      templateIds: ["staar-number-sets", "number-set-venn"],
      limitations:
        "number-set-venn (single-choice-v1) draws the nested circles of whole numbers, integers and rational numbers and asks which region holds a number, which statement about the diagram is true or the smallest set containing a number; staar-number-sets states the sets in words. Choosing the value that lies outside one region of the diagram is the reverse direction and is not asked.",
      labeledBy: "agent:stale-shown-work-relabel",
      labeledAt: "2026-10-27",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.2.6.C"],
      archetypeIds: ["function.relation-equation"],
      demand:
        "Complete the equation that fits a table of paired values by dragging pieces",
      status: "covered",
      templateIds: ["table-equation-slots", "dependent-variable-equation"],
      limitations:
        "table-equation-slots completes y = ax + b or y = ax - b for a table by choosing the multiplier, the operation and the constant. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.4.12.D"],
      archetypeIds: ["data.percent-bar-graph"],
      demand:
        "Choose the statement a percentage bar graph of session attendance supports",
      status: "missing",
      templateIds: [],
      limitations:
        "No family reads percentage bar graphs or interprets shares of a whole graphically.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.3.11.A"],
      archetypeIds: ["coordinate.plane-point"],
      demand:
        "Choose the ordered pair for a point a given distance horizontally or vertically from another labeled point",
      status: "partial",
      templateIds: ["coordinate-point-reading"],
      limitations:
        "coordinate-point-reading reads one coordinate of a labeled point; finding a point from a stated displacement and choosing among pairs is not practiced.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.1.2.D"],
      archetypeIds: ["rational.order-absolute"],
      demand:
        "Place numbers into inequalities so each statement holds, using signed decimals and fractions",
      status: "partial",
      templateIds: [
        "inequality-number-blanks",
        "signed-context-order",
        "compare-decimals-thousandths",
      ],
      limitations:
        "STAAR interaction: drag and drop, 2 points. inequality-number-blanks chooses numbers for two separate inequalities from a bank of signed decimals and fractions; the chained form of two inequalities in one statement is not practiced.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.E"],
      archetypeIds: ["decimal.multiply"],
      demand:
        "Multiply a whole number of coins by a value in hundredths of a dollar",
      status: "covered",
      templateIds: ["staar-decimal-operations", "multidigit-decimal-product"],
      limitations:
        "staar-decimal-operations multiplies a whole number by a value in hundredths of a dollar in a money story, by entry.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.4.12.C"],
      archetypeIds: ["univariate.center"],
      demand:
        "Find the mean and the median of six decimal sprint times and place both",
      status: "covered",
      templateIds: ["mean-median-blanks", "mean-data", "median-data"],
      limitations:
        "mean-median-blanks chooses the mean and the median of six decimal values listed out of order. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.5.B"],
      archetypeIds: ["percent.of"],
      demand:
        "Find a three percent raise of a salary of tens of thousands of dollars",
      status: "covered",
      templateIds: ["staar-salary-percent", "percent-of"],
      limitations:
        "staar-salary-percent finds a percent raise (2 to 8 percent) of a salary of tens of thousands of dollars, by entry.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "constructed",
      standards: ["TEKS.6.3.8.C"],
      archetypeIds: ["linear.literal"],
      demand:
        "Write the formula for a parallelogram's height by solving area equals base times height",
      status: "covered",
      templateIds: [
        "solve-justify-formula",
        "formula-isolate",
        "formula-value",
      ],
      limitations:
        "STAAR interaction: equation editor, 1 point. solve-justify-formula (structured-work-v1) types the rearranged formula A/b = h (or h = A/b) for A = bh, line by line with the property of equality used; the final formula is graded by exact symbolic equivalence.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.E"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Choose the expression that does not model sharing a total into equal baskets",
      status: "covered",
      templateIds: ["staar-story-model-choice", "story-operation-choice"],
      limitations:
        "staar-story-model-choice finds the expression that does not give the number in each of several equal groups.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.2.9.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Build the inequality for the money left for snacks after a ticket price by dragging symbols",
      status: "covered",
      templateIds: ["budget-inequality-slots", "inequality-context-bound"],
      limitations:
        "budget-inequality-slots completes an inequality for spending within a budget or saving toward a goal by choosing the known amount, the symbol and the limit. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.B"],
      archetypeIds: ["rational.order-absolute"],
      demand: "Evaluate the absolute value of a positive decimal",
      status: "partial",
      templateIds: ["signed-context-order"],
      limitations:
        "signed-context-order uses absolute value as a size in statements; evaluating |x| directly is not practiced.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.4.12.C"],
      archetypeIds: ["univariate.spread"],
      demand: "Find the range of a list of ticket prices",
      status: "covered",
      templateIds: ["range-data"],
      limitations:
        "The family finds the greatest minus the least of a list of values.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.E"],
      archetypeIds: ["fractions.divide"],
      demand: "Divide one fraction by another",
      status: "covered",
      templateIds: ["divide-fractions"],
      limitations: "Fraction entry of the quotient.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.3.8.D"],
      archetypeIds: ["measure.area"],
      demand:
        "Mark the two figures with equal area among a parallelogram, a trapezoid and a triangle",
      status: "partial",
      templateIds: ["polygon-area-decompose", "triangle-area-base-height"],
      limitations:
        "STAAR interaction: hot spot, 1 point. Related families compute one area by entry; comparing computed areas of several figures and clicking two of them (hot spot) are not practiced.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.10.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the inequality for how many items at a unit price fit a budget",
      status: "partial",
      templateIds: ["inequality-context-bound"],
      limitations:
        "inequality-context-bound handles a count threshold; the product of a price and a variable compared with a budget is not practiced.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.6.3.4.H"],
      archetypeIds: ["measure.customary-units"],
      demand:
        "Mark every measurement equivalent to six yards in feet and inches",
      status: "covered",
      templateIds: [
        "customary-unit-rename",
        "customary-unit-reverse",
        "customary-equivalent-select",
      ],
      limitations:
        "customary-equivalent-select gives a whole number of yards, gallons or pounds and selects the two or three of five measurements equal to it, written in one unit or two units such as feet and inches.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.3.D"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Evaluate an expression with a negative factor times a parenthesized difference plus another product",
      status: "covered",
      templateIds: [
        "staar-signed-exponent-order",
        "operation-order",
        "integer-addition",
      ],
      limitations:
        "staar-signed-exponent-order evaluates a negative factor times a parenthesized negative difference plus a product, by entry.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.4.B"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Scale a rate of dollars per hours to find the charge for nine hours from a table",
      status: "covered",
      templateIds: ["dollar-rate-scale", "ratio-table-missing", "unit-rate"],
      limitations:
        "dollar-rate-scale gives the charge in dollars and cents for two numbers of hours in a table and asks for the charge for 7 to 12 hours, or the hours for a charge, at a constant hourly price.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.4.14.H"],
      archetypeIds: ["finance.income-compare"],
      demand:
        "Find the five-year earnings difference of two careers from their yearly salaries",
      status: "covered",
      templateIds: [
        "staar-salary-percent",
        "subtract-multidigit",
        "multiply-by-one-digit",
      ],
      limitations:
        "staar-salary-percent finds the earnings difference of two careers over several years from a table of yearly salaries, by entry.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.6.2.4.A"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Mark both statements that describe y = 7x as multiplicative and y = x + 7 as additive",
      status: "partial",
      templateIds: [
        "pattern-pair-relationship",
        "additive-multiplicative-select",
      ],
      limitations:
        "additive-multiplicative-select selects true statements among classifications of the two rules, constant relationships and values of y; a set made only of the classification of each rule is rarely drawn, so classifying y = mx as multiplicative and y = x + c as additive alone is not reliably practiced.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.7.A"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Evaluate an expression with a subtraction of a product with a squared number and an addition",
      status: "covered",
      templateIds: [
        "staar-signed-exponent-order",
        "power-order-trap",
        "operation-order",
      ],
      limitations:
        "staar-signed-exponent-order evaluates a subtraction of a product with a squared number and an addition, by entry.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.4.13.A"],
      archetypeIds: ["univariate.displays"],
      demand: "Choose the true statement comparing sums of histogram bars",
      status: "partial",
      templateIds: ["histogram-read"],
      limitations:
        "histogram-read asks counts in one interval, above or below an edge, or the total; judging statements about combined bars is not practiced.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.1.7.D"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Drag the two equivalent expressions out of several with a variable and the number one",
      status: "covered",
      templateIds: [
        "equivalent-expressions-table",
        "equivalent-expressions-check",
      ],
      limitations:
        "equivalent-expressions-table marks four or five expressions as equivalent or not to an expression using the identity or associative property; exactly two are equivalent. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.31",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.3.8.A"],
      archetypeIds: ["angle.relationships"],
      demand: "Choose the three measures that can be the angles of a triangle",
      status: "partial",
      templateIds: ["triangle-angle-sum"],
      limitations:
        "triangle-angle-sum finds an unknown angle from the 180 degree sum; testing candidate sets of three angles is not practiced.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.32",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.6.4.14.C"],
      archetypeIds: ["finance.check-register"],
      demand:
        "Complete two missing balances and deposit amounts in a check register by dragging values",
      status: "covered",
      templateIds: ["check-register-blanks", "signed-story"],
      limitations:
        "check-register-blanks chooses two missing balances and two missing amounts of a four-line register, with balances below zero. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: {
        number: "33",
        page: "rationale PDF p.33",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.2.D"],
      archetypeIds: ["rational.order-absolute"],
      demand:
        "Choose the list of signed fractions and decimals ordered from least to greatest",
      status: "covered",
      templateIds: [
        "staar-order-mixed-forms",
        "signed-context-order",
        "compare-decimals-thousandths",
      ],
      limitations:
        "staar-order-mixed-forms orders five signed fractions and decimals from least to greatest by choice.",
    },
    {
      item: {
        number: "34",
        page: "rationale PDF p.34",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.3.11.A"],
      archetypeIds: ["coordinate.plane-point"],
      demand: "Choose the grid point for a pair with two negative coordinates",
      status: "covered",
      templateIds: [
        "first-quadrant-locate",
        "plot-points",
        "point-on-signed-grid",
      ],
      limitations:
        "point-on-signed-grid (figure-choice-v1): the graph that shows one signed pair or its distances from the axes, among points with a sign flipped or the coordinates swapped. Options are separate graphs of one point each, not labeled points on one grid.",
    },
    {
      item: {
        number: "35",
        page: "rationale PDF p.35",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.1.4.G"],
      archetypeIds: ["number.percent-fraction-decimal"],
      demand:
        "Choose the decimal or percent equivalent to an improper fraction",
      status: "covered",
      templateIds: ["staar-rename-percent-fraction-decimal"],
      limitations:
        "staar-rename-percent-fraction-decimal chooses the decimal or the percent equal to a fraction greater than 1.",
    },
    {
      item: {
        number: "36",
        page: "rationale PDF p.36",
      },
      responseFormat: "choice",
      standards: ["TEKS.6.2.5.A"],
      archetypeIds: ["ratio.write-simplify"],
      demand: "Write the ratio of two stated counts in simplest form",
      status: "covered",
      templateIds: ["staar-ratio-statements"],
      limitations:
        "staar-ratio-statements chooses the ratio of two counts in simplest form, in the order the question names.",
    },
  ],
);
