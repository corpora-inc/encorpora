import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: [string, string][] = [
  [
    "rational equation",
    "An equation containing a quotient of polynomials. A polynomial is a sum of constant multiples of nonnegative whole-number powers of a variable.",
  ],
  [
    "domain",
    "The inputs for which every expression in the original equation is defined.",
  ],
  ["solution", "An allowed input that makes the original equation true."],
  [
    "excluded input",
    "An input that makes an original denominator zero; division by zero is undefined.",
  ],
];
const method: ProblemMethod = {
  goal: "Solve the equation while preserving its original domain.",
  intuition:
    "A fraction with a variable in its denominator is undefined when that denominator is zero. Find those inputs first, then check each answer in the original equation.",
  terms,
  method: [
    "Record every input that makes an original denominator zero.",
    "For allowed inputs, multiply both sides by the denominator. Solve the resulting equation using equal operations on both sides.",
    "Reject excluded candidates and check any remaining candidate in the original equation. An identity holds for all allowed inputs; a false constant equality has no solutions.",
  ],
  watch:
    "Keep the original exclusions after clearing a denominator. A candidate from the cleared equation may be forbidden in the original equation.",
};
export const rationalEquationMethods: Record<string, ProblemMethod> = {
  "rational-equation-one-denominator": method,
  "rational-equation-check": method,
};
export const rationalEquationPrinciples: Record<string, string> =
  Object.fromEntries(
    Object.keys(rationalEquationMethods).map((id) => [
      id,
      "Multiplying both sides of an equation by a nonzero quantity preserves equivalence. Restrict to the original domain before clearing denominators, and retain that restriction in the solution set.",
    ]),
  );
export const rationalEquationLessons: Lesson[] = [
  {
    id: "rational-equations-and-original-domain",
    title: "Clear the denominator, check the input",
    summary:
      "A fraction with a variable in its denominator can be undefined for one input. Find that input before solving, then check the answer in the original equation.",
    templateIds: Object.keys(rationalEquationMethods),
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve a rational equation with a linear denominator.",
      "Distinguish a valid answer, an excluded candidate, an identity and a contradiction.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which numbers can solve it?",
        paragraphs: [
          "A denominator is the expression below a fraction bar. In $1/(x-2)$, choosing $x=2$ would divide by zero, so that choice is forbidden before any solving begins. A solution must make the original equation defined and true.",
          "A rational equation contains a quotient of polynomials. A polynomial is a sum of constant multiples of nonnegative whole-number powers of a variable, such as $2x+1$. You need fraction arithmetic and linear-equation solving for this lesson.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $\\dfrac{x + 1}{x - 2} = 3$ over the real numbers.",
      steps: [
        "The denominator $x - 2$ is zero at $x = 2$. Record $x \\ne 2$.",
        "On that domain, multiply both sides by $x - 2$: $x + 1 = 3(x - 2) = 3x - 6$.",
        "Subtract $x$ from both sides and add 6 to both sides: $7 = 2x$. Divide by 2: $x = \\frac{7}{2}$.",
        "This input is allowed. In the original fraction, the numerator becomes $\\frac{7}{2} + 1 = \\frac{9}{2}$ and the denominator becomes $\\frac{7}{2} - 2 = \\frac{3}{2}$. Their quotient is $\\frac{9}{2} \\div \\frac{3}{2} = 3$.",
      ],
      answer: "$x = \\frac{7}{2}$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "See the solution as a crossing",
        paragraphs: [
          "The curve gives $y = (x + 1)/(x - 2)$, and the horizontal line gives $y = 3$. Their crossing at $(7/2, 3)$ identifies the input that makes both sides equal. The dashed vertical marker at $x = 2$ is excluded: the curve has no point there.",
        ],
        illustration: "rational-equation-crossing",
      },
      {
        stage: "method",
        title: "When clearing gives a misleading candidate",
        paragraphs: [
          "For $\\dfrac{2x - 6}{x - 3} = 5$, first exclude $x = 3$. Clearing gives $2x - 6 = 5x - 15$, then $9 = 3x$ and $x = 3$. That input is forbidden: substituting it gives $0/0$, which is undefined. The equation has no real solution.",
          "For $\\dfrac{2x - 6}{x - 3} = 2$, keep the same exclusion. Clearing gives $2x - 6 = 2x - 6$, true for every allowed input. Every real number except 3 is a solution. By contrast, $\\dfrac{2x + 1}{x} = 2$ gives $2x + 1 = 2x$, then $1 = 0$. That is false, so there are no solutions.",
        ],
      },
      {
        stage: "formal",
        title: "The precise rule",
        paragraphs: [
          "Let $N(x)$ and $D(x)$ be real polynomials, and let $c$ be a real constant. For every input with $D(x) \\ne 0$, the equality $N(x)/D(x) = c$ holds if and only if $N(x) = cD(x)$.",
          "The solution set is exactly the set of real inputs satisfying both $N(x) - cD(x) = 0$ and $D(x) \\ne 0$. If the difference is identically zero, every input in the original domain is a solution. If it is a nonzero constant, there are no solutions.",
        ],
      },
    ],
    pitfalls: [
      "Record exclusions before multiplying.",
      "Check candidates in the original equation.",
      "An identity does not restore an excluded input.",
    ],
    parentGuide:
      "Ask which multiplication is allowed, why its factor is nonzero, and whether each candidate makes the original fraction defined.",
  },
];
