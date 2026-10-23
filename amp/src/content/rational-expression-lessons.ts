import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: [string, string][] = [
  [
    "rational expression",
    "A quotient of polynomials, defined only where its denominator is nonzero.",
  ],
  [
    "polynomial",
    "A sum of constant multiples of nonnegative whole-number powers of a variable, such as $x^2 - 5x + 6$.",
  ],
  ["domain", "The inputs for which an expression is defined."],
  [
    "factor",
    "An expression multiplied by another expression to make a product.",
  ],
];
export const rationalExpressionMethods: Record<string, ProblemMethod> = {
  "rational-expression-domain": {
    goal: "Find every input that makes the original denominator zero.",
    terms,
    method: [
      "Set each factor of the original denominator equal to 0 and solve the resulting equations.",
      "List each distinct excluded value once. Keep it excluded even if the same factor appears in the numerator.",
    ],
    watch:
      "A zero numerator is allowed when the denominator is nonzero; exclusions come from the denominator.",
  },
  "rational-expression-simplify": {
    goal: "Simplify the fraction and keep the original excluded inputs.",
    terms,
    method: [
      "Factor the original numerator and denominator. Find every input that makes the original denominator zero and record those exclusions.",
      "Divide numerator and denominator by a common nonzero factor. Keep all original exclusions with the simplified expression.",
      "Check that the remaining numerator and denominator have not been inverted and that the cancelled factor’s zero is still excluded.",
    ],
    watch:
      "Cancel common factors of a product, not individual terms of a sum. Factoring first exposes the factors.",
  },
};
export const rationalExpressionPrinciples: Record<string, string> = {
  "rational-expression-domain":
    "A rational expression is defined exactly where its original denominator is nonzero. A product is zero if at least one factor is zero.",
  "rational-expression-simplify":
    "Dividing a fraction’s numerator and denominator by the same nonzero factor preserves its value on its original domain. Cancelling a factor does not restore an excluded input.",
};
export const rationalExpressionLessons: Lesson[] = [
  {
    id: "rational-expressions-and-excluded-inputs",
    title: "Simplify the fraction, keep its boundaries",
    summary:
      "Find the inputs a fraction cannot accept, then simplify without losing those restrictions.",
    templateIds: ["rational-expression-domain", "rational-expression-simplify"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find excluded inputs from denominator factors.",
      "Simplify a rational expression while retaining its original domain.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which inputs are allowed?",
        paragraphs: [
          "You need to solve simple linear equations and factor quadratics. A variable stands for a number. A polynomial is an expression such as $x^2 - 5x + 6$, built from sums of constant multiples of whole-number powers of a variable. A rational expression is a quotient of two polynomials: a fraction with these expressions above and below its bar.",
          "The numerator is above the bar; the denominator is below it. A fraction is defined only when its denominator is nonzero. Its domain is the set of inputs for which it is defined. To find excluded inputs, ask which values make the original denominator 0. A numerator of 0 is allowed when the denominator is nonzero.",
          "A factor is an expression multiplied by another to make a product. Just as $6/10 = 3/5$ because both parts share a nonzero factor of 2, a rational expression can have a shared factor divided out. A variable factor can be zero, however. Record the exclusions before simplifying.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Simplify $\\dfrac{x^2 - 5x + 6}{x^2 - 6x + 8}$ and state all excluded inputs.",
      steps: [
        "Factor both parts: $x^2 - 5x + 6 = (x - 2)(x - 3)$ and $x^2 - 6x + 8 = (x - 2)(x - 4)$.",
        "The denominator is 0 when $x - 2 = 0$ or $x - 4 = 0$. Thus $x = 2$ and $x = 4$ are excluded.",
        "At any allowed input, $x - 2$ is nonzero. Divide numerator and denominator by that factor: $\\dfrac{(x - 2)(x - 3)}{(x - 2)(x - 4)} = \\dfrac{x - 3}{x - 4}$.",
        "Keep both exclusions. At $x = 2$, the simplified formula gives $\\frac{-1}{-2} = \\frac{1}{2}$, but the original expression gives $0/0$, which is undefined. Cancelling does not fill that missing input.",
      ],
      answer:
        "$\\dfrac{x - 3}{x - 4}$; excluded inputs: $\\left\\{2, 4\\right\\}$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "See the missing input",
        paragraphs: [
          "The curve follows the simplified rule $y = (x - 3)/(x - 4)$. The open circle at $\\left(2, \\frac{1}{2}\\right)$ removes the value that the original expression cannot take. The dashed marker at $x = 4$ marks the other excluded input; there is no point of the curve at that input.",
        ],
        illustration: "rational-expression-hole",
      },
      {
        title: "The precise rule",
        paragraphs: [
          "Let $P$, $Q$, $C$, $F$ and $G$ be polynomials in the real variable $x$, with $P(x) = C(x)F(x)$ and $Q(x) = C(x)G(x)$. The domain of $P(x)/Q(x)$ is exactly the real inputs satisfying $Q(x) \\ne 0$.",
          "For every input in that original domain, both $C(x)$ and $G(x)$ are nonzero, so $\\dfrac{P(x)}{Q(x)} = \\dfrac{C(x)F(x)}{C(x)G(x)} = \\dfrac{F(x)}{G(x)}$. The simplified formula must carry the original restriction $Q(x) \\ne 0$ to describe the same expression on the same inputs. The formula $F(x)/G(x)$ by itself may have a larger domain.",
        ],
      },
    ],
    pitfalls: [
      "Find exclusions from the original denominator before cancelling.",
      "Cancel common multiplicative factors; do not cross out terms joined by addition or subtraction.",
      "A cancelled denominator factor still contributes an excluded input.",
    ],
    parentGuide:
      "Ask which inputs make the original denominator zero, and why the simplified formula can sometimes accept more inputs. Have the learner test the cancelled input in both forms.",
  },
];
