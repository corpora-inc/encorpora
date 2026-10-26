import { defineLedger } from "./types";

/** Every released mathematics item (20 of the 40 operational items) of the Spring 2025 MCAS Grade 8 paper-based test, labeled once from the form and its released-item table. The Department states each item's standard, item type and, for selected-response and short-answer items, the answer. The earlier purposive sample of items 1, 2, 10, 16 and 19 is folded into this complete record. */
export const mcasGrade8 = defineLedger(
  {
    id: "mcas-2025-8",
    test: "MCAS grade 8 mathematics",
    form: "Spring 2025 released items",
    url: "https://www.doe.mass.edu/mcas/2025/release/g8-math.pdf",
    edition:
      "Spring 2025 paper-based test, released operational items 1-20 of 40; standards, item types and answers as printed in the released-item table (Massachusetts Curriculum Framework for Mathematics, 2017). Calculator permitted in Session 2 only. Replaces the earlier five-item purposive sample of the same form.",
    retrievedAt: "2026-10-26",
    sha256: "7dbfcaac5ce7cc01b69b905c2991d6c64c2f9c3266238ec96849d95075ec1ddf",
    complete: true,
  },
  { labeledBy: "agent:mcas-first-pass", labeledAt: "2026-10-26" },
  [
    {
      section: "Session 1",
      item: { number: "1", page: "printed p.5; PDF p.7" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.EE.C.8"],
      archetypeIds: ["system.solve"],
      demand: "Choose the solution of a system with one equation solved for y",
      status: "partial",
      templateIds: ["linear-system-pair"],
      limitations:
        "linear-system-pair chooses the ordered pair satisfying two standard-form equations; a system whose first equation is already solved for y and whose second has negative coefficients is not verified in the checked samples.",
    },
    {
      section: "Session 1",
      item: { number: "2", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.F.A.1"],
      archetypeIds: ["function.point-removal", "function.identify"],
      demand:
        "Choose the plotted point whose removal makes a relation a function",
      status: "covered",
      templateIds: ["relation-function-choice", "relation-point-removal"],
      limitations:
        "The plotted task selects one choice naming every valid single-point removal. Direct point removal, native multiple selection and constructed justification are unassessed.",
    },
    {
      section: "Session 1",
      item: { number: "3", page: "printed p.6; PDF p.8" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.EE.A.1"],
      archetypeIds: ["expression.exponent-rules"],
      demand: "Choose the power equivalent to a negative power of five",
      status: "partial",
      templateIds: ["negative-integer-power", "power-of-power-exponent"],
      limitations:
        "negative-integer-power evaluates a negative power and power-of-power-exponent finds an exponent by entry; choosing an equivalent power expression for a negative power is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "4", page: "printed p.7; PDF p.9" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.F.B.4"],
      archetypeIds: ["function.rule"],
      demand:
        "Choose the equation for the cost of a shirt with a per-letter charge",
      status: "covered",
      templateIds: ["linear-model-equation"],
      limitations:
        "The family chooses the equation separating a starting amount from a rate.",
    },
    {
      section: "Session 1",
      item: { number: "5", page: "printed p.7; PDF p.9" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["8.NS.A.1"],
      archetypeIds: ["number.rational-irrational"],
      demand: "Select the two rational numbers among five radical expressions",
      status: "partial",
      templateIds: ["classify-real-number"],
      limitations:
        "classify-real-number chooses one rational or irrational number; selecting two of five radical expressions by multiple selection is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "6", page: "printed pp.8–9; PDF pp.10–11" },
      responseFormat: "constructed",
      calculator: "not-permitted",
      standards: ["8.EE.A.4"],
      archetypeIds: [
        "number.scientific-notation",
        "number.scientific-operations",
      ],
      demand:
        "Write two animal weights in scientific notation, find how many times greater one is and find a total, showing the work",
      status: "partial",
      templateIds: ["standard-to-scientific", "scientific-operations"],
      limitations:
        "Constructed response in four parts. Choice questions on scientific notation and its operations exist; entering numbers written in scientific notation, explaining a quotient and a total in a story are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "7", page: "printed pp.10–11; PDF pp.12–13" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.G.A.2"],
      archetypeIds: ["transformation.invariants"],
      demand:
        "Judge the congruence of a rectangle and its reflection and name the transformation that does not preserve congruence, in two linked parts",
      status: "partial",
      templateIds: ["transformation-invariant-claims"],
      limitations:
        "The family decides which transformations preserve distance and angle; two linked parts scored together are not supported.",
    },
    {
      section: "Session 1",
      item: { number: "8", page: "printed p.12; PDF p.14" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["8.EE.A.3"],
      archetypeIds: ["number.scientific-notation"],
      demand:
        "Select the three true equations that rewrite a power of ten times two as a standard numeral",
      status: "partial",
      templateIds: ["scientific-to-standard"],
      limitations:
        "scientific-to-standard writes one numeral by entry; judging six stated equations by multiple selection is not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "9", page: "printed p.12; PDF p.14" },
      responseFormat: "multi-select",
      calculator: "not-permitted",
      standards: ["8.NS.A.2"],
      archetypeIds: ["number.approximate-roots"],
      demand:
        "Select the three true approximate values of points marked on a number line",
      status: "partial",
      templateIds: ["root-between-integers", "root-nearest-tenth"],
      limitations:
        "Both families bound or approximate one root by entry; reading marked irrational points and choosing three true statements are not practiced.",
    },
    {
      section: "Session 1",
      item: { number: "10", page: "printed p.13; PDF p.15" },
      responseFormat: "choice",
      calculator: "not-permitted",
      standards: ["8.SP.A.3"],
      archetypeIds: ["linear.meaning"],
      demand: "Interpret a model's intercept as the starting weight",
      status: "covered",
      templateIds: ["recover-linear-intercept", "linear-initial-value-meaning"],
      limitations:
        "Intercept calculation and one-choice interpretation of an explicitly stated linear model are assessed. Fitting a model from data, graph-only inference and constructed explanations remain unassessed.",
    },
    {
      section: "Session 2",
      item: { number: "11", page: "printed p.16; PDF p.18" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.EE.B.5"],
      archetypeIds: ["pattern.graph-relationship", "function.graph-context"],
      demand:
        "Choose the graph of a constant typing rate of forty words per minute",
      status: "partial",
      templateIds: ["graph-of-proportional-rate", "proportional-graph"],
      limitations:
        "graph-of-proportional-rate chooses among four drawn graphs for a stated unit rate from 2 to 4 on unit-scaled axes; a rate of 40 read on a y-axis scaled by forties is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "12", page: "printed p.17; PDF p.19" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.G.C.9"],
      archetypeIds: ["measure.volume"],
      demand:
        "Estimate the water needed to fill a cylindrical pool with pi taken as 3.14",
      status: "partial",
      templateIds: ["cylinder-volume"],
      limitations:
        "cylinder-volume finds a cylinder's volume as a multiple of pi by entry; a decimal approximation of pi and choices of nearest values are not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "13", page: "printed p.18; PDF p.20" },
      responseFormat: "multi-select",
      calculator: "permitted",
      standards: ["8.F.A.2"],
      archetypeIds: ["function.compare-representations"],
      demand:
        "Select the three tables whose y-intercept is less than that of a stated linear function",
      status: "partial",
      templateIds: ["compare-representations"],
      limitations:
        "compare-representations chooses one true statement comparing two functions; scanning six tables against a stated intercept by multiple selection is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "14", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.F.A.1"],
      archetypeIds: ["function.identify"],
      demand: "Choose the list of ordered pairs that could be a function",
      status: "covered",
      templateIds: ["relation-function-choice"],
      limitations:
        "The family chooses the list of pairs that represents a function.",
    },
    {
      section: "Session 2",
      item: { number: "15", page: "printed p.19; PDF p.21" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.F.B.5"],
      archetypeIds: ["function.graph-shape"],
      demand:
        "Choose the statement that describes a graph as linear or nonlinear and increasing",
      status: "missing",
      templateIds: [],
      limitations:
        "No family classifies a graph as linear or nonlinear and increasing or decreasing from its shape.",
    },
    {
      section: "Session 2",
      item: { number: "16", page: "printed pp.20–21; PDF pp.22–23" },
      responseFormat: "constructed",
      calculator: "permitted",
      standards: ["8.G.A.1"],
      archetypeIds: [
        "triangle.congruence-transformations",
        "transformation.identify",
      ],
      demand:
        "Name the center of a half-turn, give congruent parts of a quadrilateral and its image and describe transformations back to the original",
      status: "partial",
      templateIds: ["identify-rigid-motion", "transformation-sequence-mapping"],
      limitations:
        "Constructed response in four parts with explanations. Related families identify a single rigid motion and the sequence that maps one figure onto another from listed vertices; finding a rotation's center from a graph, naming congruent parts with reasons and writing the sequence have no protocol.",
    },
    {
      section: "Session 2",
      item: { number: "17", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.G.B.6"],
      archetypeIds: ["triangle.pythagorean"],
      demand: "Choose the set of side lengths that could form a right triangle",
      status: "partial",
      templateIds: ["pythagorean-converse"],
      limitations:
        "pythagorean-converse decides whether one triple is a right triangle; selecting the one right triple of four is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "18", page: "printed p.22; PDF p.24" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.SP.A.2"],
      archetypeIds: ["bivariate.scatter", "bivariate.linear-fit"],
      demand:
        "Choose the statement that justifies a line of best fit and the association shown",
      status: "partial",
      templateIds: ["scatter-association-choice", "trend-line-predict"],
      limitations:
        "scatter-association-choice describes association and trend-line-predict predicts from a drawn line; judging where a line falls among the points is not practiced.",
    },
    {
      section: "Session 2",
      item: { number: "19", page: "printed p.23; PDF p.25" },
      responseFormat: "multi-select",
      calculator: "permitted",
      standards: ["8.EE.B.6"],
      archetypeIds: ["line.slope-triangles"],
      demand: "Relate similar triangles to equal slopes",
      status: "covered",
      templateIds: ["slope-triangle-statements"],
      limitations:
        "Original three-of-six statement selections compare right triangles on one nonvertical line, including matching angles, similarity versus congruence, lengths and equal signed slopes. Constructed proofs, arbitrary orientations and full 8.EE.B.6 coverage are not established. This occurrence does not estimate frequency.",
    },
    {
      section: "Session 2",
      item: { number: "20", page: "printed p.24; PDF p.26" },
      responseFormat: "choice",
      calculator: "permitted",
      standards: ["8.G.B.8"],
      archetypeIds: ["triangle.pythagorean", "coordinate.distance-midpoint"],
      demand:
        "Choose the graph whose three points form a right triangle with hypotenuse ten",
      status: "partial",
      templateIds: ["coordinate-distance"],
      limitations:
        "coordinate-distance finds the distance between two listed points; reading three plotted points and checking for a right angle with a hypotenuse of ten is not practiced.",
    },
  ],
);
