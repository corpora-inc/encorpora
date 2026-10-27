import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 5 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade5 = defineLedger(
  {
    id: "staar-2024-5",
    test: "STAAR Grade 5 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-5-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "7452d1b1d43e1d6bbe96da7cadf463f13f4581cf92f55d4be5a648c125ab4714",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-5-math-answer-key.pdf",
        sha256:
          "5c8e88742e2845e50ecc4273bc99ff83a282eeebe80ccac90bfa5c4a9b90824c",
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
      standards: ["TEKS.5.4.9.C"],
      archetypeIds: ["data.graph-read"],
      demand:
        "Find Wednesday's visitors when they are half of Friday's on a bar graph",
      status: "partial",
      templateIds: ["scaled-bar-graph"],
      limitations:
        "scaled-bar-graph reads bars and compares categories by sums and differences; taking half of one bar to find another is not practiced.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.C"],
      archetypeIds: ["number.remainder-interpret"],
      demand:
        "Find the complete rows planted from 1,850 seeds at forty per row",
      status: "partial",
      templateIds: ["full-kits", "division-remainder-story"],
      limitations:
        "full-kits counts complete groups from small totals and divisors; a four-digit total with a two-digit group size is outside its range.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "multi-select",
      standards: ["TEKS.5.3.4.H"],
      archetypeIds: ["measure.volume"],
      demand:
        "Select every drawn rectangular prism with a volume of twenty-four cubic centimeters",
      status: "partial",
      templateIds: ["prism-volume-edges"],
      limitations:
        "STAAR interaction: multiselect, 2 points. prism-volume-edges finds the volume of one prism by entry; no family takes a selection of several prisms.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "choice",
      standards: ["TEKS.5.1.4.F"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Choose the expression equal to a bracketed decimal expression after its inner product is evaluated",
      status: "partial",
      templateIds: ["operation-order", "staar-nested-grouping"],
      limitations:
        "operation-order and staar-nested-grouping evaluate whole-number expressions; choosing the intermediate form of an expression with decimal factors is not practiced.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.4.B"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Choose the equation that finds leftover string after equal pieces are cut from a whole length",
      status: "covered",
      templateIds: ["staar-story-model-choice", "two-step-equation-model"],
      limitations:
        "staar-story-model-choice chooses the equation for a story with a known total, equal parts and an unknown remainder.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "choice",
      standards: ["TEKS.5.1.2.B"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand:
        "Find the third of four decimals when they are listed from least to greatest",
      status: "covered",
      templateIds: ["staar-order-decimals"],
      limitations:
        "staar-order-decimals finds the decimal in a stated position when four decimals with unlike places are ordered.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.5.A"],
      archetypeIds: ["angle.classify"],
      demand:
        "Classify a drawn triangle using a graphic organizer of acute, equiangular, obtuse and right",
      status: "partial",
      templateIds: ["classify-triangle-angles"],
      limitations:
        "classify-triangle-angles classifies a triangle as acute, right or obtuse; equiangular and classification from a marked figure with an organizer are not practiced.",
    },
    {
      item: { number: "8", page: "rationale PDF p.8" },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.3.J"],
      archetypeIds: ["fractions.divide-context"],
      demand:
        "Drag values to write the equation for sharing one fifth of a cake between two people",
      status: "partial",
      templateIds: ["unit-fraction-share", "divide-fractions"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. unit-fraction-share divides a unit fraction of a liter by a group and divide-fractions divides by entry; building the equation from a model by drag and drop has no multi-part family.",
    },
    {
      item: { number: "9", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.8.C"],
      archetypeIds: ["pattern.graph-relationship"],
      demand:
        "Choose the graph of cost after a five dollar coupon against cost before it",
      status: "covered",
      templateIds: [
        "coordinate-context-points",
        "first-quadrant-locate",
        "graph-of-paired-values",
      ],
      limitations:
        "graph-of-paired-values (figure-choice-v1), shift-rule format: the graph whose points follow a stated difference (a price after a coupon is a number less than the price before), among graphs with swapped coordinates, the wrong operation, a constant y or a left-out pair.",
    },
    {
      item: { number: "10", page: "rationale PDF p.10" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.G"],
      archetypeIds: ["decimal.divide"],
      demand: "Divide a gas total in dollars and cents by thirteen gallons",
      status: "covered",
      templateIds: ["multidigit-decimal-quotient", "staar-decimal-operations"],
      limitations:
        "multidigit-decimal-quotient divides a decimal by a one- or two-digit divisor with a terminating quotient and staar-decimal-operations sets decimal division in a story; the choices are plain numbers.",
    },
    {
      item: { number: "11", page: "rationale PDF p.11" },
      responseFormat: "choice",
      standards: ["TEKS.5.4.9.A"],
      archetypeIds: ["data.stem-leaf-read"],
      demand: "Choose the stem-and-leaf plot that shows a team's listed wins",
      status: "partial",
      templateIds: ["stem-leaf-read"],
      limitations:
        "stem-leaf-read reads values from a plot; no family chooses the plot that matches a data list.",
    },
    {
      item: { number: "12", page: "rationale PDF p.12" },
      responseFormat: "numeric",
      standards: ["TEKS.5.2.3.K"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Add three distances, one written as a decimal, to find total miles ridden",
      status: "partial",
      templateIds: ["add-fractions", "unlike-fraction-difference"],
      limitations:
        "STAAR interaction: equation editor. add-fractions adds two fractions; a third addend and a decimal that must be renamed as a fraction are not practiced.",
    },
    {
      item: { number: "13", page: "rationale PDF p.13" },
      responseFormat: "choice",
      standards: ["TEKS.5.1.4.A"],
      archetypeIds: ["number.prime-composite"],
      demand: "Count the composite numbers in a list of five numbers",
      status: "partial",
      templateIds: ["prime-composite-sort"],
      limitations:
        "prime-composite-sort picks one prime or composite among four numbers; counting composite numbers in a list is not practiced.",
    },
    {
      item: { number: "14", page: "rationale PDF p.14" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.4.C"],
      archetypeIds: ["pattern.graph-relationship"],
      demand:
        "Choose the graph whose marked points all follow y equals x plus four and a half",
      status: "partial",
      templateIds: ["coordinate-context-points", "first-quadrant-locate"],
      limitations:
        "coordinate-context-points and first-quadrant-locate read and place single points; testing every marked point of a graph against a rule with decimals is not practiced.",
    },
    {
      item: { number: "15", page: "rationale PDF p.15" },
      responseFormat: "multi-select",
      standards: ["TEKS.5.1.2.C"],
      archetypeIds: ["number.inverse-rounding"],
      demand: "Select the two numbers that round to 124.6 at the nearest tenth",
      status: "partial",
      templateIds: ["inverse-round-decimal"],
      limitations:
        "STAAR interaction: multiselect, 2 points. inverse-round-decimal chooses one decimal that rounds to a stated tenth; no family takes a multi-select or numbers with a hundreds place.",
    },
    {
      item: { number: "16", page: "rationale PDF p.17" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.H"],
      archetypeIds: ["fractions.add-subtract-unlike"],
      demand:
        "Evaluate a sum and difference of three fractions with denominators twelve, five and ten",
      status: "partial",
      templateIds: ["add-fractions", "unlike-fraction-difference"],
      limitations:
        "add-fractions adds two fractions and unlike-fraction-difference subtracts two; a three-term expression with three different denominators is not practiced.",
    },
    {
      item: { number: "17", page: "rationale PDF p.18" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.L"],
      archetypeIds: ["fractions.divide-context"],
      demand: "Count the slices when three whole pies are each cut into sixths",
      status: "covered",
      templateIds: ["whole-unit-groups"],
      limitations:
        "whole-unit-groups counts how many unit-fraction containers a whole number of units fills with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "18", page: "rationale PDF p.19" },
      responseFormat: "choice",
      standards: ["TEKS.5.1.4.F"],
      archetypeIds: ["expression.order-of-operations"],
      demand:
        "Evaluate an expression with a bracket holding a product, a quotient and a difference, then a multiplier",
      status: "covered",
      templateIds: ["staar-nested-grouping"],
      limitations:
        "staar-nested-grouping evaluates whole-number expressions with brackets around parenthesized groups; the choices are plain numbers.",
    },
    {
      item: { number: "19", page: "rationale PDF p.20" },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.3.8.A"],
      archetypeIds: ["coordinate.plane-point"],
      demand:
        "Drag terms such as y-axis, x-coordinate and origin to match descriptions on a coordinate plane",
      status: "partial",
      templateIds: ["first-quadrant-coordinates"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. first-quadrant-coordinates reads the ordered pair of a plotted point; naming plane parts by drag and drop has no family.",
    },
    {
      item: { number: "20", page: "rationale PDF p.21" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.F"],
      archetypeIds: ["number.decimal-model-operation"],
      demand:
        "Choose the hundredths model that shows one dollar twenty divided by four",
      status: "partial",
      templateIds: ["decimal-grid-read", "multidigit-decimal-quotient"],
      limitations:
        "decimal-grid-read names one shaded decimal and multidigit-decimal-quotient divides by entry; matching a model to a division equation is not practiced.",
    },
    {
      item: { number: "21", page: "rationale PDF p.22" },
      responseFormat: "other",
      standards: ["TEKS.5.4.10.B"],
      archetypeIds: ["money.budget"],
      demand:
        "Complete a statement that tells how taxes and deductions relate to gross income and take-home pay",
      status: "partial",
      templateIds: ["gross-net-pay"],
      limitations:
        "STAAR interaction: inline choice, 2 points. gross-net-pay computes net or gross pay from deductions; the vocabulary statement with two dropdown blanks has no multi-part family.",
    },
    {
      item: { number: "22", page: "rationale PDF p.23" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.A"],
      archetypeIds: ["number.estimate"],
      demand:
        "Estimate how many more milliliters one jar holds than another by rounding decimals",
      status: "partial",
      templateIds: ["estimate-reasonableness"],
      limitations:
        "estimate-reasonableness rounds to estimate a product, quotient or total; estimating a difference of decimals is not practiced.",
    },
    {
      item: { number: "23", page: "rationale PDF p.24" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.E"],
      archetypeIds: ["decimal.multiply"],
      demand: "Multiply 1.5 by 1.12",
      status: "covered",
      templateIds: ["multidigit-decimal-product"],
      limitations:
        "multidigit-decimal-product multiplies decimals with one or two places each; the choices are plain numbers.",
    },
    {
      item: { number: "24", page: "rationale PDF p.25" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.4.H"],
      archetypeIds: ["measure.area"],
      demand: "Find a tablecloth's length from its perimeter and width",
      status: "covered",
      templateIds: ["rectangle-missing-border-side"],
      limitations:
        "rectangle-missing-border-side recovers a side from perimeter and one perpendicular side; the choices are plain numbers.",
    },
    {
      item: { number: "25", page: "rationale PDF p.26" },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.3.L"],
      archetypeIds: ["fractions.divide-context"],
      demand:
        "Drag values to write the division that finds the laps in a three-mile run of quarter-mile laps",
      status: "partial",
      templateIds: ["unit-fraction-share", "divide-fractions"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. unit-fraction-share divides a unit fraction among a group and divide-fractions divides by entry; building the equation by drag and drop has no multi-part family.",
    },
    {
      item: { number: "26", page: "rationale PDF p.27" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.6.A"],
      archetypeIds: ["measure.volume", "measure.unit-cube-volume"],
      demand: "Find the unit cubes that fill a prism two by four by two inches",
      status: "covered",
      templateIds: ["prism-volume-edges", "unit-cube-volume"],
      limitations:
        "prism-volume-edges and unit-cube-volume find a prism's volume from edges or a cube drawing with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "27", page: "rationale PDF p.28" },
      responseFormat: "choice",
      standards: ["TEKS.5.4.9.C"],
      archetypeIds: ["univariate.displays", "data.fraction-line-plot"],
      demand:
        "Find the difference between the greatest and least values of a dot plot with mixed numbers",
      status: "partial",
      templateIds: ["fraction-line-plot"],
      limitations:
        "fraction-line-plot counts and compares dots on a fractional line plot; subtracting the extreme values as mixed numbers is not practiced.",
    },
    {
      item: { number: "28", page: "rationale PDF p.29" },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.3.I"],
      archetypeIds: ["fractions.multiply-whole"],
      demand:
        "Drag numbers to complete the equation that multiplies a fraction by two for a shaded model",
      status: "partial",
      templateIds: ["fraction-model"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. fraction-model names a shaded part; writing and solving the product equation for a model by drag and drop has no family.",
    },
    {
      item: { number: "29", page: "rationale PDF p.30" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.5.A"],
      archetypeIds: ["shape.attribute-classify"],
      demand:
        "Pick the shape that belongs in one circle of a Venn diagram but not the other",
      status: "partial",
      templateIds: [
        "angle-classify",
        "line-relationship",
        "defining-attribute",
      ],
      limitations:
        "angle-classify, line-relationship and defining-attribute practice single attributes; sorting a shape by two properties in a Venn diagram is not practiced.",
    },
    {
      item: { number: "30", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.G"],
      archetypeIds: ["decimal.divide"],
      demand: "Divide ninety-seven and a half ounces of food over thirty days",
      status: "covered",
      templateIds: ["multidigit-decimal-quotient", "staar-decimal-operations"],
      limitations:
        "multidigit-decimal-quotient divides a decimal by a one- or two-digit divisor with a terminating quotient; the choices are plain numbers.",
    },
    {
      item: { number: "31", page: "rationale PDF p.32" },
      responseFormat: "choice",
      standards: ["TEKS.5.1.2.B"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand:
        "Choose the true comparison among four decimals with unlike places",
      status: "covered",
      templateIds: ["compare-decimals-thousandths", "staar-order-decimals"],
      limitations:
        "compare-decimals-thousandths and staar-order-decimals compare decimals with up to three places by choice.",
    },
    {
      item: { number: "32", page: "rationale PDF p.33" },
      responseFormat: "graph/drag",
      standards: ["TEKS.5.2.4.C"],
      archetypeIds: ["pattern.rule"],
      demand: "Drag values into a table for y equals six times x",
      status: "partial",
      templateIds: ["rule-pattern-term"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. rule-pattern-term finds one later term of a rule by entry; completing a table of inputs and outputs by drag and drop has no multi-part family.",
    },
    {
      item: { number: "33", page: "rationale PDF p.34" },
      responseFormat: "choice",
      standards: ["TEKS.5.3.8.C"],
      archetypeIds: ["data.table-to-graph"],
      demand: "Choose the graph that plots the three pairs in a table",
      status: "covered",
      templateIds: [
        "first-quadrant-locate",
        "first-quadrant-coordinates",
        "graph-of-paired-values",
      ],
      limitations:
        "graph-of-paired-values (figure-choice-v1), table format: the graph that plots every pair of a table of three to seven pairs, among graphs with swapped coordinates, mismatched columns, reversed y-values or a left-out pair.",
    },
    {
      item: { number: "34", page: "rationale PDF p.35" },
      responseFormat: "choice",
      standards: ["TEKS.5.2.3.D"],
      archetypeIds: ["number.decimal-model-operation"],
      demand:
        "Choose the hundredths model that shows seven tenths times seven tenths",
      status: "partial",
      templateIds: ["decimal-grid-read", "decimal-multiplication"],
      limitations:
        "decimal-grid-read names one shaded decimal and decimal-multiplication multiplies by entry; matching a model to a product equation is not practiced.",
    },
  ],
);
