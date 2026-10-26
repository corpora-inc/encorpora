import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 7 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade7 = defineLedger(
  {
    id: "staar-2025-7",
    test: "STAAR Grade 7 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-7-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "e331bd5aa84fb2cdfb2a49d051bbed2ede0ed375d358c9234985537784d6edae",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-7-answer-key.pdf",
        sha256:
          "113de473ddfbcfbf27acab991ce769d21262462e7efd79661aba3fc39c7e8d5f",
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
      standards: ["TEKS.7.1.6.H"],
      archetypeIds: ["inference.estimate"],
      demand:
        "Choose the true prediction for the next 350 children from a survey of 70 flavor choices",
      status: "partial",
      templateIds: ["sample-proportion-estimate"],
      limitations:
        "sample-proportion-estimate scales one sample count to a population by entry; judging several statements about predicted counts for different flavors is not practiced.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.2.4.B"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Complete a sentence that divides the total cost by the number of pairs to get the price per pair",
      status: "partial",
      templateIds: ["unit-rate"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. unit-rate finds the price for one unit by entry; building the sentence by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.1.2.A"],
      archetypeIds: ["number.number-classification"],
      demand:
        "Choose the fix for a Venn diagram of rational numbers, integers and whole numbers where a quotient is misplaced",
      status: "partial",
      templateIds: ["staar-number-sets"],
      limitations:
        "staar-number-sets fixes a misplaced quotient among nested sets described in words by choice; the item's drawn Venn diagram is not shown.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.A"],
      archetypeIds: ["function.representations"],
      demand:
        "Choose the table or graph that matches a constant number of cycles per hour found from a stated rate",
      status: "partial",
      templateIds: ["proportional-rule-choice", "dependent-variable-equation"],
      limitations:
        "Related families choose the equation for a rate or recognize proportional rules; choosing among tables built from a rate computed first is not practiced.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume of a triangular prism from its triangular base area and height",
      status: "partial",
      templateIds: ["composite-face-prism-volume"],
      limitations:
        "composite-face-prism-volume uses L-, T- or U-shaped faces of right angles; a triangular base is not practiced.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "other",
      standards: ["TEKS.7.1.6.D"],
      archetypeIds: ["probability.prediction"],
      demand:
        "Predict how many times a spinner with ten equal sections lands on 20 in 150 spins, with dropdown blanks",
      status: "partial",
      templateIds: ["simple-probability", "sample-proportion-estimate"],
      limitations:
        "STAAR interaction: inline choice, 2 points. simple-probability finds a probability and sample-proportion-estimate scales a sample; predicting an expected count from a theoretical probability and dropdown blanks are not practiced.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.D"],
      archetypeIds: ["percent.change"],
      demand: "Find the percent increase from an old to a new hourly pay",
      status: "covered",
      templateIds: ["percent-change-rate"],
      limitations:
        "The family finds a relative percent change from an original and a new value by numeric entry.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.3.9.B"],
      archetypeIds: ["measure.circle"],
      demand:
        "Find the circular sign's area from its diameter with 3.14 and place the estimate by drag and drop",
      status: "partial",
      templateIds: ["circle-area-coefficient"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. circle-area-coefficient gives the area as a multiple of pi; using 3.14, rounding to a measurement and dragging values are not practiced.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.7.A"],
      archetypeIds: ["linear.meaning"],
      demand:
        "Choose the statement that interprets both the rate and the starting amount of a savings equation",
      status: "partial",
      templateIds: ["linear-initial-value-meaning"],
      limitations:
        "linear-initial-value-meaning interprets only the constant term; interpreting a negative rate of change in the same choice is not practiced.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.3.5.C"],
      archetypeIds: ["measure.scale"],
      demand:
        "Mark the city whose map distance matches a real distance given a scale",
      status: "partial",
      templateIds: ["scale-drawing", "ratio-missing"],
      limitations:
        "STAAR interaction: hot spot, 1 point. scale-drawing finds a map or real length by entry; locating the matching city by clicking a map (hot spot) has no response protocol.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.B"],
      archetypeIds: ["number.rational-operations"],
      demand:
        "Evaluate a signed expression that subtracts a mixed number times a whole number from a decimal",
      status: "partial",
      templateIds: ["signed-fraction-product", "operation-order"],
      limitations:
        "Related families multiply signed fractions or order operations on whole numbers; mixing a decimal with a mixed number is not practiced.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "numeric",
      standards: ["TEKS.7.3.9.C"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the area of a figure made of a rectangle and right triangles",
      status: "covered",
      templateIds: ["composite-area"],
      limitations:
        "STAAR interaction: equation editor, 1 point. The family adds areas of rectangles and triangles in composite figures, recovering unlabeled sides.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.I"],
      archetypeIds: ["probability.direct"],
      demand:
        "Find the experimental probability of drawing one of two colors from a frequency table of 40 trials",
      status: "covered",
      templateIds: [
        "staar-experiment-probability",
        "compound-event-simulation",
        "simple-probability",
      ],
      limitations:
        "staar-experiment-probability finds the experimental probability of one of two colors from a frequency table of 40, 50 or 60 trials.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.3.5.B"],
      archetypeIds: ["measure.circle"],
      demand:
        "Use a circle's circumference and diameter to estimate pi, placing values by drag and drop",
      status: "partial",
      templateIds: ["circle-circumference-coefficient"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. circle-circumference-coefficient gives circumference as a multiple of pi; estimating pi as a ratio and dragging values are not practiced.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.4.6.G"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Choose the statement a dot plot of player scores does not support",
      status: "partial",
      templateIds: ["dot-plot-mean", "line-plot-whole"],
      limitations:
        "Related families read means and counts from a dot plot or line plot; judging several fraction-of-data statements is not practiced.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.11.A"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the solution set for how many guests fit a budget with a fixed room fee and a per-guest cost",
      status: "partial",
      templateIds: ["affine-linear-inequality", "two-step-word-problem"],
      limitations:
        "Related families solve an inequality or a two-step story separately; writing the inequality from the story and picking its solution set is not practiced.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.4.12.A"],
      archetypeIds: ["univariate.shape"],
      demand:
        "Choose the statement box plots of two groups support about symmetry and spread",
      status: "partial",
      templateIds: ["compare-distributions-choice", "skewed-box-compare"],
      limitations:
        "Related families compare medians and interquartile ranges or choose measures for skew; deciding symmetry from equal five-number intervals is not practiced.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.11.C"],
      archetypeIds: ["angle.relationships"],
      demand:
        "Write and solve an equation for a triangle whose two angles share a variable value and the third is 50 degrees",
      status: "covered",
      templateIds: ["triangle-angle-sum"],
      limitations:
        "The family finds a variable value from the 180 degree sum of expressions for triangle angles.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.H"],
      archetypeIds: ["inference.estimate"],
      demand:
        "Choose the prediction for the next 50 customers supported by a survey table of 100",
      status: "partial",
      templateIds: ["sample-proportion-estimate"],
      limitations:
        "sample-proportion-estimate scales one sample count by entry; comparing predicted counts across several vegetables is not practiced.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.5.C"],
      archetypeIds: ["measure.scale"],
      demand:
        "Find a side of one quadrilateral from a similar quadrilateral using corresponding sides",
      status: "partial",
      templateIds: ["similar-triangles-side"],
      limitations:
        "similar-triangles-side finds a side of a similar triangle; similar quadrilaterals with marked correspondence are not practiced.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "other",
      standards: ["TEKS.7.2.7.A"],
      archetypeIds: ["line.slope-equation"],
      demand:
        "Complete the equation y = mx + b from a graphed line by choosing m and b from dropdowns",
      status: "covered",
      templateIds: ["inline-linear-features", "graph-equation-choice"],
      limitations:
        "STAAR interaction: inline choice, 2 points. inline-linear-features completes m and b of y = mx + b for a graphed line through two labeled lattice points, choosing each from a dropdown blank.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.C"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the area of an L-shaped figure by splitting it into rectangles",
      status: "covered",
      templateIds: ["composite-area"],
      limitations:
        "The family finds composite areas, recovering missing lengths from the labeled sides.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.A"],
      archetypeIds: ["number.rational-operations"],
      demand: "Subtract a unit fraction from a decimal",
      status: "covered",
      templateIds: [
        "staar-decimal-operations",
        "signed-fraction-sum",
        "multidigit-decimal-sum",
      ],
      limitations:
        "staar-decimal-operations subtracts a unit fraction from a decimal, including results below zero, by entry.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.1.6.I"],
      archetypeIds: ["probability.compound-event"],
      demand:
        "Find the probability of drawing a red card and then a card labeled zero with replacement",
      status: "covered",
      templateIds: [
        "staar-experiment-probability",
        "compound-event-simulation",
      ],
      limitations:
        "staar-experiment-probability finds the probability of a red card then a labeled card with replacement, as a fraction.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.2.10.B"],
      archetypeIds: ["inequality.number-line"],
      demand:
        "Solve a two-step inequality with a negative coefficient and draw it on a number line, placing the endpoint and arrow",
      status: "partial",
      templateIds: [
        "inequality-number-line-choice",
        "affine-linear-inequality",
      ],
      limitations:
        "STAAR interaction: number line, 2 points. Related families solve and choose a drawn graph; drawing the graph by placing an open endpoint and an arrow has no response protocol.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.A"],
      archetypeIds: ["measure.volume"],
      demand:
        "Find the volume of a rectangular pyramid from its base and height",
      status: "partial",
      templateIds: ["solid-volume-context"],
      limitations:
        "solid-volume-context includes pyramid volumes in capacity and dimension contexts; the plain volume of a rectangular pyramid in cubic centimeters is not separately checked.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.4.13.B"],
      archetypeIds: ["finance.budget-percent"],
      demand:
        "Compare a rent amount and an insurance amount, each a percent of income, with stated dollar limits, using dropdown blanks",
      status: "partial",
      templateIds: ["percent-of"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. percent-of finds a percent of a quantity by entry; comparing two budget amounts with limits and dropdowns are not practiced.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.10.A"],
      archetypeIds: ["linear.context"],
      demand:
        "Choose the equation that sets a per-office area times the number of offices plus a break room equal to a total area",
      status: "covered",
      templateIds: ["two-step-equation-model"],
      limitations:
        "The family chooses a two-step equation that separates a rate from a fixed amount.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.B"],
      archetypeIds: ["measure.circle"],
      demand: "Find a cylinder's diameter from its circumference using 3.14",
      status: "partial",
      templateIds: ["circle-circumference-coefficient"],
      limitations:
        "circle-circumference-coefficient finds the multiple of pi for a circumference; solving for the diameter from a given circumference with 3.14 is not practiced.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.4.6.G"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Find the fraction or percent of campers in three age groups from bar heights",
      status: "partial",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "scaled-bar-graph adds and compares bars; converting the combined bars to a part of the total is not practiced.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.31",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.A"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Choose the equation for food eaten in d days from a total eaten over 130 days",
      status: "covered",
      templateIds: [
        "staar-rate-equation-choice",
        "dependent-variable-equation",
        "unit-rate",
      ],
      limitations:
        "staar-rate-equation-choice finds the unit rate from a total over a long period and chooses the equation for any number of units.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.32",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.5.A"],
      archetypeIds: ["measure.scale"],
      demand:
        "Choose the proportion of corresponding sides that is true for two similar triangles",
      status: "partial",
      templateIds: ["similar-triangles-side"],
      limitations:
        "similar-triangles-side finds a missing side by entry; picking the true proportion statement among mismatched correspondences is not practiced.",
    },
    {
      item: {
        number: "33",
        page: "rationale PDF p.33",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.11.A"],
      archetypeIds: ["linear.solve"],
      demand: "Solve an equation whose variable terms must be combined first",
      status: "covered",
      templateIds: [
        "staar-multistep-equations",
        "two-step-equation",
        "combine-like-coefficient",
      ],
      limitations:
        "staar-multistep-equations solves an equation with like variable terms to combine first, by entry.",
    },
    {
      item: {
        number: "34",
        page: "rationale PDF p.34",
      },
      responseFormat: "other",
      standards: ["TEKS.7.4.12.A"],
      archetypeIds: ["univariate.center"],
      demand:
        "Compare two teams' medians and say whether their modes match, completing two dropdown blanks",
      status: "partial",
      templateIds: ["median-data", "compare-distributions-choice"],
      limitations:
        "STAAR interaction: inline choice, 2 points. median-data finds a median by entry; comparing medians and modes of two data sets and dropdown blanks are not practiced.",
    },
    {
      item: {
        number: "35",
        page: "rationale PDF p.35",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.3.9.D"],
      archetypeIds: ["measure.surface"],
      demand:
        "Find the total surface area of a rectangular pyramid from its net",
      status: "partial",
      templateIds: ["net-surface-area"],
      limitations:
        "net-surface-area covers a square pyramid and prisms; a pyramid with a rectangular base and unequal triangular faces is not practiced.",
    },
    {
      item: {
        number: "36",
        page: "rationale PDF p.36",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.3.B"],
      archetypeIds: ["percent.change"],
      demand:
        "Find the cost of mixed-number yards of canvas at a price per yard, then apply a one-tenth discount",
      status: "partial",
      templateIds: ["percent-change-final", "multidigit-decimal-product"],
      limitations:
        "Related families apply one percent change or multiply decimals; a mixed-number quantity chained into a unit-price total and a fractional discount is not practiced.",
    },
    {
      item: {
        number: "37",
        page: "rationale PDF p.37",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.7.3.4.E"],
      archetypeIds: ["ratio.units"],
      demand:
        "Complete the proportion that converts yards to meters from a conversion factor by dragging parts",
      status: "partial",
      templateIds: ["ratio-missing", "metric-length-rename"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. Related families scale a ratio or rename units by entry; assembling the proportion by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "38",
        page: "rationale PDF p.38",
      },
      responseFormat: "choice",
      standards: ["TEKS.7.2.4.D"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Set up and solve a proportion for the minutes needed to scan a given number of items at a stated rate",
      status: "partial",
      templateIds: ["ratio-missing", "unit-rate"],
      limitations:
        "ratio-missing scales a ratio to a whole-number quantity; a non-integer result such as a decimal number of minutes is not checked.",
    },
  ],
);
