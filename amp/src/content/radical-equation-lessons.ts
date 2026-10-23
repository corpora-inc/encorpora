import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: [string, string][] = [
  [
    "square root",
    "The principal square root is the nonnegative number whose square equals the given number. For example, $\\sqrt{9} = 3$, not −3.",
  ],
  [
    "radicand",
    "The expression under the root symbol. It must be nonnegative for a real square root.",
  ],
  [
    "candidate",
    "A possible solution found after transforming an equation; it must still satisfy the original equation.",
  ],
  [
    "extraneous candidate",
    "A value that satisfies a transformed equation but not the original equation.",
  ],
];
const basic: ProblemMethod = {
  goal: "Isolate a square root, then find and check the input.",
  terms,
  method: [
    "Undo any addition or subtraction outside the square root by applying the same operation to both sides.",
    "Check the isolated right side: a negative number cannot equal a square root. Otherwise square both sides and solve the resulting linear equation.",
    "Substitute the result into the original equation. Check that the radicand is nonnegative and both sides agree.",
  ],
  watch:
    "Square only after isolating the root. The square-root symbol gives one nonnegative value; do not add an extra negative root.",
};
export const radicalEquationMethods: Record<string, ProblemMethod> = {
  "radical-equation-isolated": basic,
  "radical-equation-shifted": basic,
  "radical-equation-check": {
    ...basic,
    goal: "Find every candidate from squaring, then keep exactly the original equation's solutions.",
    method: [
      "Require a nonnegative radicand and a nonnegative expression on the other side of the isolated square root.",
      "Square both sides, collect terms, and solve the resulting quadratic equation. Keep a list of every candidate.",
      "Substitute each candidate into the original equation. Retain it only when the root is defined and the two sides are equal.",
    ],
    watch:
      "Squaring removes sign information: opposite numbers have equal squares. Check every candidate in the original equation.",
  },
};
export const radicalEquationPrinciples: Record<string, string> =
  Object.fromEntries(
    Object.keys(radicalEquationMethods).map((id) => [
      id,
      "For real quantities, $\\sqrt{A} = B$ holds exactly when $A = B^2$ and $B \\ge 0$. The equation $A = B^2$ ensures $A \\ge 0$, but it does not ensure the sign of $B$.",
    ]),
  );
export const radicalEquationLessons: Lesson[] = [
  {
    id: "square-root-equations-and-checks",
    title: "Square carefully, check the answer",
    summary:
      "Solve equations with square roots and see why squaring can introduce a false candidate.",
    templateIds: Object.keys(radicalEquationMethods),
    includeGeneratedRepresentation: false,
    objectives: [
      "Isolate a square root before squaring.",
      "Check signs, domains and all candidate solutions in the original equation.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Undo the root without losing its sign",
        paragraphs: [
          "You need to solve linear equations; the harder examples also use factoring of quadratics. The principal square root is the nonnegative number whose square is the number under the root symbol: $\\sqrt{9} = 3$, even though both 3 and −3 have square 9. The expression under the symbol is the radicand. For real numbers, it must be nonnegative.",
          "First get the root alone. For $\\sqrt{2x + 1} + 3 = 8$, subtract 3 from both sides to get $\\sqrt{2x + 1} = 5$. Both sides are nonnegative, so squaring preserves equivalence: $2x + 1 = 25$, then $2x = 24$ and $x = 12$. Check: $\\sqrt{2(12) + 1} + 3 = 5 + 3 = 8$.",
          "When the other side contains the unknown, its sign can change. Squaring may then introduce an extraneous candidate: a value that works after squaring but fails in the original equation. For example, 3 and −3 have equal squares but are not equal.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $\\sqrt{x + 2} = x$ over the real numbers.",
      steps: [
        "The radicand requires $x + 2 \\ge 0$. The right side must also be nonnegative: $x \\ge 0$.",
        "Square both sides to find candidates: $x + 2 = x^2$. Subtract $x + 2$ to get $x^2 - x - 2 = 0$.",
        "Factor: $(x - 2)(x + 1) = 0$. A product is zero only if at least one factor is zero, so the candidates are $x = 2$ and $x = -1$.",
        "For $x = 2$, the original equation gives $\\sqrt{2 + 2} = 2$, which is true.",
        "For $x = -1$, it gives $\\sqrt{-1 + 2} = -1$. The left side is 1, so the sides differ. Reject −1.",
      ],
      answer: "The only real solution is $x = 2$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "See where the two sides meet",
        paragraphs: [
          "The curve shows $y = \\sqrt{x + 2}$; it starts at $(-2, 0)$ and never goes below the horizontal axis. The line shows $y = x$. They meet at $(2, 2)$. At $x = -1$, the curve's height is 1 and the line's height is −1. Squaring would make those heights equal, but the original heights are different.",
        ],
        illustration: "radical-equation-crossing",
      },
      {
        stage: "method",
        title: "Zero or two solutions can also occur",
        paragraphs: [
          "The equation $\\sqrt{x + 2} = -3$ has no real solution: its left side is nonnegative and its right side is negative. Squaring gives a candidate, but no candidate can fix that sign mismatch.",
          "For $\\sqrt{3x - 2} = x$, squaring gives $x^2 - 3x + 2 = (x - 1)(x - 2) = 0$. Both candidates work: $\\sqrt{3(1) - 2} = 1$ and $\\sqrt{3(2) - 2} = 2$. Check every candidate rather than assuming there is exactly one solution.",
        ],
      },
      {
        title: "The precise rule",
        paragraphs: [
          "For real-valued expressions $A(x)$ and $B(x)$, an input solves $\\sqrt{A(x)} = B(x)$ if and only if both expressions are defined there, $A(x) = B(x)^2$, and $B(x) \\ge 0$.",
          "The forward direction follows by squaring an equality and using the nonnegative value of a principal square root. Conversely, $A(x) = B(x)^2$ ensures a nonnegative radicand. Then $\\sqrt{A(x)} = |B(x)| = B(x)$ because $B(x) \\ge 0$. Without that sign condition, squaring alone is not reversible.",
        ],
      },
    ],
    pitfalls: [
      "Isolate the root before squaring.",
      "Check the radicand and the other side's sign.",
      "Test every candidate in the original equation.",
    ],
    parentGuide:
      "Ask why a candidate might pass the squared equation but fail the original. Have the learner compare both original sides separately.",
  },
];
