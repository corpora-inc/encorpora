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
        ? "The factor pairs of $n$ are the divisors $d$ from 1 up to $\\sqrt{n}$, each with partner $n \\div d$. A turned pair is the same pair."
        : id === "partition-from-marks" || id === "choose-partition"
          ? "A rectangle partitioned into $r$ rows and $c$ columns of the same square holds $r \\times c$ squares."
          : "Partial products and partial quotients recombine by place value. A zero place is written, and a tens partial product is shifted one place.",
    ]),
  ),
  facetMappings: [
    {
      templateId: "partition-from-marks",
      facetId: "arrays.core",
      extent: "partial",
      rationale:
        "Count the unit marks on a rectangle's edges and give the rows, the columns, and the number of same-size squares. Does not assess a product written as a fact.",
    },
    {
      templateId: "choose-partition",
      facetId: "arrays.core",
      extent: "partial",
      rationale:
        "Choose the rectangle partitioned into a stated number of rows and columns of same-size squares. Does not assess counting an unmarked array.",
    },
    {
      templateId: "regions-to-whole",
      facetId: "operation-properties.core",
      extent: "partial",
      rationale:
        "Fill the two region products of a split array and add them to the whole product. Does not assess the commutative turn.",
    },
    {
      templateId: "which-split",
      facetId: "operation-properties.core",
      extent: "partial",
      rationale:
        "Choose the two facts that add to a product. Does not assess a three-factor product.",
    },
    {
      templateId: "facts-from-known",
      facetId: "operation-properties.core",
      extent: "partial",
      rationale:
        "Select the turn, the distributive sum, and the related division that follow from two known facts. Does not assess a fact with no shared factor.",
    },
    {
      templateId: "associative-compute",
      facetId: "operation-properties.core",
      extent: "partial",
      rationale:
        "Compute a product of three factors by grouping either adjacent pair. Does not assess four factors.",
    },
    {
      templateId: "split-the-dividend",
      facetId: "operation-properties.core",
      extent: "partial",
      rationale:
        "Divide a number within 100 by splitting off a multiple of ten times the divisor. Does not assess a two-digit divisor.",
    },
    {
      templateId: "complete-area-model",
      facetId: "whole-multiplication.two-digit-area-model",
      extent: "partial",
      rationale:
        "Write the four partial products of a two-digit area model and their total. Does not assess the standard algorithm's shifted row.",
    },
    {
      templateId: "explain-part",
      facetId: "whole-multiplication.two-digit-area-model",
      extent: "partial",
      rationale:
        "Name the place-value product that fills one region of a two-digit area model. Does not assess adding the four regions.",
    },
    {
      templateId: "partial-products-by-place",
      facetId: "whole-multiplication.one-digit-factor",
      extent: "partial",
      rationale:
        "Write the place partial products of a four-digit by one-digit product, including a zero place, and their total. Does not assess a two-digit multiplier.",
    },
    {
      templateId: "standard-algorithm-rows",
      facetId: "multidigit-products.two-digit-multiplier",
      extent: "partial",
      rationale:
        "Write the ones row, the shifted tens row, and the sum of a two-digit multiplication. Does not assess a three-digit multiplier.",
    },
    {
      templateId: "find-the-error",
      facetId: "multidigit-products.two-digit-multiplier",
      extent: "partial",
      rationale:
        "Name an unshifted tens row or a carry added before multiplying. Does not assess correcting a division.",
    },
    {
      templateId: "complete-division-model",
      facetId: "whole-division.one-digit-divisor",
      extent: "partial",
      rationale:
        "Fill each chunk's width and area for a one-digit divisor, including a zero place, then the quotient or the remainder. Does not assess a two-digit divisor.",
    },
    {
      templateId: "chunk-model",
      facetId: "multidigit-quotients.two-digit-divisor",
      extent: "partial",
      rationale:
        "Fill place-by-place chunk widths and areas for a two-digit divisor, including a zero width, then the quotient or the remainder. Does not assess the standard algorithm's bring-down.",
    },
    {
      templateId: "first-chunk-choice",
      facetId: "multidigit-quotients.two-digit-divisor",
      extent: "partial",
      rationale:
        "Choose the largest multiple of ten that fits as the first width of a two-digit division. Does not assess the rest of the quotient.",
    },
    {
      templateId: "list-all-pairs",
      facetId: "factors-multiples.core",
      extent: "partial",
      rationale:
        "List every factor pair of a number from 12 to 100, smaller factor first. Does not assess primes or the greatest common factor of two numbers.",
    },
    {
      templateId: "complete-list-choice",
      facetId: "factors-multiples.core",
      extent: "partial",
      rationale:
        "Choose the list that has every factor pair once. A missing pair or a turned repeat is rejected. Does not assess writing the pairs.",
    },
    {
      templateId: "bracket-steps",
      facetId: "integer-division.standard-algorithm",
      extent: "partial",
      rationale:
        "Enter each quotient digit, product, difference, and bring-down of a three-digit quotient, including a zero digit. Does not assess interpreting a remainder in a story.",
    },
    {
      templateId: "spot-the-error",
      facetId: "integer-division.standard-algorithm",
      extent: "partial",
      rationale:
        "Fix a remainder at least as large as the divisor, or a missing zero in the quotient. Does not assess a multiplication error.",
    },
  ],
} satisfies ContentFamily;
