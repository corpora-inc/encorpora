import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 7 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. */
export const mcasGrade7 = defineLedger(
  {
    id: "mcas-2025-7",
    test: "MCAS grade 7 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g7-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017). Calculator permitted in Session 2 only.",
    retrievedAt: "2026-10-26",
    sha256: "ea7a1f2774b7f6f202f2de6102655ae77457b30c93614105853f4e1b77a33e14",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.G.B.4"],
      archetypeIds: ["circle.parts"],
      demand:
        "Give the distance from a circle's center to a point on the circle from its radius",
      status: "covered",
      templateIds: ["mcas-circle-radius-distance"],
      limitations:
        "The distance from a circle's center to a point on it is chosen from the radius, the diameter or the circumference; chords and tangents are not assessed.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.RP.A.2"],
      archetypeIds: [
        "function.proportional-identify",
        "function.linear-test",
        "ratio.proportion",
      ],
      demand: "Choose the table that shows a proportional relationship",
      status: "partial",
      templateIds: ["proportional-rule-choice", "ratio-table-missing"],
      limitations:
        "proportional-rule-choice judges rules and ratio-table-missing completes a table of equivalent ratios; deciding from four unit-labeled tables which has a constant ratio is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.NS.A.2"],
      archetypeIds: [
        "number.rational-operations",
        "decimal.divide",
        "rational.signed-multiply",
      ],
      demand: "Divide a negative decimal by a positive decimal",
      status: "covered",
      templateIds: ["multidigit-decimal-quotient", "signed-fraction-product"],
      limitations:
        "multidigit-decimal-quotient with sign=negative-dividend divides a negative decimal by a positive decimal, and sign=negative-divisor and both-negative vary the signs; the quotient is entered as a signed decimal.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.EE.B.4"],
      archetypeIds: ["sequence.geometric"],
      demand:
        "Find the sixth number of a pattern that divides by four each time",
      status: "covered",
      templateIds: ["geometric-sequence"],
      limitations:
        "geometric-sequence with ratio-form=divide-whole starts at a stated number and divides by a whole number for each step to a stated term, with every term a whole number.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed pp.8–9; PDF pp.10–11" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["7.SP.C.8"],
      archetypeIds: [
        "probability.compound-event",
        "probability.independent",
        "probability.addition-rule",
      ],
      demand:
        "Find single and compound probabilities for two spinners, list all outcomes and find an and probability and an or probability",
      status: "partial",
      templateIds: [
        "compound-event-simulation",
        "independent-events-probability",
        "addition-rule-probability",
      ],
      limitations:
        "Constructed response in four parts. Compound-event, independent and addition-rule probabilities are practiced by entry; listing an organized sample space and explaining the work are not.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed p.10; PDF p.12" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.NS.A.1"],
      archetypeIds: ["rational.signed-context"],
      demand:
        "Choose the number line that shows the value of a decimal minus a larger whole number",
      status: "partial",
      templateIds: ["signed-jumps"],
      limitations:
        "signed-jumps finds the end point of signed changes by entry; choosing the drawn number line that marks the value is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.EE.B.3"],
      archetypeIds: ["percent.of", "ratio.proportion"],
      demand:
        "Find a percent of a mixed amount of trail mix and judge statements about the other fractions of it, in two linked parts",
      status: "partial",
      templateIds: ["percent-of", "fraction-of-quantity"],
      limitations:
        "Percent-of and fraction-of-quantity are practiced by entry; the statement choice about several ingredient amounts and the linked two-part scoring are not.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.12; PDF p.14" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["7.RP.A.1"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Find the unit rate of a leak measured in fractions of liters and hours",
      status: "covered",
      templateIds: ["fraction-unit-rate"],
      limitations:
        "The family finds a unit rate from a ratio of fractions; the item's choices are fractions and mixed numbers.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.13; PDF p.15" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["7.RP.A.1"],
      archetypeIds: ["ratio.proportion"],
      demand:
        "Select the three true rates in miles per hour from fractional distances and times on three days",
      status: "covered",
      templateIds: ["fraction-unit-rate", "mcas-fraction-rate-select"],
      limitations:
        "Three of six stated speeds from fractional distances and times over three days are selected by multiple selection; unit conversion is not assessed.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.14; PDF p.16" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["7.NS.A.2"],
      archetypeIds: ["rational.negative-fraction-forms"],
      demand:
        "Select the three expressions equal to a negative improper fraction among six placements of the sign",
      status: "covered",
      templateIds: ["mcas-negative-fraction-forms"],
      limitations:
        "Three of six placements of negative signs equal to a stated negative improper fraction are selected by multiple selection; operations with signed fractions are not assessed.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.17; PDF p.19" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.RP.A.2"],
      archetypeIds: ["function.graph-context"],
      demand:
        "Interpret a point of a proportional graph of paint amounts as a rate",
      status: "covered",
      templateIds: ["proportional-graph"],
      limitations:
        "The family chooses what a labeled point of a proportional graph means in its context.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.18; PDF p.20" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.EE.A.2"],
      archetypeIds: ["percent.change", "expression.verbal"],
      demand:
        "Choose the expression for a price that is 0.65 of the cost, written as a decrease",
      status: "partial",
      templateIds: ["percent-change-final"],
      limitations:
        "percent-change-final finds a changed value by entry; choosing the algebraic expression for a decreased quantity is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed p.18; PDF p.20" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.SP.A.1"],
      archetypeIds: ["study.scope"],
      demand:
        "Choose the survey sample that best represents gas stations across a state",
      status: "covered",
      templateIds: ["representative-sample-choice"],
      limitations:
        "The family chooses the sampling method most likely to give a representative sample.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed p.18; PDF p.20" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.EE.A.1"],
      archetypeIds: ["expression.polynomial"],
      demand:
        "Choose the expression equivalent to a linear expression by factoring out a number",
      status: "partial",
      templateIds: [
        "distributive-expression-choice",
        "equivalent-expressions-check",
      ],
      limitations:
        "Related families expand or combine linear expressions; the reverse, recognizing a common factor, is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.NS.A.3"],
      archetypeIds: ["ratio.units"],
      demand:
        "Convert meters to centimeters and divide to count bows from a ribbon",
      status: "covered",
      templateIds: ["unit-chain-conversion", "conversion-chain-story"],
      limitations:
        "conversion-chain-story (cut-pieces) converts meters to centimeters and counts the whole pieces that can be cut; choices are plain numbers, so numeric entry fits.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.EE.B.4"],
      archetypeIds: ["inequality.context"],
      demand:
        "Choose the inequality of the form px + q at most r for a sample-collection limit",
      status: "partial",
      templateIds: ["inequality-from-context"],
      limitations:
        "inequality-from-context chooses a one-variable bound; a two-term inequality with a fixed amount and a per-item amount is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed pp.20–21; PDF pp.22–23" },
      responseFormat: "constructed",
      calculator: "permitted",
      standards: ["7.G.A.1"],
      archetypeIds: ["measure.scale"],
      demand:
        "Use a scale to find the length and area of a floor and a new scale from a second drawing, showing the work",
      status: "covered",
      templateIds: ["scale-drawing", "scale-drawing-work"],
      limitations:
        'scale-drawing-work (structured-work-v1) enters the four parts as labeled exact steps: the actual length from a drawing in centimeters at a scale in feet per centimeter, the actual area of the rectangle, the scale of a second drawing from its length (feet per inch) and that drawing\'s width in inches. The "show or explain" parts are credited by these calculations; a written explanation in words is not scored. The scale of the new drawing is the single value from the drawn length, where the item accepts any consistent scale.',
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.SP.A.2"],
      archetypeIds: ["inference.estimate"],
      demand:
        "Estimate the number of college students who prefer digital magazines from a random sample",
      status: "covered",
      templateIds: ["sample-proportion-estimate"],
      limitations:
        "The family scales a sample proportion to a stated population.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.23; PDF p.25" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["7.NS.A.3"],
      archetypeIds: ["number.percent-fraction-decimal", "percent.of"],
      demand:
        "Find the percent of a jar of beads that is green from the fraction that is blue",
      status: "partial",
      templateIds: ["percent-of"],
      limitations:
        "percent-of finds a percent of a quantity; renaming a fraction of a set as a percent and taking the remainder is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.23; PDF p.25" },
      responseFormat: "multi-select",
      calculator: "permitted",
      standards: ["7.RP.A.3"],
      archetypeIds: ["percent.change"],
      demand:
        "Select the two true selling prices when a price is forty percent more than cost",
      status: "covered",
      templateIds: ["percent-change-final", "mcas-markup-price-select"],
      limitations:
        "Two of five selling prices after a stated percent above or below cost are selected by multiple selection; finding the percent or the original cost is not assessed.",
    },
  ],
);
