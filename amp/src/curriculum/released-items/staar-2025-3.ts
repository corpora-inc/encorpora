import { defineLedger } from "./types";

/** Every mathematics item of the Spring 2025 STAAR Grade 3 mathematics form,
 * labeled once from TEA's item rationales and answer key. TEA publishes the
 * 2025 form only as an online practice test; the rationale describes each
 * item and the key states its TEKS code, item type and points. */
export const staarGrade3 = defineLedger(
  {
    id: "staar-2025-3",
    test: "STAAR Grade 3 mathematics",
    form: "Spring 2025 released test",
    url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-3-rationale.pdf",
    edition:
      "Spring 2025 administration; item rationales as published on the TEA STAAR released test questions page. TEKS codes are those printed in the answer key (grade.strand.expectation.letter).",
    retrievedAt: "2026-10-26",
    sha256: "0e6fc9dcadf1e0f92cb5755e26e33d54c140b997ffd140e326984594589fb2ec",
    supplements: [
      {
        role: "answer key (item type, TEKS, points)",
        url: "https://tea.texas.gov/data-reports/staar/released-test-questions/2025-staar-math-3-answer-key.pdf",
        sha256:
          "3817f9af208a7b30a442d98810db2f62531bba7978f74477be27afb2b4513974",
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
      responseFormat: "multi-select",
      standards: ["TEKS.3.1.2.A"],
      archetypeIds: ["number.expanded-form-whole"],
      demand:
        "Choose every expression that equals a five-digit number written as place-value parts",
      status: "partial",
      templateIds: ["expanded-form-missing", "multidigit-digit-value"],
      limitations:
        "STAAR interaction: multiselect, 2 points. expanded-form-missing completes one part of a three-digit expanded sum and multidigit-digit-value names one digit's value; no family builds or recognizes a full expanded sum beyond 999, and none takes a two-answer selection.",
    },
    {
      item: {
        number: "2",
        page: "rationale PDF p.2",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.J"],
      archetypeIds: ["expression.verbal"],
      demand:
        "Pick the multiplication equation with an unknown factor that models equal sharing of a total",
      status: "covered",
      templateIds: [
        "staar-story-model-choice",
        "story-operation-choice",
        "missing-factor-fact",
      ],
      limitations:
        "staar-story-model-choice chooses the multiplication equation with an unknown factor that models equal sharing.",
    },
    {
      item: {
        number: "3",
        page: "rationale PDF p.3",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.3.B"],
      archetypeIds: ["fractions.number-line"],
      demand: "Name the fraction marked on a number line cut into sixths",
      status: "covered",
      templateIds: ["fraction-line-position"],
      limitations:
        "Fraction entry stands in for the plain fraction choices; the family reads marks on zero-based lines of several denominators.",
    },
    {
      item: {
        number: "4",
        page: "rationale PDF p.4",
      },
      responseFormat: "other",
      standards: ["TEKS.3.2.5.E"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Complete a sentence that says how a table's second column relates to its first, a multiplication by a constant",
      status: "covered",
      templateIds: [
        "pattern-pair-relationship",
        "related-patterns-relationship",
        "table-rule-sentence",
      ],
      limitations:
        "table-rule-sentence (multi-part-choice-v1, inline layout): complete a sentence about a table of four or five pairs by choosing the operation and the number of its rule, including multiplication by a constant.",
    },
    {
      item: {
        number: "5",
        page: "rationale PDF p.5",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.4.8.A"],
      archetypeIds: ["univariate.displays"],
      demand: "Choose the list of values that matches a dot plot",
      status: "partial",
      templateIds: ["line-plot-whole", "fraction-line-plot"],
      limitations:
        "line-plot-whole and fraction-line-plot read counts and differences from a line plot; none matches a full data list to a plot or uses a dot plot of small whole-number values.",
    },
    {
      item: {
        number: "6",
        page: "rationale PDF p.6",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.A"],
      archetypeIds: ["number.add-subtract-story"],
      demand:
        "Add two three-digit amounts, then subtract a third, to compare combined seasonal totals with another season",
      status: "covered",
      templateIds: [
        "staar-multistep-stories",
        "add-three-digit",
        "subtract-three-digit",
      ],
      limitations:
        "staar-multistep-stories adds two three-digit amounts, subtracts a third and compares the totals, by entry.",
    },
    {
      item: {
        number: "7",
        page: "rationale PDF p.7",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.3.3.6.B"],
      archetypeIds: ["shape.quadrilateral-hierarchy"],
      demand: "Mark every figure in a mixed group that has exactly four sides",
      status: "partial",
      templateIds: ["find-quadrilateral", "classify-quadrilateral"],
      limitations:
        "STAAR interaction: hot spot, 2 points. Related families choose one named quadrilateral; selecting several figures by clicking them (hot spot) has no response protocol.",
    },
    {
      item: {
        number: "8",
        page: "rationale PDF p.8",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.B"],
      archetypeIds: ["expression.multistep-equations"],
      demand:
        "Choose the pair of division equations that models halving a class and then splitting that part equally",
      status: "partial",
      templateIds: ["story-operation-choice", "multiplication-division-story"],
      limitations:
        "Related families model or solve one-step stories; choosing two linked equations for a two-step story is not practiced.",
    },
    {
      item: {
        number: "9",
        page: "rationale PDF p.9",
      },
      responseFormat: "other",
      standards: ["TEKS.3.1.2.D"],
      archetypeIds: ["place.compare-whole"],
      demand:
        "Order the capacities of three five-digit stadiums by comparing place values from the left",
      status: "partial",
      templateIds: ["compare-multidigit"],
      limitations:
        "STAAR interaction: inline choice, 2 points. compare-multidigit picks the greater or lesser of two numbers up to 999,999; completing a two-blank comparison sentence across three values is not practiced.",
    },
    {
      item: {
        number: "10",
        page: "rationale PDF p.10",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.4.K"],
      archetypeIds: ["whole.multi-step-stories"],
      demand:
        "Share a total equally among people, then split one share into equal piles and find a pile",
      status: "covered",
      templateIds: [
        "staar-multistep-stories",
        "multiplication-division-story",
        "divide-by-one-digit",
      ],
      limitations:
        "staar-multistep-stories shares a total equally and then splits one share into equal piles, by entry.",
    },
    {
      item: {
        number: "11",
        page: "rationale PDF p.11",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.3.7.B"],
      archetypeIds: ["measure.area"],
      demand: "Find the perimeter of a rectangle from its length and width",
      status: "covered",
      templateIds: ["rectangle-border-length"],
      limitations: "Numeric entry stands in for the plain-number choices.",
    },
    {
      item: {
        number: "12",
        page: "rationale PDF p.12",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.4.8.A"],
      archetypeIds: ["data.graph-error"],
      demand:
        "Decide which of a bar graph and a picture graph misstates a described data set",
      status: "partial",
      templateIds: ["scaled-bar-graph", "scaled-picture-graph"],
      limitations:
        "Related families read one scaled graph; none asks which of two graphs contradicts the stated data, and the picture graph key with a half-step bar is not combined.",
    },
    {
      item: {
        number: "13",
        page: "rationale PDF p.13",
      },
      responseFormat: "multi-select",
      standards: ["TEKS.3.3.6.A"],
      archetypeIds: ["shape.solid-properties"],
      demand:
        "Select the true statements about a group of solids, such as having two congruent parallel faces",
      status: "missing",
      templateIds: [],
      limitations:
        "STAAR interaction: multiselect, 2 points. Existing solid practice names solids or counts faces, edges and vertices; no family compares face shape, congruence or parallel faces across solids, and multi-select across drawn solids has no figure support.",
    },
    {
      item: {
        number: "14",
        page: "rationale PDF p.14",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.A"],
      archetypeIds: ["number.number-line-equation"],
      demand:
        "Match a number-line diagram of a leftward ray and a rightward ray to a story about library books",
      status: "missing",
      templateIds: [],
      limitations:
        "Related practice hops from a start on a number line to a landing value within 100; no family asks the learner to read a diagram of jumps and match it to an equation or story.",
    },
    {
      item: {
        number: "15",
        page: "rationale PDF p.15",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.3.H"],
      archetypeIds: ["fractions.compare"],
      demand:
        "Decide who holds the larger fraction of one color when two sets of blocks have different totals",
      status: "partial",
      templateIds: ["compare-unlike-fractions", "compare-fractions"],
      limitations:
        "Related families compare two stated fractions; forming each fraction from counts of colored blocks and naming a person are not practiced.",
    },
    {
      item: {
        number: "16",
        page: "rationale PDF p.16",
      },
      responseFormat: "numeric",
      standards: ["TEKS.3.2.4.A"],
      archetypeIds: ["number.add-subtract-story"],
      demand:
        "Add two bag totals, then subtract the beads not used, and enter the result",
      status: "partial",
      templateIds: ["add-three-digit", "subtract-three-digit"],
      limitations:
        "STAAR interaction: equation editor, 1 point. Both families are single-step; the chained story with a typed total is not practiced.",
    },
    {
      item: {
        number: "17",
        page: "rationale PDF p.17",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.E"],
      archetypeIds: ["pattern.paired"],
      demand:
        "Choose the table whose pairs all follow a stated multiply-by-six rule",
      status: "covered",
      templateIds: ["staar-table-rule-choice", "pattern-pair-relationship"],
      limitations:
        "staar-table-rule-choice chooses the table whose every pair follows a multiply rule, such as times six; tables are shown as rows of paired values.",
    },
    {
      item: {
        number: "18",
        page: "rationale PDF p.18",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.3.F"],
      archetypeIds: ["fractions.equivalent"],
      demand:
        "Choose the fraction strip whose shaded part equals a given fraction with sixths",
      status: "partial",
      templateIds: ["fraction-equivalence-choice", "equivalent-numerator"],
      limitations:
        "Related families name equivalent fractions as symbols; choosing among strip models is not practiced.",
    },
    {
      item: {
        number: "19",
        page: "rationale PDF p.19",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.3.E"],
      archetypeIds: ["number.fraction-equal-share"],
      demand:
        "Find the fraction of a wall, cut into equal parts, that each of several students paints",
      status: "partial",
      templateIds: ["equal-area-fraction", "whole-sharing-fraction"],
      limitations:
        "Related families name one equal part of a rectangle or share liters; sharing a counted number of parts among students and naming the fraction is not practiced.",
    },
    {
      item: {
        number: "20",
        page: "rationale PDF p.20",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.3.6.C"],
      archetypeIds: ["measure.area"],
      demand:
        "Find the area of a shaded rectangle on a grid using a unit-square key",
      status: "partial",
      templateIds: ["rectangle-area"],
      limitations:
        "rectangle-area multiplies labeled side lengths; counting rows and columns of unit squares from a key is not practiced.",
    },
    {
      item: {
        number: "21",
        page: "rationale PDF p.21",
      },
      responseFormat: "numeric",
      standards: ["TEKS.3.2.4.K"],
      archetypeIds: ["whole.division-meaning"],
      demand:
        "Divide a number of pictures by the number per page to find the pages used",
      status: "covered",
      templateIds: ["multiplication-division-story"],
      limitations:
        "STAAR interaction: equation editor, 1 point. Numeric entry matches the typed response.",
    },
    {
      item: {
        number: "22",
        page: "rationale PDF p.22",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.4.9.D"],
      archetypeIds: ["finance.credit-concept"],
      demand:
        "Recognize an example of using credit, as opposed to paying a tax",
      status: "covered",
      templateIds: ["staar-money-vocabulary"],
      limitations:
        "staar-money-vocabulary chooses the example of using credit, with a sales tax among the distractors.",
    },
    {
      item: {
        number: "23",
        page: "rationale PDF p.23",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.2.5.C"],
      archetypeIds: ["whole.multiplicative-comparison"],
      demand:
        "Choose the statement that a product expression describes for sales on two days",
      status: "partial",
      templateIds: ["comparison-amount", "comparison-factor"],
      limitations:
        "Related families compute a quantity or factor from a stated multiplicative comparison; interpreting a given expression back into a statement is not practiced.",
    },
    {
      item: {
        number: "24",
        page: "rationale PDF p.24",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.2.A"],
      archetypeIds: ["number.place-value-units"],
      demand:
        "Write the sum of seventy hundreds, one ten and further ones as a number",
      status: "covered",
      templateIds: [
        "staar-number-word-form",
        "multidigit-digit-value",
        "expanded-form-missing",
      ],
      limitations:
        "staar-number-word-form names the number made of counts of hundreds, tens and ones, with more than nine hundreds, by choice.",
    },
    {
      item: {
        number: "25",
        page: "rationale PDF p.25",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.3.2.4.H"],
      archetypeIds: ["whole.division-meaning"],
      demand:
        "Select one group's worth of marbles in a drawing when a total is split into equal groups",
      status: "partial",
      templateIds: ["unknown-group-size", "share-or-group"],
      limitations:
        "STAAR interaction: hot spot, 1 point. Related families find the group size by entry; selecting objects in a drawing (hot spot) has no response protocol.",
    },
    {
      item: {
        number: "26",
        page: "rationale PDF p.26",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.3.7.C"],
      archetypeIds: ["time.elapsed"],
      demand:
        "Find the starting time given the finish time and the elapsed hours and minutes",
      status: "partial",
      templateIds: ["clock-elapsed-minutes"],
      limitations:
        "clock-elapsed-minutes finds the duration between two times on one morning; the start time from an end time and a duration is not practiced.",
    },
    {
      item: {
        number: "27",
        page: "rationale PDF p.27",
      },
      responseFormat: "other",
      standards: ["TEKS.3.1.2.B"],
      archetypeIds: ["number.place-value-ratio"],
      demand:
        "Complete a two-blank comparison of an 8 in two places of a six-digit number",
      status: "partial",
      templateIds: ["digit-value-ratio"],
      limitations:
        "STAAR interaction: inline choice, 2 points. digit-value-ratio finds how many times one place is worth another by entry; dropdown blanks have no response protocol.",
    },
    {
      item: {
        number: "28",
        page: "rationale PDF p.28",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.4.8.B"],
      archetypeIds: ["univariate.displays"],
      demand: "Count ratings below a given value from a dot plot",
      status: "covered",
      templateIds: [
        "staar-dot-plot-threshold",
        "line-plot-whole",
        "fraction-line-plot",
      ],
      limitations:
        "staar-dot-plot-threshold counts every dot below a stated value on a dot plot of ratings, and also at-least and greater-than conditions.",
    },
    {
      item: {
        number: "29",
        page: "rationale PDF p.29",
      },
      responseFormat: "graph/drag",
      standards: ["TEKS.3.2.4.B"],
      archetypeIds: ["number.estimate"],
      demand:
        "Round each addend to the nearest ten and place the rounded values and their sum",
      status: "partial",
      templateIds: ["round-to-ten", "estimate-reasonableness"],
      limitations:
        "STAAR interaction: drag and drop, 2 points. round-to-ten rounds a single number by entry and estimate-reasonableness chooses an estimate; arranging rounded values by drag and drop has no response protocol.",
    },
    {
      item: {
        number: "30",
        page: "rationale PDF p.30",
      },
      responseFormat: "choice",
      standards: ["TEKS.3.1.2.D"],
      archetypeIds: ["place.compare-whole"],
      demand:
        "Choose a number that makes a compound inequality with two five-digit numbers true",
      status: "partial",
      templateIds: ["compare-multidigit"],
      limitations:
        "compare-multidigit picks the greater or lesser of two numbers; finding a value between two bounds is not practiced.",
    },
  ],
);
