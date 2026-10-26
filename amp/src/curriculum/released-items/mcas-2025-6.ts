import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 6 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. */
export const mcasGrade6 = defineLedger(
  {
    id: "mcas-2025-6",
    test: "MCAS grade 6 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g6-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017)",
    retrievedAt: "2026-10-26",
    sha256: "fcf2974638249a11b0f11a2b74ba9098a3b6ee76a7abb24114555a7114999fd2",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.NS.B.4"],
      archetypeIds: ["number.gcf"],
      demand: "Find the greatest common factor of two two-digit numbers",
      status: "covered",
      templateIds: ["greatest-common-factor"],
      limitations:
        "The family finds a greatest common factor of two whole numbers in a sharing story; the item's choices are plain numbers.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.EE.A.1"],
      archetypeIds: ["expression.whole-powers"],
      demand: "Choose the power that has a stated value",
      status: "partial",
      templateIds: ["power-missing-exponent", "power-repeated-product"],
      limitations:
        "power-missing-exponent finds an exponent by entry and power-repeated-product matches a power with a repeated product; choosing among four powers of the same base by their values is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.5; PDF p.7" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["6.RP.A.1"],
      archetypeIds: ["ratio.write-simplify"],
      demand:
        "Select the three true ratio statements among part-to-part, part-to-whole and whole-to-part comparisons of marbles",
      status: "covered",
      templateIds: ["mcas-ratio-statements-select"],
      limitations:
        "Three of six part-to-part, part-to-whole and whole-to-part ratio statements, including equal forms, are selected by multiple selection; ratio tables and written reasons are not assessed.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.NS.C.6"],
      archetypeIds: ["fractions.number-line"],
      demand: "Choose the number that a labeled point shows on a number line",
      status: "partial",
      templateIds: ["fraction-line-position"],
      limitations:
        "fraction-line-position reads a number at a point by entry from a labeled partition; signed positions and choices that are fractions of the item's partition are not established.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.6; PDF p.8" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["6.NS.B.2"],
      archetypeIds: ["equation.truth", "whole.divide-one-digit"],
      demand:
        "Select the two true division equations among five with multidigit dividends",
      status: "covered",
      templateIds: [
        "fl-equation-truth-mult-div",
        "divide-by-one-digit",
        "mcas-true-quotient-equations",
      ],
      limitations:
        "Two of five quotients with two-digit divisors and three- or four-digit dividends are judged true by multiple selection; division with remainders is not assessed.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed pp.7–8; PDF pp.9–10" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["6.EE.B.6"],
      archetypeIds: [
        "expression.verbal",
        "linear.context",
        "function.input-output",
      ],
      demand:
        "Cost of a number of boxes, an expression in c, an expression with a coupon and the boxes bought for a stated budget",
      status: "partial",
      templateIds: ["two-step-equation-model", "substitute-linear-expression"],
      limitations:
        "Constructed response in four parts. Equation choice for a story and substitution into an expression are practiced; writing an expression with a variable and solving for the boxes with a one-time coupon, with shown work, are not.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed p.9; PDF p.11" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.RP.A.3"],
      archetypeIds: ["measure.volume", "ratio.proportion"],
      demand:
        "Decide which cut block could not have half the mass of a rectangular block",
      status: "partial",
      templateIds: ["prism-volume-edges", "density-context"],
      limitations:
        "prism-volume-edges finds a volume and density-context relates mass to volume; comparing the volumes of four cut shapes with half the original to rule one out is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.10; PDF p.12" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.SP.A.1"],
      archetypeIds: ["study.statistical-question"],
      demand:
        "Choose the question that expects varying answers about a school play",
      status: "covered",
      templateIds: ["statistical-question-choice"],
      limitations:
        "The family chooses the question that anticipates variability.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.10; PDF p.12" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.EE.A.2"],
      archetypeIds: ["expression.description-match"],
      demand:
        "Choose the words equal to an expression with a product and a difference of a variable",
      status: "partial",
      templateIds: ["fl-expression-description-match"],
      limitations:
        "fl-expression-description-match matches numeric expressions with their descriptions; an expression with a variable is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.G.A.4"],
      archetypeIds: ["measure.surface"],
      demand: "Find the surface area of a triangular prism from its net",
      status: "covered",
      templateIds: ["net-surface-area"],
      limitations:
        "The family finds the surface area of a prism, including triangular prisms, from its net.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.14; PDF p.16" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.NS.C.8"],
      archetypeIds: ["coordinate.plane-point", "coordinate.distance-midpoint"],
      demand: "Choose the point exactly four units from a plotted point",
      status: "partial",
      templateIds: ["coordinate-distance"],
      limitations:
        "coordinate-distance finds the distance between two listed points; choosing a point at a stated distance on one axis direction is the reverse and is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.15; PDF p.17" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["6.SP.B.5"],
      archetypeIds: ["univariate.displays"],
      demand: "Total the students shown in a histogram",
      status: "partial",
      templateIds: ["histogram-read"],
      limitations:
        "histogram-read counts the observations at or above a stated value; totaling every bar of a histogram is not verified.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed pp.16–17; PDF pp.18–19" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["6.RP.A.3"],
      archetypeIds: ["number.percent-fraction-decimal", "percent.of"],
      demand:
        "Rename a percent as a fraction, find a percent of 50 states, a new percent and the states needed to reach a target",
      status: "partial",
      templateIds: ["percent-of"],
      limitations:
        "Constructed response in four parts with shown work. percent-of finds a percent of a quantity; renaming 30% as a fraction, finding what percent a count is of fifty and working backward to a target are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed p.18; PDF p.20" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.NS.A.1"],
      archetypeIds: ["fractions.divide"],
      demand: "Find an expression equal to a fraction divided by a fraction",
      status: "covered",
      templateIds: ["divide-fractions"],
      limitations:
        "The family divides fractions and mixed numbers by entry; the item's choices are fractions and mixed numbers.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.19; PDF p.21" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["6.G.A.3"],
      archetypeIds: ["coordinate.polygon-measure"],
      demand: "Find a rectangle side length from three plotted vertices",
      status: "partial",
      templateIds: ["coordinate-rectangle-measure", "coordinate-side-length"],
      limitations:
        "Both families find a side from listed vertex coordinates; reading plotted points and locating the fourth vertex of a rectangle is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed p.20; PDF p.22" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["6.NS.C.7"],
      archetypeIds: ["rational.order-absolute", "inequality.solution-set"],
      demand: "Give any rational number between two stated bounds",
      status: "partial",
      templateIds: ["signed-context-order"],
      limitations:
        "signed-context-order orders signed numbers; writing any value in an open interval has many correct answers that the numeric protocol does not grade.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed p.21; PDF p.23" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.EE.C.9"],
      archetypeIds: ["function.relation-equation", "function.linear-test"],
      demand:
        "Choose the true statement about miles from a distance equation and then the equation for a new rate",
      status: "partial",
      templateIds: ["dependent-variable-equation", "proportional-rule-choice"],
      limitations:
        "dependent-variable-equation chooses the equation for a context; judging pairs of values from a stated equation and the linked second part are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["6.SP.A.2"],
      archetypeIds: ["univariate.center", "univariate.spread"],
      demand:
        "Choose the statement that correctly gives two summaries of ten game scores",
      status: "partial",
      templateIds: ["mean-data", "median-data", "range-data"],
      limitations:
        "The families find a mean, median or range by entry; the mode and checking two stated summaries together are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.22; PDF p.24" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["6.G.A.2"],
      archetypeIds: ["measure.fraction-volume"],
      demand:
        "Select the two true statements about the edges and volume of a prism built from cubes with a fractional edge",
      status: "partial",
      templateIds: [
        "unit-fraction-cube-packing",
        "fraction-edge-volume",
        "mcas-cube-prism-statements",
      ],
      limitations:
        "Statements about cubes, count and volume of a prism packed with unit-fraction cubes are selected from stated edge lengths; the released item draws the prism built from cubes and asks for its measured dimensions, so reading edge lengths from counted cubes is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.23; PDF p.25" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["6.SP.A.1"],
      archetypeIds: ["study.statistical-question"],
      demand:
        "Select the three statistical questions among five about a theater",
      status: "covered",
      templateIds: [
        "statistical-question-choice",
        "mcas-statistical-question-select",
      ],
      limitations:
        "Three of five questions about one setting are selected as statistical by multiple selection; writing a statistical question is not assessed.",
    },
  ],
);
