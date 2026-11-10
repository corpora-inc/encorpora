import type { FacetMapping } from "./coverage";
import { chainLesson } from "./chain-lesson-kit";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const noLink = ["base", "power", "half"];

export const exponentialContextEquationMethods: Record<string, ProblemMethod> = {
  "exponential-context-equation": {
    goal: "Choose the exponential equation for a growth or half-life situation, then choose the integer time.",
    intuition:
      "Doubling multiplies by 2. It does not add 2. After t hours, a start of 500 that doubles is 500 times 2 to the power t. A half-life multiplies by 1/2 once each half-life.",
    noLink,
    method: [
      "Write the start times the multiplier to a power. The power counts the steps, or time divided by the half-life.",
      "Set that expression equal to the target amount.",
      "Match the bases. The exponents are equal, so read the time. Check by stepping the start forward.",
    ],
    watch:
      "Do not turn doubling into adding the base, and do not drop the starting amount.",
  },
};

export const exponentialContextEquationPrinciples: Record<string, string> = {
  "exponential-context-equation":
    "If a positive start a is multiplied by an integer base b each step, the amount after t steps is a times b to the t. Set that equal to a target that is a times a whole power of b. Matching bases gives t with no logarithm. A half-life of h hours uses the multiplier 1/2 and the exponent t/h.",
};

export const exponentialContextEquationLessons: Lesson[] = [
  chainLesson({
    id: "exponential-context-equation-lesson",
    title: "Write and solve an exponential situation",
    summary:
      "A doubling culture multiplies. It does not add. Choose the equation that sets the multiplied start equal to the target, then solve it by matching bases.",
    noLink,
    templateIds: ["exponential-context-equation"],
    objectives: [
      "Choose the exponential equation for a repeated multiplier or a half-life.",
      "Solve that equation by matching bases, for a small whole number of steps.",
    ],
    openingTitle: "Multiply, then match the bases",
    opening: [
      "A culture starts with 500 bacteria and doubles every hour. After 1 hour there are 1000. After 2 hours there are 2000. Each hour multiplies by 2.",
      "The equation is 500 times 2 to the t equals the target. Adding 2 each hour is a different situation.",
      "This practice asks you to choose that equation and its solution. It does not ask you to invent a new model from scratch.",
    ],
    example: {
      prompt:
        "A culture starts with 500 bacteria and multiplies by 2 every hour. Which equation gives the hours t until there are 32000 bacteria? Then choose t.",
      steps: [
        "After t hours the count is 500 times 2 to the t.",
        "Set that equal to 32000. Divide by 500: 2 to the t equals 64.",
        "64 is 2 to the 6, so t = 6. Check: six doublings reach 32000.",
      ],
      answer: "500 times 2 to the t equals 32000, and t = 6",
    },
    methodTitle: "From the story to the exponent",
    method: [
      "Name the start and the multiplier. Doubling means multiply by 2. A half-life means multiply by 1/2.",
      "The exponent is the number of multiplications, or the time divided by the half-life.",
      "Set the expression equal to the target and match bases.",
    ],
    formalTitle: "When the exponent is a whole number",
    formal: [
      "For a positive start a and integer base b > 1, a times b to the t equals a times b to the n exactly when t = n.",
      "For a half-life of h units, a times (1/2) to the t/h equals a over 2 to the k when t = k times h.",
      "Algebra 1 solves these by matching bases. Logarithms are not required.",
    ],
    pitfalls: [
      "Reading doubles as adds 2, which writes a linear equation.",
      "Dropping the starting amount, so only the power remains.",
      "Dividing the target by the start and stopping, as if the change were linear.",
    ],
    parentGuide:
      "Ask what happens after one hour, then two. If the amount doubles, the next step multiplies. It does not add the same number.",
  }),
];

export const exponentialContextEquationFacetMappings: FacetMapping[] = [
  {
    templateId: "exponential-context-equation",
    facetId: "nonlinear-equation-modeling.HSA.CED.A.1",
    extent: "partial",
    rationale:
      "Choose and solve an exponential equation from a repeated multiplier or a half-life, by matching bases. Does not assess logarithms, graphing, or writing the equation without choices.",
  },
  {
    templateId: "exponential-context-equation",
    facetId: "nonlinear-equation-modeling.core",
    extent: "partial",
    rationale:
      "Model a doubling, tripling or half-life with an exponential equation and solve for a small whole-number time. Does not assess quadratic or rational models.",
  },
];
