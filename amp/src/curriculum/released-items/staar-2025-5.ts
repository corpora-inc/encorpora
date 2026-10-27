import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 5 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade5 = defineLedger(
  {
    id: "staar-2025-5",
    test: "STAAR Grade 5 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-5-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "749436a0aa8f372c3d07234bc8d0d22d6ab71329a0f9b924d6da3271d9626f28",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-5-answer-key.pdf",
        sha256:
          "cf997ef4adb31b17c905e56b172b89fd6a7b135542fc8937cf99dbb8559ef9e9",
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
      standards: ["TEKS.5.2.4.C"],
      archetypeIds: ["pattern.paired"],
      demand: "Choose the table whose every pair satisfies y = x + 4",
      status: "covered",
      templateIds: [
        "staar-table-rule-choice",
        "pattern-pair-relationship",
        "rule-pattern-term",
      ],
      limitations:
        "staar-table-rule-choice chooses the table whose every pair satisfies an add rule such as y = x + 4; tables are shown as rows of paired values.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "other",
      standards: ["TEKS.5.4.9.C"],
      archetypeIds: ["data.frequency-table-read"],
      demand:
        "Compare tally counts of cups, mugs and bottles as times-as-many, completing two dropdown blanks",
      status: "partial",
      templateIds: ["comparison-factor", "scaled-picture-graph"],
      limitations:
        "STAAR interaction: inline choice, 1 point. Related families find a multiplicative factor or read a scaled graph; reading tally counts from a frequency table and dropdown blanks are not practiced.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.H"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Subtract two fractions of one whole shown as models, one in eighths and one in fourths",
      status: "partial",
      templateIds: ["unlike-fraction-difference", "fraction-model"],
      limitations:
        "unlike-fraction-difference subtracts bare fractions; fraction-model reads one model. Reading two models and then subtracting is not practiced.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.3.5.A"],
      archetypeIds: ["shape.attribute-classify"],
      demand:
        "Place shapes in the overlap of a Venn diagram of having a right angle and having parallel sides",
      status: "partial",
      templateIds: ["angle-classify", "line-relationship"],
      limitations:
        "STAAR interaction: hot spot, 2 points. angle-classify and line-relationship identify one attribute at a time; sorting shapes by two attributes and placing them on a diagram (hot spot) are not practiced.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.1.2.B"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand:
        "Find the third of four weights in order from least to greatest when they have unlike numbers of decimal places",
      status: "covered",
      templateIds: ["staar-order-decimals", "compare-decimals-thousandths"],
      limitations:
        "staar-order-decimals chooses the second or third of four ordered decimals with unlike numbers of places.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.4.B"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Build the equation for a story with a per-booth rent and a fixed fee, dragging symbols into place",
      status: "partial",
      templateIds: ["two-step-equation-model"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. two-step-equation-model chooses among complete equations; assembling an equation from parts by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.3.4.H"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the perimeter of a rectangular sign from decimal length and width in feet",
      status: "covered",
      templateIds: ["staar-measure-chains", "rectangle-border-length"],
      limitations:
        "staar-measure-chains finds the perimeter of a rectangle with decimal length and width, by entry.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.3.L"],
      archetypeIds: ["fractions.divide-context"],
      demand:
        "Divide a unit fraction by a whole number and enter the denominator of the quotient",
      status: "partial",
      templateIds: ["unit-fraction-share", "divide-fractions"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. unit-fraction-share divides a unit fraction of a liter among a whole group by entry; placing a number into the quotient by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.4.9.B"],
      archetypeIds: ["data.table-to-graph"],
      demand:
        "Choose the scatterplot whose points match a table of paired values",
      status: "partial",
      templateIds: ["first-quadrant-coordinates", "first-quadrant-locate"],
      limitations:
        "Related families name a plotted point or locate a named pair; matching seven table pairs to a plot and avoiding swapped coordinates is not practiced.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.1.2.A"],
      archetypeIds: ["number.number-word-form"],
      demand:
        "Choose the word form of a decimal written in expanded notation with tenths and thousandths",
      status: "covered",
      templateIds: ["staar-number-word-form"],
      limitations:
        "staar-number-word-form chooses the word form of a decimal with tenths and thousandths written in expanded notation.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.3.F"],
      archetypeIds: ["number.decimal-model-operation"],
      demand:
        "Complete the division equation shown by a shaded decimal grid split into two equal groups",
      status: "partial",
      templateIds: ["decimal-grid-read", "multidigit-decimal-quotient"],
      limitations:
        "STAAR interaction: drag and drop, 1 point. decimal-grid-read names a shaded decimal and multidigit-decimal-quotient divides decimals by decimals; reading a division from a model and dragging values into the equation are not practiced.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.1.4.E"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Find the first step of a multi-step simplification where bracketed operations were skipped",
      status: "partial",
      templateIds: ["operation-order"],
      limitations:
        "operation-order evaluates an expression with parentheses; locating an error in a shown solution is not practiced.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "numeric",
      standards: ["TEKS.5.2.3.K"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Add two mixed-number amounts with eighths and sixteenths and subtract the sum from a total, entering the result",
      status: "covered",
      templateIds: [
        "add-fractions",
        "unlike-fraction-difference",
        "fraction-total-minus-parts",
      ],
      limitations:
        "fraction-total-minus-parts (mixed-unlike) adds two mixed numbers with eighths and sixteenths and subtracts the sum from a total, entered as a fraction or decimal.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.4.9.C"],
      archetypeIds: ["data.stem-leaf-read"],
      demand:
        "Subtract the second-lowest from the highest score read from a stem-and-leaf plot",
      status: "covered",
      templateIds: ["staar-stem-leaf-combine", "stem-leaf-read"],
      limitations:
        "staar-stem-leaf-combine subtracts the second-least value from the greatest in a stem-and-leaf plot with a key.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.5.1.4.F"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Choose both expressions that equal one with a subtraction inside parentheses",
      status: "partial",
      templateIds: ["operation-order"],
      limitations:
        "STAAR interaction: multiselect, 2 points. operation-order evaluates one expression by entry; recognizing equivalent expressions with multiple selection has no response protocol.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.E"],
      archetypeIds: ["decimal.multiply"],
      demand:
        "Multiply two decimals to find total cups of flour for a number of batches",
      status: "covered",
      templateIds: ["multidigit-decimal-product"],
      limitations:
        "The family multiplies decimals with one or two places each; the story context is not separately practiced.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.3.8.C"],
      archetypeIds: ["pattern.graph-relationship"],
      demand:
        "Choose the graph whose points have a cost 1.5 times the number of bags",
      status: "partial",
      templateIds: ["graph-linear-equation", "coordinate-context-points"],
      limitations:
        "graph-linear-equation places points of a proportional relationship; the item chooses among drawn graphs, which no family does.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.5.2.3.D"],
      archetypeIds: ["number.decimal-model-operation"],
      demand: "Pick every hundredths model that shows a product of two tenths",
      status: "partial",
      templateIds: ["decimal-grid-read", "decimal-multiplication"],
      limitations:
        "STAAR interaction: multiselect, 2 points. decimal-multiplication multiplies tenths by entry; matching a model to the equation with two correct selections is not practiced.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.3.5.A"],
      archetypeIds: ["shape.quadrilateral-hierarchy"],
      demand:
        "Choose the organizer that classifies triangles, quadrilaterals and parallelograms inside polygons",
      status: "partial",
      templateIds: [
        "hierarchy-statement",
        "inherited-property",
        "quadrilateral-names",
      ],
      limitations:
        "Related families choose true statements about quadrilateral categories; choosing a nested organizer that includes triangles and polygons is not practiced.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.4.B"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Choose the equation for a purchase total made of two known prices and an unknown",
      status: "covered",
      templateIds: [
        "staar-story-model-choice",
        "one-step-equation-story",
        "story-operation-choice",
      ],
      limitations:
        "staar-story-model-choice chooses the addition equation for a total made of two known prices and an unknown price.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "numeric",
      standards: ["TEKS.5.4.10.F"],
      archetypeIds: ["money.budget"],
      demand:
        "Find the entertainment amount that makes a monthly budget equal income",
      status: "partial",
      templateIds: ["budget-category-balance", "gross-net-pay"],
      limitations:
        "STAAR interaction: equation editor, 1 point. budget-category-balance is a choice family that picks a balancing change; the item needs typed entry of the missing category.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.L"],
      archetypeIds: ["fractions.divide-context"],
      demand:
        "Divide a whole number of hours by a fractional lesson length to count lessons",
      status: "covered",
      templateIds: ["whole-unit-groups"],
      limitations:
        "The family counts unit-fraction pieces in whole amounts by numeric entry.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.G"],
      archetypeIds: ["decimal.divide"],
      demand: "Divide a decimal total by a whole number of weeks",
      status: "covered",
      templateIds: ["staar-decimal-operations", "multidigit-decimal-quotient"],
      limitations:
        "staar-decimal-operations divides a decimal money total by a whole number of weeks, by entry.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.3.4.H"],
      archetypeIds: ["measure.area"],
      demand: "Find a square's area from its perimeter",
      status: "covered",
      templateIds: [
        "staar-measure-chains",
        "rectangle-area",
        "rectangle-border-length",
      ],
      limitations:
        "staar-measure-chains finds a square's side from its perimeter and then its area, by entry.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.4.C"],
      archetypeIds: ["pattern.rule"],
      demand:
        "Complete missing inputs and outputs of a table for y = x + 7 by dragging values",
      status: "partial",
      templateIds: ["rule-pattern-term"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. rule-pattern-term finds a later term by entry; completing both an output and an input with drag and drop has no response protocol.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.3.7.A"],
      archetypeIds: ["ratio.units"],
      demand:
        "Multiply liters per glass by the glasses, then convert liters to milliliters using a reference table",
      status: "covered",
      templateIds: [
        "staar-multistep-stories",
        "mass-volume-story",
        "metric-length-rename",
      ],
      limitations:
        "staar-multistep-stories multiplies liters per glass by the glasses and converts to milliliters with the stated factor, by entry.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "other",
      standards: ["TEKS.5.2.4.D"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Decide whether a table's outputs add or multiply the inputs and name the number, using dropdown blanks",
      status: "partial",
      templateIds: ["pattern-pair-relationship"],
      limitations:
        "STAAR interaction: inline choice, 2 points. pattern-pair-relationship relates matched terms of two patterns; classifying a table as additive or multiplicative and dropdowns are not practiced.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.1.2.B"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand: "Choose the list of four decimals ordered from least to greatest",
      status: "covered",
      templateIds: ["staar-order-decimals", "compare-decimals-thousandths"],
      limitations:
        "staar-order-decimals chooses the list of four decimals with unlike numbers of places in order, either direction.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "other",
      standards: ["TEKS.5.3.8.A"],
      archetypeIds: ["coordinate.first-quadrant"],
      demand:
        "Complete a statement about the point (0, 3), such as which axis distance the first coordinate shows",
      status: "partial",
      templateIds: ["first-quadrant-coordinates"],
      limitations:
        "STAAR interaction: inline choice, 2 points. first-quadrant-coordinates names a plotted point; describing what each coordinate means for a point on an axis, with dropdown blanks, is not practiced.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.K"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Subtract the sum of a fraction and a decimal distance from a total to find a third distance",
      status: "covered",
      templateIds: [
        "unlike-fraction-difference",
        "decimal-addition",
        "fraction-total-minus-parts",
      ],
      limitations:
        "fraction-total-minus-parts (fraction-decimal) adds a fraction and a decimal measure and subtracts the sum from a total; choices are plain numbers, so numeric entry fits.",
    },
    {
      item: {
        number: "31",
        page: "rationale PDF p.31",
      },
      responseFormat: "other",
      standards: ["TEKS.5.1.2.C"],
      archetypeIds: ["number.round-decimal"],
      demand:
        "Complete both blanks with a number rounded to the nearest tenth and to the nearest hundredth",
      status: "partial",
      templateIds: ["round-decimal"],
      limitations:
        "STAAR interaction: inline choice, 2 points. round-decimal rounds one value to one place by entry; dropdown blanks for two roundings have no response protocol.",
    },
    {
      item: {
        number: "32",
        page: "rationale PDF p.32",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.B"],
      archetypeIds: ["expression.order-of-operations"],
      demand: "Find the product of 538 and the sum of 42 and 6",
      status: "covered",
      templateIds: [
        "staar-nested-grouping",
        "operation-order",
        "multiply-multidigit",
      ],
      limitations:
        "staar-nested-grouping states a product of a three-digit number and a sum or difference in words and evaluates it by entry.",
    },
    {
      item: {
        number: "33",
        page: "rationale PDF p.33",
      },
      responseFormat: "choice",
      standards: ["TEKS.5.1.4.F"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Evaluate an expression with a bracket around two parenthesized groups, multiplication and subtraction",
      status: "covered",
      templateIds: ["staar-nested-grouping", "operation-order"],
      limitations:
        "staar-nested-grouping evaluates a bracket around two parenthesized groups with multiplication and subtraction; it does not ask the learner to find a worked solution's first step.",
    },
    {
      item: {
        number: "34",
        page: "rationale PDF p.34",
      },
      responseFormat: "other",
      standards: ["TEKS.5.2.3.C"],
      archetypeIds: ["number.remainder-interpret"],
      demand:
        "Divide candies by the bag size and give both the number of full bags and the leftover, with dropdown blanks",
      status: "partial",
      templateIds: ["division-remainder-story", "divide-by-two-digit"],
      limitations:
        "STAAR interaction: inline choice, 2 points. division-remainder-story finds complete groups by entry; naming both the quotient and the remainder through dropdown blanks has no response protocol.",
    },
  ],
);
