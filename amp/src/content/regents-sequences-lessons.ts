import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const seqSenses = {
  term: "term-sequence",
  terms: "term-sequence",
  difference: "difference-subtract",
  product: "product-multiply",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const seqNoLink = [
  "part",
  "parts",
  "whole",
  "change",
  "changes",
  "leaves",
  "key",
  "jumps",
  "jump",
  "third",
  "mean",
  "means",
  "sort",
  "image",
  "images",
  "solid",
  "scales",
  "net",
  "inverse",
  "population",
  "more than",
  "period",
  "periods",
  "quarter",
  "quarters",
  "one quarter",
  "mirror image",
  "rule",
  "rules",
  "opposite",
  "opposites",
  "unit",
  "units",
  "average",
  "decreasing",
  "increasing",
  "model",
  "models",
  "pattern",
  "patterns",
];

export const regentsSequenceMethods: Record<string, ProblemMethod> = {
  "arithmetic-distant-term": {
    goal: "Find the number added at each step from the listed terms, then count the steps from the first term to a far-off term.",
    intuition:
      "A sequence is a list of numbers in order, and each number is a term. We write $a_1$ for the first term and $a_n$ for the term in position $n$. In an arithmetic sequence, the same number is added at every step, like 7, 11, 15, 19, which adds 4. That number is called the common difference $d$. To reach a term far down the list, take all the steps at once. Term 20 is 19 steps after term 1, not 20.",
    terms: [
      "common-difference",
      [
        "term-sequence",
        "Its term number is its position $n$ in the list, counted from 1.",
      ],
    ],
    senses: seqSenses,
    noLink: seqNoLink,
    method: [
      "Subtract two neighbouring terms, later minus earlier, to get the common difference $d$. Check that another pair gives the same answer.",
      "Count the steps from term 1 to term $n$: there are $n - 1$ of them.",
      "Add $(n - 1)$ times $d$ to the first term: $a_n = a_1 + (n - 1)d$.",
    ],
    watch:
      "Using $n$ steps instead of $n - 1$ is the usual slip. A decreasing sequence has a negative $d$, so each step lowers the value.",
  },
  "geometric-signed-term": {
    goal: "Find the common ratio, with its sign, and multiply the first term by it once for each step.",
    intuition:
      "A sequence is a list of numbers in order, and each number is a term. In a geometric sequence, each term is the one before times the same number, called the common ratio $r$. If $r$ is negative, the sign flips at every step, so the terms switch between negative and positive: $-3$, 6, $-12$. The term in position $n$, written $a_n$, is $n - 1$ steps after the first term $a_1$. So $a_n = a_1 r^{n-1}$, where the raised $n - 1$ means multiply by $r$ that many times.",
    terms: [
      "common-ratio",
      [
        "sequence",
        "An alternating sequence switches between positive and negative at every step, as a geometric sequence with a negative common ratio does.",
      ],
    ],
    senses: seqSenses,
    noLink: seqNoLink,
    method: [
      "Divide a term by the term before it, later over earlier, to find the ratio $r$ with its sign.",
      "Term $n$ is $n - 1$ steps from term 1, so work out $a_1 r^{n-1}$.",
      "Decide the sign first. A negative number, one less than 0, multiplied an odd number of times is negative. Multiplied an even number of times, it is positive.",
    ],
    watch:
      "The power is $n - 1$, not $n$. Keep a negative ratio in brackets when you raise it to a power: $(-2)^4 = 16$, but $-2^4 = -16$.",
  },
};

export const regentsSequencePrinciples: Record<string, string> = {
  "arithmetic-distant-term":
    "In an arithmetic sequence with first term $a_1$ and common difference $d$, term $n$ is $a_n = a_1 + (n - 1)d$, because it is reached by $n - 1$ equal steps of $d$.",
  "geometric-signed-term":
    "In a geometric sequence with first term $a_1$ and common ratio $r \\ne 0$, term $n$ is $a_n = a_1 r^{n-1}$. When $r < 0$, the sign of $a_n$ flips at each step: $r^{n-1}$ is positive when $n - 1$ is even and negative when it is odd.",
};

export const regentsSequenceLessons = [
  {
    ...chainLesson({
      id: "regents-arithmetic-distant-term",
      title: "A distant term of an arithmetic sequence",
      summary:
        "In the list 7, 11, 15, 19, each number is 4 more than the one before. To find the 20th number, you do not have to write all 20. Getting from the 1st number to the 20th takes 19 steps of 4, which is 76. So the 20th number is $7 + 76 = 83$.",
      templateIds: ["arithmetic-distant-term"],
      objectives: [
        "Find the common difference (the number added each step), including a negative or decimal one.",
        "Use $a_n = a_1 + (n - 1)d$ to find a term without listing the terms in between.",
      ],
      openingTitle: "Take all the steps at once",
      opening: [
        "A sequence is a list of numbers in order, and each number is called a term. We label terms by position with a small number written low, called a subscript: $a_1$ is the first term, $a_{20}$ the 20th, and $a_n$ the term in position $n$.",
        "In an arithmetic sequence, every term is the one before it plus the same number. That number is called the common difference, written $d$. In 7, 11, 15, 19, $d = 4$.",
        "Count the steps carefully. Term 1 needs no steps. Term 2 is one step from term 1, term 3 is two steps, and term 20 is 19 steps. In general, term $n$ is $n - 1$ steps from term 1.",
        "Each step adds $d$, so $n - 1$ steps add $(n - 1)$ times $d$. That gives the rule $a_n = a_1 + (n - 1)d$, where $(n - 1)d$ means $n - 1$ times $d$.",
      ],
      example: {
        prompt:
          "The first four terms of an arithmetic sequence are $7, 11, 15, 19, \\dots$. What is $a_{20}$?",
        steps: [
          "Find the common difference by subtracting a term from the one after it: $11 - 7 = 4$. The other pairs agree: $15 - 11 = 4$ and $19 - 15 = 4$.",
          "Term 20 is $20 - 1 = 19$ steps after term 1. Each step adds 4, so the steps add $19 \\times 4 = 76$.",
          "Add that to the first term: $a_{20} = 7 + 76 = 83$.",
        ],
        answer: "$83$",
      },
      methodTitle: "Difference, steps, then add",
      method: [
        "Find $d$ by subtracting a term from the one after it. A decreasing list gives a negative $d$, and decimal terms can give a decimal $d$.",
        "Multiply $d$ by $n - 1$, the number of steps, and add the result to $a_1$.",
      ],
      formalTitle: "The term formula",
      formal: [
        "A sequence is arithmetic when $a_{k+1} - a_k = d$ for every position $k$: each term minus the one before is the same number. Adding $d$ to $a_1$ a total of $n - 1$ times gives $a_n = a_1 + (n - 1)d$.",
        "The rule only works when the difference stays the same. Check at least two pairs of neighbouring terms before you use it.",
      ],
      pitfalls: [
        "Count $n - 1$ steps to reach term $n$, not $n$ steps.",
        "Subtract later minus earlier. Doing it the other way changes the sign of $d$.",
        "Multiplying $n$ by $d$ alone leaves out the starting value $a_1$.",
      ],
      parentGuide:
        "Ask your learner how many steps it takes to get from the first term to the 20th term, and why the answer is 19, not 20.",
    }),
    senses: seqSenses,
    noLink: seqNoLink,
  },
  {
    ...chainLesson({
      id: "regents-geometric-signed-term",
      title: "Geometric sequences with negative terms",
      summary:
        "In the list $-3$, 6, $-12$, 24, each number is the one before times $-2$. A negative number is a number less than 0. Multiplying by a negative number flips the sign every time, so the numbers switch between negative and positive. To find a later number, multiply by $-2$ once for each step. Then use the number of flips to check the sign.",
      templateIds: ["geometric-signed-term"],
      objectives: [
        "Find the common ratio (the number each term is multiplied by), including a negative ratio.",
        "Use $a_n = a_1 r^{n-1}$, and decide the sign of the term from the power.",
      ],
      openingTitle: "Each step multiplies by the same number",
      opening: [
        "A sequence is a list of numbers in order, and each number is a term. We write $a_1$ for the first term and $a_n$ for the term in position $n$.",
        "In a geometric sequence, each term is the one before times the same number, called the common ratio $r$. To find it, divide a term by the one before it: $6 \\div (-3) = -2$.",
        "A negative times a negative is positive, and a negative times a positive is negative. So when $r$ is negative, the sign flips at every step. Starting from $-3$, the terms go negative, positive, negative, positive.",
        "To reach term 5, you multiply by the ratio 4 times, once for each step. We write that as $r^4$, read “$r$ to the power 4”. Four flips bring the sign back to where it started, so $a_5$ has the same sign as $a_1$.",
      ],
      example: {
        prompt:
          "The first three terms of a geometric sequence are $-3, 6, -12, \\dots$. What is $a_5$?",
        steps: [
          "Find the ratio by dividing a term by the one before it: $6 \\div (-3) = -2$. Check with the next pair: $-12 \\div 6 = -2$.",
          "Term 5 is $5 - 1 = 4$ steps after term 1, so multiply $a_1$ by $-2$ four times: $a_5 = -3 \\times (-2)^4$.",
          "Work out the power first, keeping the brackets: $(-2)^4 = 16$, because four negatives multiplied give a positive. So $a_5 = -3 \\times 16 = -48$.",
          "Check the sign: four flips from a negative start end negative. Writing the terms out agrees: $-3$, 6, $-12$, 24, $-48$.",
        ],
        answer: "$-48$",
      },
      methodTitle: "Ratio, power, sign",
      method: [
        "Divide a term by the one before it to get $r$, keeping its sign.",
        "Work out $r^{n-1}$ first, then multiply by $a_1$.",
        "Check the sign. An even number of flips leaves the sign of $a_1$. An odd number switches it.",
      ],
      formalTitle: "The term formula",
      formal: [
        "A sequence is geometric when $\\frac{a_{k+1}}{a_k} = r$ for every position $k$, with $r \\ne 0$ ($\\ne$ means is not equal to). Then $a_n = a_1 r^{n-1}$.",
        "For $r < 0$ ($<$ means less than), $r^{n-1}$ is positive when $n - 1$ is even and negative when $n - 1$ is odd.",
      ],
      pitfalls: [
        "Raise the whole ratio to the power, in brackets: $(-2)^4 = 16$, not $-2^4 = -16$.",
        "The power is $n - 1$, not $n$.",
        "Do not add the ratio. A geometric sequence multiplies at each step.",
      ],
      parentGuide:
        "Have your learner check each answer's sign by counting how many times the sign has flipped since the first term.",
    }),
    senses: seqSenses,
    noLink: seqNoLink,
  },
];

export const regentsSequenceFacetMappings: FacetMapping[] = [
  {
    templateId: "arithmetic-distant-term",
    facetId: "arithmetic-sequences.core",
    extent: "partial",
    rationale:
      "Single choice for a term between the 15th and the 30th of an increasing or decreasing arithmetic sequence read from four listed terms, with whole-number or one-decimal terms. Does not assess writing the explicit or recursive rule, finding which term has a given value, or sequences given by tables or graphs.",
  },
  {
    templateId: "geometric-signed-term",
    facetId: "geometric-sequences.core",
    extent: "partial",
    rationale:
      "Single choice for the fourth to sixth term of a geometric sequence with a negative ratio or negative first term, from listed terms or the first term and ratio. Does not assess fractional ratios, writing the explicit or recursive rule, or sums of terms.",
  },
];
