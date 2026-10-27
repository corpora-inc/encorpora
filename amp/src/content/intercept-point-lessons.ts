import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const interceptPointMethods: Record<string, ProblemMethod> = {
  "intercept-point-choice": {
    goal: "Find where a line meets an axis, and give it as an ordered pair, as a zero, or as a sum of coordinates.",
    intuition:
      "A line meets the $x$-axis where its height is 0 and the $y$-axis where it is 0 steps from the vertical axis. Each meeting point is one ordered pair with a 0 in it, and its other coordinate is the number to find.",
    terms: [
      [
        "$y$-intercept",
        "The point where a graph meets the $y$-axis. Its $x$-coordinate is 0, so it is written $(0, b)$.",
      ],
      [
        "$x$-intercept",
        "The point where a graph meets the $x$-axis. Its $y$-coordinate is 0, so it is written $(a, 0)$.",
      ],
      [
        "zero of a function",
        "An input $x$ whose output $f(x)$ is 0. It is the $x$-coordinate of an $x$-intercept.",
      ],
    ],
    method: [
      "For the $y$-intercept, set $x = 0$ and solve for $y$. For the $x$-intercept, set $y = 0$ and solve for $x$. On a graph, read the value where the line meets that axis.",
      "Solve the one-variable equation exactly. A fraction stays a fraction: divide the constant by the coefficient.",
      "Write the answer in the form the question asks: an ordered pair with $x$ first, the zero as a single $x$-value, or the sum of the two nonzero coordinates with their signs.",
    ],
    watch:
      "Do not swap the coordinates. A point on the $y$-axis is $(0, y)$, and a point on the $x$-axis is $(x, 0)$.",
  },
};

export const interceptPointPrinciples: Record<string, string> = {
  "intercept-point-choice":
    "A point lies on the graph of an equation exactly when its coordinates satisfy the equation. The $y$-axis is the set of points with $x = 0$ and the $x$-axis is the set with $y = 0$. So for $ax + by = c$ the $y$-intercept is $(0, c/b)$ when $b \\ne 0$ and the $x$-intercept is $(c/a, 0)$ when $a \\ne 0$. For $y = mx + k$ the $y$-intercept is $(0, k)$ and, when $m \\ne 0$, the $x$-intercept is $(-k/m, 0)$. A zero of the function is the first coordinate of an $x$-intercept.",
};

export const interceptPointLessons = [
  chainLesson({
    id: "intercept-point-lesson",
    title: "Intercepts as ordered pairs",
    summary:
      "Find where a line crosses each axis from its graph or its rule, and write the point, the zero or the sum.",
    templateIds: ["intercept-point-choice"],
    objectives: [
      "Find the $y$-intercept by setting $x = 0$ and the $x$-intercept by setting $y = 0$.",
      "Write an intercept as an ordered pair with $x$ first, and tell it from the zero of a function.",
    ],
    openingTitle: "Each axis crossing has a 0 in its pair",
    opening: [
      "The $y$-axis is the vertical line where every point has $x = 0$. A line crosses it at one point, written $(0, b)$. That point is the $y$-intercept.",
      "The $x$-axis is the horizontal line where every point has $y = 0$. A line crosses it at $(a, 0)$, the $x$-intercept. The number $a$ alone is the zero of the function: the input that makes the output 0.",
    ],
    example: {
      prompt: "Which ordered pair is the $x$-intercept of $3x - 4y = 10$?",
      steps: [
        "On the $x$-axis $y = 0$. Substitute: $3x - 4(0) = 10$, so $3x = 10$.",
        "Divide both sides by 3: $x = \\tfrac{10}{3}$.",
        "Write $x$ first: the $x$-intercept is $\\left(\\tfrac{10}{3}, 0\\right)$.",
      ],
      answer: "$\\left(\\tfrac{10}{3}, 0\\right)$",
    },
    methodTitle: "Set one variable to 0",
    method: [
      "$y$-intercept: put $x = 0$ in the rule and solve for $y$. In $y = mx + k$ this is just $k$.",
      "$x$-intercept: put $y = 0$ and solve for $x$. In $y = mx + k$ this is $x = -k \\div m$, so divide by the slope, which may be a fraction.",
      "On a graph, find where the line meets the axis and read that one coordinate. If the question asks for a sum, add the two nonzero coordinates with their signs.",
    ],
    formalTitle: "Intercepts of a line",
    formal: [
      "For $ax + by = c$ with $a \\ne 0$ and $b \\ne 0$, the $x$-intercept is $(c/a, 0)$ and the $y$-intercept is $(0, c/b)$. For $y = mx + k$ with $m \\ne 0$, they are $(-k/m, 0)$ and $(0, k)$.",
      "A zero of $f$ is an input $x$ with $f(x) = 0$. For a linear function, the zero is the first coordinate of the $x$-intercept.",
    ],
    pitfalls: [
      "Writing $(y, 0)$ for the $y$-intercept. The point on the $y$-axis has $x = 0$, so it is $(0, y)$.",
      "Reading the constant $k$ of $y = mx + k$ as the $x$-intercept. It is the $y$-value where $x = 0$.",
      "Stopping at $-k$ when finding a zero of $y = mx + k$. Also divide by the slope $m$.",
      "Dropping a sign when adding intercept coordinates. A negative coordinate lowers the sum.",
    ],
    parentGuide:
      "Ask which variable is 0 on each axis. Then have your learner substitute that 0 and solve the short equation that is left.",
  }),
];

export const interceptPointFacetMappings: FacetMapping[] = [
  {
    templateId: "intercept-point-choice",
    facetId: "graph-solution-sets.core",
    extent: "partial",
    rationale:
      "Choose the x-intercept or y-intercept of a graphed line or of a line given in standard or slope-intercept form as an ordered pair, choose the zero of a linear function, or choose the sum of the two nonzero intercept coordinates. Does not assess sketching a line from its intercepts, intercepts of nonlinear graphs, or interpreting an intercept in a context.",
  },
];
