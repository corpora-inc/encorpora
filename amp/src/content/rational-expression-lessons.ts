import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
const terms: MethodTerm[] = [
  "rational-expression",
  "polynomial",
  [
    "domain",
    "For an expression, it is every input for which the expression is defined.",
  ],
  "factor-number",
];
const senses: Lesson["senses"] = {
  factor: "factor-number",
  factors: "factor-number",
  product: "product-multiply",
  term: "term-expression",
  terms: "term-expression",
  square: "square-number",
  squared: "square-number",
  hole: "hole",
  base: "base-exponent",
  bases: "base-exponent",
  identity: "identity-equation",
  "standard form": "standard-form-polynomial",
  "left side": "side-of-equation",
  "right side": "side-of-equation",
};
const noLink = [
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
export const rationalExpressionMethods: Record<string, ProblemMethod> = {
  "rational-expression-domain": {
    goal: "Find every value of $x$ that makes the bottom of the fraction equal to 0. Those inputs are not allowed.",
    intuition:
      "An expression is a calculation written with numbers and letters. A rational expression is a fraction with a polynomial (a sum of parts like $x^2$, $5x$ and 6) on top and on the bottom, like $\\frac{x - 3}{(x - 2)(x - 4)}$. The top is the numerator and the bottom is the denominator. Dividing by 0 has no answer. A value put in for $x$ is called an input, and an input that makes the denominator 0 is not allowed. The allowed inputs are called the domain. The parts being multiplied in the denominator are its factors. A product, the result of multiplying, is 0 when any one of its factors is 0, so each factor that can be 0, like $x - 2$, gives an excluded input.",
    terms,
    senses,
    noLink,
    method: [
      "Factor the original denominator. Set each factor equal to 0 and solve each small equation.",
      "List each different excluded value once. It stays excluded even if the same factor also appears on top.",
    ],
    watch:
      "A top of 0 is fine as long as the bottom is not 0. Only the bottom decides which inputs are excluded.",
  },
  "rational-expression-simplify": {
    goal: "Simplify the fraction, and keep every input the original fraction did not allow.",
    intuition:
      "A rational expression is a fraction with a polynomial (a sum of parts like $x^2$, $5x$ and 6) on top, called the numerator, and on the bottom, called the denominator. The parts being multiplied in each are called factors. The result of multiplying them is called a product. Just as $\\frac{6}{10} = \\frac{3}{5}$ because 6 and 10 share a factor 2, you may divide the top and bottom by a shared factor that is not 0. But any input that made the original bottom 0 is still not allowed. The allowed inputs are called the domain.",
    terms,
    senses,
    noLink,
    method: [
      "Factor the original top and bottom. Find every input that makes the original bottom 0, and write those down as excluded.",
      "Divide the top and bottom by a factor they share. Keep all the original exclusions with the simplified fraction.",
      "Check that top and bottom have not swapped places, and that the cancelled factor's zero is still listed as excluded.",
    ],
    watch:
      "Cancel factors that are multiplied. Never cancel terms, the parts being added together. Factor first so the factors are visible.",
  },
};
export const rationalExpressionPrinciples: Record<string, string> = {
  "rational-expression-domain":
    "A rational expression is defined exactly where its original denominator is not 0. A product is 0 when at least one of its factors is 0, so each denominator factor that can be 0 gives excluded inputs.",
  "rational-expression-simplify":
    "Dividing a fraction's top and bottom by the same factor keeps its value wherever that factor is not 0. Cancelling a factor does not make an excluded input allowed again.",
};
export const rationalExpressionLessons: Lesson[] = [
  {
    id: "rational-expressions-and-excluded-inputs",
    title: "Simplify the fraction, keep its boundaries",
    summary:
      "You cannot divide by 0. So in a fraction like $\\frac{x - 3}{x - 4}$, the input $x = 4$ is not allowed: it makes the bottom $4 - 4 = 0$. First find every input that makes the bottom 0. Then simplify the fraction by dividing top and bottom by a shared part. The inputs you ruled out at the start stay ruled out.",
    templateIds: ["rational-expression-domain", "rational-expression-simplify"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Find the excluded inputs: the values of $x$ that make a factor of the bottom equal to 0.",
      "Simplify a fraction of expressions while keeping every input the original did not allow.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Which inputs are allowed?",
        paragraphs: [
          "A variable is a letter, like $x$, that stands for a number. An expression is a calculation written with numbers and variables. Factoring means writing an expression as parts multiplied together, which are called factors. You will need to solve small equations like $x - 2 = 0$ and to factor quadratics. An expression such as $x^2 - 5x + 6$, made of whole-number powers of $x$ times numbers, added together, is called a polynomial.",
          "A rational expression is a fraction with a polynomial on top and a polynomial on the bottom. The top is called the numerator. The bottom is called the denominator.",
          "Dividing by 0 has no answer. So a fraction only makes sense when its denominator is not 0. The inputs where it makes sense are called its domain. To find the inputs that are not allowed (the excluded inputs), ask which values of $x$ make the original denominator 0. A numerator of 0 is fine, as long as the denominator is not 0.",
          "A factor is a part that is multiplied by another part. In $(x - 2)(x - 4)$, the factors are $x - 2$ and $x - 4$. A product, the result of multiplying, is 0 when any one factor is 0, so this is 0 at $x = 2$ and at $x = 4$.",
          "Fractions can be simplified by dividing top and bottom by a shared factor: $\\frac{6}{10} = \\frac{3}{5}$, dividing both by 2. A rational expression works the same way. But a factor with $x$ in it can be 0 for some input. So write down the excluded inputs before you simplify.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Simplify $\\dfrac{x^2 - 5x + 6}{x^2 - 6x + 8}$ and state all excluded inputs.",
      steps: [
        "Factor the top and the bottom. Look for two numbers that multiply to the last number and add to the middle one: $x^2 - 5x + 6 = (x - 2)(x - 3)$ and $x^2 - 6x + 8 = (x - 2)(x - 4)$.",
        "Find the excluded inputs from the original bottom. It is 0 when $x - 2 = 0$ or $x - 4 = 0$, so $x = 2$ and $x = 4$ are excluded.",
        "At every allowed input, $x - 2$ is not 0. So divide the top and bottom by it: $\\dfrac{(x - 2)(x - 3)}{(x - 2)(x - 4)} = \\dfrac{x - 3}{x - 4}$.",
        "Keep both exclusions. At $x = 2$, the simplified fraction gives $\\frac{-1}{-2} = \\frac{1}{2}$. But the original gives $\\frac{0}{0}$, which has no value. Cancelling does not fill in that missing input.",
      ],
      answer:
        "$\\dfrac{x - 3}{x - 4}$; excluded inputs: $\\left\\{2, 4\\right\\}$.",
    },
    closingSections: [
      {
        stage: "method",
        title: "See the missing input",
        paragraphs: [
          "The curve follows the simplified rule $y = \\frac{x - 3}{x - 4}$. The open circle at $\\left(2, \\frac{1}{2}\\right)$ marks the point the original expression cannot reach. A gap like this is called a hole.",
          "The dashed line at $x = 4$ marks the other excluded input. The curve has no point there at all.",
        ],
        illustration: "rational-expression-hole",
      },
      {
        title: "The precise rule",
        paragraphs: [
          "Let $P$, $Q$, $C$, $F$ and $G$ be polynomials in $x$, where $x$ is a real number (a number on the number line). Suppose $P(x) = C(x)F(x)$ and $Q(x) = C(x)G(x)$. Here $P(x)$, read “$P$ of $x$”, means the value of $P$ at $x$. The domain of $\\frac{P(x)}{Q(x)}$ is exactly the inputs where $Q(x) \\ne 0$ ($\\ne$ means is not equal to).",
          "For every input in that domain, $C(x)$ and $G(x)$ are both not 0. So $\\dfrac{P(x)}{Q(x)} = \\dfrac{C(x)F(x)}{C(x)G(x)} = \\dfrac{F(x)}{G(x)}$. The simplified fraction must keep the original condition $Q(x) \\ne 0$ to describe the same expression. On its own, $\\frac{F(x)}{G(x)}$ may allow more inputs.",
        ],
      },
    ],
    pitfalls: [
      "Find the excluded inputs from the original bottom before cancelling anything.",
      "Cancel factors that are multiplied. Never cross out terms, the parts being added together.",
      "A cancelled factor like $x - 2$, which is 0 for some input, still gives an excluded input.",
    ],
    parentGuide:
      "Ask which inputs make the original bottom 0, and why the simplified fraction can sometimes accept more inputs. Have the learner try the cancelled input, $x = 2$, in both forms.",
  },
];
