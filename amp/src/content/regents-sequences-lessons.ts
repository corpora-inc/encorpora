import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsSequenceMethods: Record<string, ProblemMethod> = {
  "arithmetic-distant-term": {
    goal: "Find the common difference from listed terms, then count the steps from the first term to a distant term.",
    intuition:
      "An arithmetic sequence adds the same number at every step. To reach a term far down the list you do not write every term: you take the steps all at once. Term 20 is 19 steps after term 1, not 20.",
    terms: [
      [
        "common difference",
        "The fixed amount added to get from one term to the next.",
      ],
      [
        "term number",
        "The position $n$ of a term in the list, counted from 1.",
      ],
    ],
    method: [
      "Subtract two neighbouring terms (later minus earlier) to get the common difference $d$, and check that another pair agrees.",
      "Count the steps from term 1 to term $n$: there are $n-1$ of them.",
      "Add $(n-1)d$ to the first term.",
    ],
    watch:
      "Using $n$ steps instead of $n-1$ is the usual slip. A decreasing sequence has a negative $d$, so the steps lower the value.",
  },
  "geometric-signed-term": {
    goal: "Find the common ratio, including its sign, and multiply the first term by it once for each step.",
    intuition:
      "A geometric sequence multiplies by the same number at every step. A negative ratio flips the sign at each step, so the terms alternate between negative and positive. The sign of a term depends on how many times it has been flipped.",
    terms: [
      [
        "common ratio",
        "The fixed number each term is multiplied by to get the next.",
      ],
      [
        "alternating sequence",
        "A sequence whose terms switch sign at every step.",
      ],
    ],
    method: [
      "Divide a term by the term before it, later over earlier, to find the ratio $r$ with its sign.",
      "Term $n$ takes $n-1$ steps from term 1, so compute $a_1r^{n-1}$.",
      "Decide the sign first: an odd power of a negative ratio is negative, an even power is positive.",
    ],
    watch:
      "The exponent is $n-1$, not $n$. Keep a negative ratio in parentheses when you raise it to a power: $(-2)^4=16$ but $-2^4=-16$.",
  },
};

export const regentsSequencePrinciples: Record<string, string> = {
  "arithmetic-distant-term":
    "In an arithmetic sequence with first term $a_1$ and common difference $d$, term $n$ is $a_n=a_1+(n-1)d$, because it is reached by $n-1$ equal steps of $d$.",
  "geometric-signed-term":
    "In a geometric sequence with first term $a_1$ and common ratio $r\\neq0$, term $n$ is $a_n=a_1r^{n-1}$. When $r<0$ the sign of $a_n$ alternates with the parity of $n-1$.",
};

export const regentsSequenceLessons = [
  chainLesson({
    id: "regents-arithmetic-distant-term",
    title: "A distant term of an arithmetic sequence",
    summary:
      "Read the common difference from listed terms and jump straight to a term far along, such as the 20th.",
    templateIds: ["arithmetic-distant-term"],
    objectives: [
      "Find the common difference of an arithmetic sequence from its first terms, including a negative or decimal difference.",
      "Use $a_n=a_1+(n-1)d$ to find a term without listing the terms between.",
    ],
    openingTitle: "Take all the steps at once",
    opening: [
      "In an arithmetic sequence every term is the one before it plus the same number, the common difference. Listing 20 terms is slow, but each step adds the same amount, so 19 steps add 19 times that amount.",
      "Term 1 needs no steps. Term 2 is one step from term 1, and term 20 is 19 steps from term 1.",
    ],
    example: {
      prompt:
        "The first four terms of an arithmetic sequence are $7, 11, 15, 19, \\dots$. What is $a_{20}$?",
      steps: [
        "The common difference is $11-7=4$; the later pairs agree.",
        "Term 20 is 19 steps after term 1, so add $19\\cdot4=76$ to the first term.",
        "$a_{20}=7+76=83$.",
      ],
      answer: "$83$",
    },
    methodTitle: "Difference, steps, then add",
    method: [
      "Find $d$ by subtracting a term from the one after it. Decreasing sequences give a negative $d$, and decimal terms give a decimal $d$.",
      "Multiply $d$ by $n-1$ and add the result to $a_1$.",
    ],
    formalTitle: "The term formula",
    formal: [
      "If $a_{k+1}-a_k=d$ for every $k$, the sequence is arithmetic. Adding $d$ a total of $n-1$ times to $a_1$ gives $a_n=a_1+(n-1)d$.",
      "The formula needs a constant difference. Check at least two pairs of neighbouring terms before using it.",
    ],
    pitfalls: [
      "Count $n-1$ steps to reach term $n$, not $n$ steps.",
      "Subtract in the order later minus earlier; reversing it changes the sign of $d$.",
      "Multiplying $n$ by $d$ leaves out the starting value $a_1$.",
    ],
    parentGuide:
      "Ask your learner how many steps it takes to get from the first term to the 20th term, and why the answer is not 20.",
  }),
  chainLesson({
    id: "regents-geometric-signed-term",
    title: "Geometric sequences with negative terms",
    summary:
      "Find the common ratio with its sign and use it to reach a later term whose sign may alternate.",
    templateIds: ["geometric-signed-term"],
    objectives: [
      "Find the common ratio of a geometric sequence, including a negative ratio.",
      "Use $a_n=a_1r^{n-1}$ and decide the sign of the term from the power.",
    ],
    openingTitle: "Each step multiplies by the same number",
    opening: [
      "A geometric sequence multiplies by the same number, the common ratio, at each step. If the ratio is negative the sign flips each time, so the terms alternate: negative, positive, negative, and so on from a negative start.",
      "To reach term 5 you multiply by the ratio 4 times. The sign after 4 flips is the same as at the start.",
    ],
    example: {
      prompt:
        "The first three terms of a geometric sequence are $-3, 6, -12, \\dots$. What is $a_5$?",
      steps: [
        "The ratio is $6\\div(-3)=-2$, and $-12\\div6=-2$ agrees.",
        "Term 5 is 4 steps after term 1: $a_5=-3\\cdot(-2)^4$.",
        "$(-2)^4=16$, so $a_5=-3\\cdot16=-48$.",
      ],
      answer: "$-48$",
    },
    methodTitle: "Ratio, power, sign",
    method: [
      "Divide a term by the one before it to get $r$, keeping its sign.",
      "Compute $r^{n-1}$ first, then multiply by $a_1$.",
      "Check the sign: an even power of a negative ratio is positive, so the sign of $a_n$ is the sign of $a_1$.",
    ],
    formalTitle: "The term formula",
    formal: [
      "If $a_{k+1}/a_k=r$ for every $k$ with $r\\ne0$, then $a_n=a_1r^{n-1}$.",
      "For $r<0$, $r^{n-1}$ is positive when $n-1$ is even and negative when $n-1$ is odd.",
    ],
    pitfalls: [
      "Raise the whole ratio to the power, in parentheses: $(-2)^4=16$, not $-2^4=-16$.",
      "The exponent is $n-1$, not $n$.",
      "Do not add the ratio. A geometric sequence multiplies at each step.",
    ],
    parentGuide:
      "Have your learner check each answer's sign by asking how many times the sign has flipped since the first term.",
  }),
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
