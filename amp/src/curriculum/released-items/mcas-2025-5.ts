import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 5 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. The earlier purposive sample of items 1, 4, 8, 9 and 19 is folded into this complete record. */
export const mcasGrade5 = defineLedger(
  {
    id: "mcas-2025-5",
    test: "MCAS grade 5 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g5-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017). Replaces the earlier five-item purposive sample of the same form.",
    retrievedAt: "2026-10-26",
    sha256: "6dedef5ac359436a52c8a110f97c2be202085f51761973df61d3570db686a801",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NBT.B.5"],
      archetypeIds: ["number.multidigit-multiply-context"],
      demand: "Multiply a three-digit ticket count by a two-digit price",
      status: "covered",
      templateIds: ["multiply-multidigit"],
      limitations:
        "The family multiplies multidigit whole numbers; the item's choices are plain numbers.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.MD.C.4"],
      archetypeIds: ["measure.unit-cube-volume"],
      demand: "Count the unit cubes that make up a drawn figure",
      status: "partial",
      templateIds: ["unit-cube-volume", "cube-layer-count"],
      limitations:
        "unit-cube-volume counts the cubes of a rectangular prism by entry; a figure that is not a full prism with counts in the choices of 22 to 40 cubes is not established.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.OA.B.3"],
      archetypeIds: [
        "pattern.paired",
        "data.table-to-graph",
        "coordinate.first-quadrant",
      ],
      demand:
        "Choose the coordinate plane that shows the ordered pair of the fifth terms of two patterns",
      status: "partial",
      templateIds: ["first-quadrant-locate", "pattern-pair-relationship"],
      limitations:
        "first-quadrant-locate finds the point at a stated pair and pattern-pair-relationship relates two patterns; extending two patterns to a fifth pair and choosing among four drawn planes is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NBT.A.4"],
      archetypeIds: ["number.inverse-rounding", "number.round-decimal"],
      demand:
        "Choose the decimal that rounds to a stated mass to the nearest hundredth",
      status: "covered",
      templateIds: ["round-decimal", "inverse-round-decimal"],
      limitations:
        "One-choice inverse rounding to a tenth or hundredth with half-up boundaries; general inverse intervals and multiple selection are not assessed.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NBT.A.1"],
      archetypeIds: ["number.place-value-ratio"],
      demand: "Compare the value of a digit in two decimals as a multiple",
      status: "covered",
      templateIds: ["digit-value-ratio"],
      limitations:
        "The family finds how many times as much one digit is worth as another; the item's choices are plain numbers.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed p.8; PDF p.10" },
      responseFormat: "numeric",
      calculator: "not-permitted",
      standards: ["5.NBT.B.6"],
      archetypeIds: ["whole.divide-two-digit"],
      demand: "Divide a three-digit number by a two-digit divisor",
      status: "covered",
      templateIds: ["divide-by-two-digit"],
      limitations:
        "The family divides three- and four-digit dividends by two-digit divisors by entry.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed pp.9–10; PDF pp.11–12" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["5.MD.A.1"],
      archetypeIds: ["measure.customary-units", "measure.mixed-units"],
      demand:
        "Convert yards, feet and inches in a wire table and add or subtract lengths with fractional feet, showing the work",
      status: "partial",
      templateIds: ["customary-unit-rename", "customary-mixed-units"],
      limitations:
        "Constructed response in four parts. Customary renaming and mixed-unit sums are practiced; comparing a combined length with a target and choosing wire pieces that total a mixed-number length, with explanations, are not.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.11; PDF p.13" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["5.G.B.4"],
      archetypeIds: ["shape.quadrilateral-hierarchy"],
      demand: "Select three true statements about quadrilateral categories",
      status: "covered",
      templateIds: [
        "classify-quadrilateral",
        "quadrilateral-hierarchy-multiselect",
      ],
      limitations:
        "Original items select three true statements from five or six choices, including the released three-of-six format. Drawing a hierarchy, counterexamples and written justification are unassessed.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NF.B.3"],
      archetypeIds: ["number.fraction-as-division"],
      demand: "Recognize a fraction as a whole-number division",
      status: "covered",
      templateIds: ["whole-sharing-fraction", "fraction-division-expression"],
      limitations:
        "Numeric sharing and one-choice recognition of a fraction as a division expression are assessed; constructing an expression and explaining a model are not.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.11; PDF p.13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.OA.A.2"],
      archetypeIds: ["expression.numerical-structure"],
      demand:
        "Choose the statement that describes a parenthesized product without evaluating it",
      status: "missing",
      templateIds: [],
      limitations:
        "No family asks which times-as-large statement describes the value of a parenthesized expression; fl-expression-description-match matches an expression with its words only.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.14; PDF p.16" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NBT.B.6"],
      archetypeIds: ["whole.divide-two-digit"],
      demand: "Divide a four-digit savings goal over twelve months",
      status: "covered",
      templateIds: ["divide-by-two-digit"],
      limitations:
        "The family divides four-digit dividends by two-digit divisors; the story wrapper does not change the task.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.14; PDF p.16" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.OA.A.2"],
      archetypeIds: ["expression.description-match"],
      demand:
        "Choose the words that describe a numerical expression with a product and a difference",
      status: "covered",
      templateIds: ["fl-expression-description-match"],
      limitations:
        "The family matches an expression with its verbal description among near-miss descriptions.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed p.15; PDF p.17" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.OA.B.3"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Choose how matching terms of two patterns with stated rules and starts are related",
      status: "covered",
      templateIds: ["pattern-pair-relationship"],
      limitations:
        "The family relates the terms of two patterns given their rules and starts, as a multiple or a sum.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed pp.16–17; PDF pp.18–19" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["5.NF.B.5"],
      archetypeIds: ["fractions.multiply-scaling"],
      demand:
        "Choose a product greater than a factor, find factors giving a product equal to a factor, and explain how factor size predicts product size, with two fractions to write",
      status: "missing",
      templateIds: [],
      limitations:
        "Constructed response in four parts. No family asks whether a product is larger or smaller than a factor from the other factor's size, and written explanations have no protocol.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.18; PDF p.20" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["5.MD.C.5"],
      archetypeIds: ["measure.volume"],
      demand:
        "Select the two prisms whose combined volume falls in a stated range",
      status: "partial",
      templateIds: ["composite-prism-volume", "prism-volume-edges"],
      limitations:
        "composite-prism-volume and prism-volume-edges find volumes by entry; choosing two of five prisms by multiple selection from a range is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.G.B.4"],
      archetypeIds: ["angle.classify"],
      demand:
        "Choose the true statement about which angle types a triangle can have",
      status: "partial",
      templateIds: ["classify-triangle-angles"],
      limitations:
        "classify-triangle-angles names the type of one drawn triangle; deciding which combinations of angle types a triangle can have is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NF.B.4"],
      archetypeIds: ["fractions.multiply", "measure.area"],
      demand: "Find the area of a rectangle with two fractional side lengths",
      status: "partial",
      templateIds: ["multiply-fractions"],
      limitations:
        "multiply-fractions multiplies two proper fractions by entry; the area-of-a-rectangle context with unit squares in the choices is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.20; PDF p.22" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.G.A.2"],
      archetypeIds: ["coordinate.first-quadrant"],
      demand: "Choose the labeled point at a stated ordered pair",
      status: "covered",
      templateIds: ["first-quadrant-locate"],
      limitations:
        "The family finds the labeled point at a stated first-quadrant ordered pair.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.21; PDF p.23" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["5.NBT.A.3"],
      archetypeIds: ["number.decimal-expanded-compare"],
      demand:
        "Pick the expanded forms of two close decimals and the true comparisons, two selections each",
      status: "partial",
      templateIds: ["expanded-decimal", "compare-decimals-thousandths"],
      limitations:
        "Components exist; two-part multiple selection with linked scoring is unassessed.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["5.NF.B.7"],
      archetypeIds: ["fractions.divide-context", "fractions.divide"],
      demand: "Divide a whole number by a unit fraction in an expression",
      status: "partial",
      templateIds: ["whole-unit-groups", "divide-fractions"],
      limitations:
        "whole-unit-groups counts unit-fraction containers in a story and divide-fractions divides two fractions; a bare whole number divided by a unit fraction as an expression is not practiced.",
    },
  ],
);
