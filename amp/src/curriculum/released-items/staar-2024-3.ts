import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2024 STAAR Grade 3 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2024 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staar2024Grade3 = defineLedger(
  {
    id: "staar-2024-3",
    test: "STAAR Grade 3 mathematics",
    form: "Spring 2024 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-3-math-rationale.pdf",
    edition:
      "Spring 2024 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "77b877b36efdec2471fc181c62c7c1f6c68199eb52e29adb711b75ac48ed54fe",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2024-staar-3-math-answer-key.pdf",
        sha256:
          "d4eda6113f6152faa7d2cf320e517dab79521b3fad04979670c64975b4476440",
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
      standards: ["TEKS.3.2.4.A"],
      archetypeIds: ["whole.add-subtract-1000"],
      demand:
        "Subtract a smaller amount from a three-digit total in a sales story",
      status: "partial",
      templateIds: ["subtract-three-digit"],
      limitations:
        "subtract-three-digit practices the regrouped subtraction as a bare computation; no family sets a one-step subtraction in a story where the learner must choose the operation.",
    },
    {
      item: { number: "2", page: "rationale PDF p.2" },
      responseFormat: "choice",
      standards: ["TEKS.3.1.2.D"],
      archetypeIds: ["place.compare-whole"],
      demand:
        "Identify the five-digit number that fits three comparison and digit clues",
      status: "partial",
      templateIds: ["compare-multidigit"],
      limitations:
        "compare-multidigit picks the greater or lesser of two numbers; no family narrows a number by two comparisons with others and a digit clue.",
    },
    {
      item: { number: "3", page: "rationale PDF p.3" },
      responseFormat: "other",
      standards: ["TEKS.3.4.8.A"],
      archetypeIds: ["data.graph-error", "univariate.displays"],
      demand:
        "Find the value where a dot plot's dot count disagrees with a list of ten rolls and say how many dots it needs",
      status: "partial",
      templateIds: ["staar-dot-plot-threshold"],
      limitations:
        "STAAR interaction: inline choice, 2 points. staar-dot-plot-threshold reads counts from a dot plot; no family checks a plot against a listed data set, and the answer is two dropdown blanks.",
    },
    {
      item: { number: "4", page: "rationale PDF p.4" },
      responseFormat: "choice",
      standards: ["TEKS.3.1.2.B"],
      archetypeIds: ["number.place-value-ratio"],
      demand:
        "Say how many times as great one place is than another place holding the same digit",
      status: "partial",
      templateIds: ["digit-value-ratio"],
      limitations:
        "digit-value-ratio asks for the factor as a number; the item's choices are statements about greater value, so a numeric family does not serve them.",
    },
    {
      item: { number: "5", page: "rationale PDF p.5" },
      responseFormat: "choice",
      standards: ["TEKS.3.4.9.B"],
      archetypeIds: ["finance.supply-price"],
      demand:
        "Decide whether a price rises or falls when a product is scarce or plentiful and give the reason",
      status: "covered",
      templateIds: ["supply-price-choice"],
      limitations:
        "supply-price-choice chooses the direction of the price and the reason for a scarce or plentiful product, with the amount for sale and the number of buyers stated.",
    },
    {
      item: { number: "6", page: "rationale PDF p.6" },
      responseFormat: "choice",
      standards: ["TEKS.3.3.7.B"],
      archetypeIds: ["measure.area"],
      demand: "Find which of five labeled figures have a stated perimeter",
      status: "partial",
      templateIds: ["rectangle-border-length"],
      limitations:
        "rectangle-border-length finds the perimeter of a rectangle; the figures here include a triangle and a hexagon and the answer is a set of figures.",
    },
    {
      item: { number: "7", page: "rationale PDF p.7" },
      responseFormat: "multi-select",
      standards: ["TEKS.3.2.5.A"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Select the two number sentences that can find the part of a trip already traveled",
      status: "partial",
      templateIds: ["staar-story-model-choice"],
      limitations:
        "STAAR interaction: multiselect, 2 points. staar-story-model-choice picks one equation for a story; none takes a two-answer selection or related addition and subtraction forms of one story.",
    },
    {
      item: { number: "8", page: "rationale PDF p.9" },
      responseFormat: "choice",
      standards: ["TEKS.3.1.2.C"],
      archetypeIds: ["number.number-line-position"],
      demand:
        "Pick the number a point could name when it is past the halfway mark of a hundred-wide number line interval",
      status: "covered",
      templateIds: ["number-line-between-hundreds"],
      limitations:
        "number-line-between-hundreds names the number a point shows on a line between neighboring hundreds or thousands with ticks of 10 and a labeled halfway mark; the point is on a tick mark.",
    },
    {
      item: { number: "9", page: "rationale PDF p.10" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.E"],
      archetypeIds: ["whole.multiplicative-stories"],
      demand:
        "Choose the equation that cannot find the total of ten jumps of four",
      status: "partial",
      templateIds: ["story-operation-choice"],
      limitations:
        "story-operation-choice chooses the equation that models a story; recognizing a product written as repeated multiplication of a different factor as invalid is not practiced.",
    },
    {
      item: { number: "10", page: "rationale PDF p.11" },
      responseFormat: "other",
      standards: ["TEKS.3.1.3.C"],
      archetypeIds: ["fractions.equal-shares", "fractions.model"],
      demand:
        "Say whether a unit fraction claim for a model is correct and why when the parts are unequal",
      status: "partial",
      templateIds: ["find-equal-shares", "fraction-model"],
      limitations:
        "STAAR interaction: inline choice, 1 point. find-equal-shares tells equal from unequal parts for halves to fourths and fraction-model names a shaded part; neither judges a claim about seven parts, and the answer is two dropdown blanks.",
    },
    {
      item: { number: "11", page: "rationale PDF p.12" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.D"],
      archetypeIds: ["whole.multiplication-facts"],
      demand:
        "Find the total squares on a game board of eight rows of eight when part of it is shown",
      status: "covered",
      templateIds: ["multiply-facts", "equal-tray-total"],
      limitations:
        "multiply-facts finds a total from equal rows in a partly covered array with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "12", page: "rationale PDF p.13" },
      responseFormat: "choice",
      standards: ["TEKS.3.3.6.B"],
      archetypeIds: ["shape.attributes"],
      demand:
        "Choose the description of the quadrilateral pieces in a puzzle of triangles and four-sided pieces",
      status: "partial",
      templateIds: ["name-polygon"],
      limitations:
        "name-polygon names one polygon by its sides; no family picks the pieces of a mixed collection that have four sides.",
    },
    {
      item: { number: "13", page: "rationale PDF p.14" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.E"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Choose the rule that relates pounds of meat to burritos in a table of pairs",
      status: "partial",
      templateIds: ["staar-table-rule-choice", "pattern-pair-relationship"],
      limitations:
        "staar-table-rule-choice chooses the table that follows a stated rule; the item gives the table and asks for the rule, in the reverse direction.",
    },
    {
      item: { number: "14", page: "rationale PDF p.15" },
      responseFormat: "choice",
      standards: ["TEKS.3.4.8.B"],
      archetypeIds: ["univariate.displays"],
      demand:
        "Find the miles on the sixth day from a dot plot of five days and the total",
      status: "partial",
      templateIds: ["staar-dot-plot-threshold"],
      limitations:
        "staar-dot-plot-threshold counts dots; no family adds the values of the dots and subtracts from a total.",
    },
    {
      item: { number: "15", page: "rationale PDF p.16" },
      responseFormat: "graph/drag",
      standards: ["TEKS.3.2.5.B"],
      archetypeIds: ["expression.multistep-equations"],
      demand:
        "Drag the operations that make an equation for the total of courts, bags and balls",
      status: "covered",
      templateIds: ["story-operations-slots", "story-operation-choice"],
      limitations:
        "story-operations-slots chooses the operations of an equation for equal groups plus extras, groups less some removed, or three factors; one choice gives the total. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "16", page: "rationale PDF p.17" },
      responseFormat: "choice",
      standards: ["TEKS.3.3.6.E"],
      archetypeIds: ["shape.congruent-equal-parts"],
      demand:
        "Pick the pair of congruent figures that each show one fourth shaded",
      status: "covered",
      templateIds: ["congruent-fourths-pair"],
      limitations:
        "congruent-fourths-pair picks the two same-size figures that each show one fourth shaded when the figures are cut in different ways, against thirds, two fourths and unequal parts.",
    },
    {
      item: { number: "17", page: "rationale PDF p.18" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.B"],
      archetypeIds: ["number.estimate"],
      demand:
        "Estimate a three-day total of miles by rounding each distance to the nearest ten",
      status: "partial",
      templateIds: ["estimate-reasonableness", "round-to-ten"],
      limitations:
        "round-to-ten rounds one number and estimate-reasonableness estimates a product or two-step total; no family adds three addends rounded to tens.",
    },
    {
      item: { number: "18", page: "rationale PDF p.19" },
      responseFormat: "choice",
      standards: ["TEKS.3.3.7.B"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the length of a rectangular flag from its perimeter and width",
      status: "covered",
      templateIds: ["rectangle-missing-border-side"],
      limitations:
        "rectangle-missing-border-side recovers a side from perimeter and one perpendicular side with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "19", page: "rationale PDF p.20" },
      responseFormat: "choice",
      standards: ["TEKS.3.4.8.A"],
      archetypeIds: ["data.picture-graph", "data.table-to-graph"],
      demand:
        "Pick the picture graph with a scale of four and half symbols that matches a table of pizza sales",
      status: "partial",
      templateIds: ["scaled-picture-graph"],
      limitations:
        "scaled-picture-graph reads values from a picture graph; no family chooses the graph that matches a table.",
    },
    {
      item: { number: "20", page: "rationale PDF p.22" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.K"],
      archetypeIds: ["whole.division-meaning"],
      demand:
        "Find the number of shelves when seventy-five shirts go fifteen to a shelf",
      status: "partial",
      templateIds: ["multiplication-division-story", "share-whole-items"],
      limitations:
        "multiplication-division-story and share-whole-items divide by one-digit counts; a two-digit group size is outside their range.",
    },
    {
      item: { number: "21", page: "rationale PDF p.23" },
      responseFormat: "numeric",
      standards: ["TEKS.3.3.6.C"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the area in square centimeters of a rectangle drawn as thirty-two rows of eight unit squares",
      status: "partial",
      templateIds: ["rectangle-area"],
      limitations:
        "STAAR interaction: equation editor. rectangle-area multiplies two side lengths; no family finds an area from a drawn array of rows of unit squares with a unit key.",
    },
    {
      item: { number: "22", page: "rationale PDF p.24" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.A"],
      archetypeIds: ["number.add-subtract-story"],
      demand:
        "Find the total of two days of sales when the second day is a stated amount more than the first",
      status: "covered",
      templateIds: ["staar-multistep-stories"],
      limitations:
        "staar-multistep-stories solves two-step add and subtract stories with three-digit numbers; the choices are plain numbers.",
    },
    {
      item: { number: "23", page: "rationale PDF p.25" },
      responseFormat: "multi-select",
      standards: ["TEKS.3.1.3.F"],
      archetypeIds: ["fractions.number-line", "fractions.equivalent"],
      demand:
        "Select the two fractions that name a point at one third on a zero-to-one number line",
      status: "partial",
      templateIds: ["fraction-line-position", "fraction-equivalence-choice"],
      limitations:
        "STAAR interaction: multiselect, 2 points. fraction-line-position reads one fraction at a point; fraction-equivalence-choice picks one equivalent name; no family takes a two-answer selection.",
    },
    {
      item: { number: "24", page: "rationale PDF p.27" },
      responseFormat: "choice",
      standards: ["TEKS.3.4.9.D"],
      archetypeIds: ["finance.credit-concept"],
      demand: "Recognize which statement is an example of using credit",
      status: "covered",
      templateIds: ["staar-money-vocabulary"],
      limitations:
        "staar-money-vocabulary chooses an example of credit among everyday money actions.",
    },
    {
      item: { number: "25", page: "rationale PDF p.28" },
      responseFormat: "other",
      standards: ["TEKS.3.1.3.H"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Compare five sixths and five eighths of a milkshake and give the reason",
      status: "covered",
      templateIds: [
        "compare-fractions-reason-blanks",
        "compare-like-numerators",
        "compare-unlike-fractions",
      ],
      limitations:
        "compare-fractions-reason-blanks chooses the greater of two fractions with the same numerator or denominator and the reason. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
    {
      item: { number: "26", page: "rationale PDF p.29" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.B"],
      archetypeIds: ["expression.multistep-equations"],
      demand:
        "Choose the equation that finds flowers in three vases when seventy-two flowers go equally in eight vases",
      status: "covered",
      templateIds: [
        "staar-story-model-choice",
        "two-step-equation-model",
        "linked-division-equations",
      ],
      limitations:
        "linked-division-equations (share-then-multiply) chooses the equation, or linked pair, for a total shared equally and then multiplied for several holders.",
    },
    {
      item: { number: "27", page: "rationale PDF p.30" },
      responseFormat: "other",
      standards: ["TEKS.3.3.6.A"],
      archetypeIds: ["shape.solid-properties", "shape.solid-parts"],
      demand:
        "Complete two statements that tell how solids are grouped by the number of faces and the shape of their bases",
      status: "partial",
      templateIds: ["solid-parts"],
      limitations:
        "STAAR interaction: inline choice, 2 points. solid-parts counts faces of one solid; no family sorts solids by faces and base shape, and the answer is two dropdown blanks.",
    },
    {
      item: { number: "28", page: "rationale PDF p.31" },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.G"],
      archetypeIds: ["whole.multiply-one-digit"],
      demand: "Find the pencils in eight boxes of forty-eight",
      status: "covered",
      templateIds: ["multiply-by-one-digit"],
      limitations:
        "multiply-by-one-digit multiplies a two-digit number by one digit with numeric entry; the choices are plain numbers.",
    },
    {
      item: { number: "29", page: "rationale PDF p.32" },
      responseFormat: "choice",
      standards: ["TEKS.3.3.7.D"],
      archetypeIds: ["measure.unit-choice"],
      demand: "Pick the unit used to measure the juice in a bottle",
      status: "covered",
      templateIds: ["reasonable-measure-choice"],
      limitations:
        "reasonable-measure-choice picks the unit that fits a stated amount of capacity, including liters for a bottle of juice, among customary and metric units far apart in size.",
    },
    {
      item: { number: "30", page: "rationale PDF p.33" },
      responseFormat: "graph/drag",
      standards: ["TEKS.3.1.2.A"],
      archetypeIds: ["number.expanded-form-whole"],
      demand:
        "Drag place-value terms to write an expression equal to a five-digit number",
      status: "covered",
      templateIds: [
        "expanded-whole-slots",
        "expanded-form-missing",
        "multidigit-digit-value",
      ],
      limitations:
        "expanded-whole-slots builds the sum of the values of the nonzero digits of a five-digit number, as values or digit-times-place terms. Each blank or slot takes one choice from its own list, the picker form of placing a value by dragging or choosing from a menu.",
    },
  ],
);
