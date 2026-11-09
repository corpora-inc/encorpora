import type { ContentFamily } from "./registry/types";
import { chainLesson } from "../content/chain-lesson-kit";
import type { ProblemMethod } from "../content/problem-lessons";
import {
  generateMultiplicationClause,
  multiplicationClauseTemplates,
} from "../math/multiplication-clause-practice";

const method = (
  goal: string,
  steps: string[],
  watch: string,
): ProblemMethod => ({ goal, method: steps, watch });

const ids = multiplicationClauseTemplates.map((t) => t.id);

export const family = {
  id: "multiplication-clause",
  practice: {
    templates: multiplicationClauseTemplates,
    generate: generateMultiplicationClause,
    preserveAlgebra: true,
  },
  lessons: [
    chainLesson({
      id: "multiplication-clause-lesson",
      title: "Models for multiplication and division",
      summary:
        "Edge marks tell how to partition a rectangle. Known facts, area pieces, and place-value chunks build a product or a quotient. Factor pairs are listed from both ends until they meet.",
      templateIds: [...ids],
      objectives: [
        "Use an array, an area model, or place-value chunks to complete a product or a quotient.",
        "List every factor pair once, and name the error in a standard algorithm.",
      ],
      openingTitle: "The model keeps the same total",
      opening: [
        "An array split into two regions is still the same array. Each region is a smaller product, and the products add.",
        "An area model and the standard algorithm record the same partial products. A tens row starts in the tens place. A division chunk that does not fit is written 0, not skipped.",
      ],
      example: {
        prompt: "Use the regions to find 8 × 7. 8 × 5 = __, 8 × 2 = __, so 8 × 7 = __ + __ = __.",
        steps: [
          "8 × 5 = 40 and 8 × 2 = 16.",
          "40 + 16 = 56, so 8 × 7 = 56.",
        ],
        answer: "40, 16, 40, 16, 56",
      },
      methodTitle: "One place at a time",
      method: [
        "Multiply or divide one place, including a place of 0.",
        "Add the partial products, or add the chunk widths. A remainder must be smaller than the divisor.",
      ],
      formalTitle: "Why the rows line up",
      formal: [
        "The tens digit is worth ten times the ones digit, so its partial product starts one place to the left. In division, each difference has to be smaller than the divisor or another group still fits.",
      ],
      pitfalls: [
        "An unshifted tens row is ten times too small.",
        "Skipping a zero place drops a zero from the product or the quotient.",
      ],
      parentGuide:
        "Ask your child which place the row starts in, and whether a leftover is still big enough for another group. A factor pair written the other way is the same pair.",
    }),
  ],
  methods: Object.fromEntries(
    ids.map((id) => [
      id,
      method(
        id === "list-all-pairs" || id === "complete-list-choice"
          ? "List every factor pair of a whole number from 1 to 100, smaller factor first."
          : id === "bracket-steps" || id === "spot-the-error"
            ? "Divide with the standard algorithm, one place at a time, and keep each difference smaller than the divisor."
            : "Use place value, equal groups, or an area model to complete the product or the quotient.",
        [
          "Read the places or the regions the model already shows.",
          "Multiply or divide one part, then combine. Keep a zero place.",
        ],
        id === "standard-algorithm-rows"
          ? "The tens row starts in the tens place. Do not enter the unshifted product."
          : "A difference at least as large as the divisor means another group fits.",
      ),
    ]),
  ),
  principles: Object.fromEntries(
    ids.map((id) => [
      id,
      id === "list-all-pairs" || id === "complete-list-choice"
        ? "The factor pairs of n are the divisors d from 1 up to √n, each with partner n ÷ d. A turned pair is the same pair."
        : id === "partition-from-marks" || id === "choose-partition"
          ? "A rectangle partitioned into r rows and c columns of the same square holds r × c squares."
          : "Partial products and partial quotients recombine by place value. A zero place is written, and a tens partial product is shifted one place.",
    ]),
  ),
} satisfies ContentFamily;
