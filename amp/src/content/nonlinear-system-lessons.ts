import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: [string, string][] = [
  [
    "system",
    "Equations that must hold for the same values of their variables.",
  ],
  [
    "intersection",
    "A point shared by two graphs; its coordinates satisfy both equations.",
  ],
  [
    "parabola",
    "The curved graph of a quadratic function, whose highest variable power is two.",
  ],
];
export const nonlinearSystemMethods: Record<string, ProblemMethod> = {
  "nonlinear-system-read": {
    goal: "Read the requested coordinate of a shared point.",
    terms,
    method: [
      "Find where the solid parabola meets the dashed line. Both graphs must contain the same point.",
      "Choose the crossing with the smaller or larger horizontal coordinate, as requested. Read its coordinate from the axes.",
    ],
    watch:
      "Smaller means farther left for the horizontal coordinate, even when both values are negative.",
  },
  "nonlinear-system-solve": {
    goal: "Find the requested coordinate by substitution and factoring.",
    terms,
    method: [
      "Both equations give $y$, so set their right sides equal and move all terms to one side.",
      "Factor the quadratic and set each variable factor equal to zero. Substitute each root into the line to recover its vertical coordinate.",
      "Choose by the requested horizontal coordinate, then report the requested coordinate. Check the pair in both original equations.",
    ],
    watch:
      "A root supplies only the horizontal coordinate. Recover the vertical coordinate before reporting a complete point.",
  },
  "nonlinear-system-count": {
    goal: "Count distinct real intersections without finding every coordinate.",
    terms: [
      ...terms,
      [
        "discriminant",
        "For $Ax^2 + Bx + C = 0$, the quantity $B^2 - 4AC$ determines the number of real roots when $A$ is nonzero.",
      ],
    ],
    method: [
      "Set the two expressions for $y$ equal and collect terms to obtain a quadratic equal to zero.",
      "Compute its discriminant. Positive gives two distinct real roots; zero gives one; negative gives none.",
      "Each real root gives exactly one point on the line. Count a repeated root only once.",
    ],
    watch:
      "Compute the discriminant after subtracting the line's expression, not from the original parabola alone.",
  },
};
export const nonlinearSystemPrinciples: Record<string, string> =
  Object.fromEntries(
    Object.keys(nonlinearSystemMethods).map((id) => [
      id,
      "At a shared point the line and parabola have the same output for the same input. Equating their outputs reduces the system to a quadratic equation.",
    ]),
  );

export const nonlinearSystemLessons: Lesson[] = [
  {
    id: "line-meets-parabola",
    title: "Where a line meets a parabola",
    summary: "Find the places where two rules give the same point.",
    templateIds: [
      "nonlinear-system-read",
      "nonlinear-system-solve",
      "nonlinear-system-count",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Connect shared graph points with solutions of both equations.",
      "Use substitution to find or count line–parabola intersections.",
    ],
    sections: [
      {
        title: "Two rules, the same point",
        paragraphs: [
          "You need to substitute numbers into expressions and factor simple quadratics. A variable stands for a number. An ordered pair $(x, y)$ gives a horizontal coordinate first and a vertical coordinate second.",
          "A system asks for values that make both equations true at once. On a graph, its solutions are intersections: points shared by both graphs. A line is straight; a parabola is the curve drawn by a quadratic rule, which includes a squared variable.",
          "If both rules say what $y$ equals, their outputs must agree at a shared point. Set those outputs equal. This leaves an equation in just $x$.",
        ],
      },
    ],
    workedExample: {
      prompt: "Find every shared point of $y = x^2$ and $y = x + 2$.",
      steps: [
        "At a shared point both expressions equal $y$, so $x^2 = x + 2$.",
        "Subtract $x + 2$ from both sides: $x^2 - x - 2 = 0$. Factor: $(x - 2)(x + 1) = 0$.",
        "A product is zero only if a factor is zero. Thus $x = 2$ or $x = -1$.",
        "Use $y = x + 2$: the two points are $\\left(2, 4\\right)$ and $\\left(-1, 1\\right)$. Check: $2^2 = 4 = 2 + 2$ and $(-1)^2 = 1 = -1 + 2$.",
      ],
      answer: "$\\left(-1, 1\\right)$ and $\\left(2, 4\\right)$",
    },
    closingSections: [
      {
        title: "See the same solutions",
        paragraphs: [
          "Trace the parabola and the straight line. At $\\left(-1, 1\\right)$ and $\\left(2, 4\\right)$ they occupy the same point. An intersection is a whole ordered pair, not just the horizontal value found by factoring.",
        ],
        illustration: "nonlinear-system-example",
      },
      {
        title: "The general rule",
        paragraphs: [
          "Let $a$, $b$, $c$, $m$ and $n$ be real constants with $a \\ne 0$. A constant is a fixed number. The system $y = ax^2 + bx + c$, $y = mx + n$ is equivalent to $ax^2 + (b-m)x + (c-n) = 0$, together with $y = mx + n$. Subtracting equal quantities preserves equality, and substitution recovers every shared point.",
          "For a quadratic $Ax^2 + Bx + C = 0$ with $A \\ne 0$, the quadratic formula gives $x = (-B \\pm \\sqrt{B^2 - 4AC})/(2A)$. The symbol $\\pm$ means take the plus and minus cases. The discriminant is $D = B^2 - 4AC$: if $D > 0$ there are two distinct real roots; if $D = 0$ there is one; if $D < 0$ there are none, because a real square cannot be negative. Each real root gives exactly one vertical coordinate on the line.",
        ],
      },
    ],
    pitfalls: [
      "A point on only one graph is not a solution of the system.",
      "Choose the point by its horizontal coordinate before reporting a requested vertical coordinate.",
      "A repeated root is one distinct intersection, not two.",
    ],
    parentGuide:
      "Ask the learner to check each proposed point in both rules, then explain why setting the outputs equal finds their shared points.",
  },
];
