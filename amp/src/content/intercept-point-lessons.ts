import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/** Glossary readings for the intercept lesson and its method. */
const senses = {} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "mean",
  "side",
  "sides",
  "left side",
  "right side",
  "term",
  "terms",
  "rule",
  "rules",
];

export const interceptPointMethods: Record<string, ProblemMethod> = {
  "intercept-point-choice": {
    goal: "Find where a line crosses an axis, and give it as a point, as a zero, or as a sum of coordinates.",
    senses,
    noLink,
    intuition:
      "A point is written $(x, y)$. Its two numbers are called its coordinates: $x$ says how far across, $y$ how far up. The $x$-axis is the across line, where every point has $y = 0$. The $y$-axis is the up-and-down line, where every point has $x = 0$. An intercept is a point where a line crosses an axis. So each intercept has a 0 in it, and the other number is the one to find.",
    terms: ["y-intercept", "x-intercept", "zero-of-a-function"],
    method: [
      "For the $y$-intercept, put $x = 0$ into the equation and solve for $y$. For the $x$-intercept, put $y = 0$ and solve for $x$. On a graph, read where the line meets that axis.",
      "Solve the one-letter equation exactly. Move the plain number to the other side first, then divide by the number multiplying the letter. A fraction stays a fraction.",
      "Answer in the form asked: a point $(x, y)$ with $x$ first, a zero (an $x$ value where $y$ is 0), or the sum of the two intercept numbers that are not 0, signs included.",
    ],
    watch:
      "Do not swap the numbers. A point on the $y$-axis is $(0, y)$, and a point on the $x$-axis is $(x, 0)$.",
  },
};

export const interceptPointPrinciples: Record<string, string> = {
  "intercept-point-choice":
    "A point is on the graph of an equation exactly when its numbers make the equation true. The $y$-axis is every point with $x = 0$, and the $x$-axis is every point with $y = 0$. So for $ax + by = c$, the $y$-intercept is $(0, \\tfrac{c}{b})$ when $b \\ne 0$, and the $x$-intercept is $(\\tfrac{c}{a}, 0)$ when $a \\ne 0$. For $y = mx + k$, the $y$-intercept is $(0, k)$. When $m \\ne 0$, the $x$-intercept is $(-\\tfrac{k}{m}, 0)$. A zero of the function is the $x$ value of an $x$-intercept.",
};

export const interceptPointLessons = [
  {
    senses,
    noLink,
    ...chainLesson({
      id: "intercept-point-lesson",
      title: "Intercepts as ordered pairs",
      summary:
        "A graph is drawn on two number lines, called axes: the $x$-axis goes across and the $y$-axis goes up and down. A point is written $(x, y)$: across first, then up. An intercept is a point where a line crosses an axis. On the $y$-axis every point has $x = 0$, and on the $x$-axis every point has $y = 0$. So to find an intercept, put 0 in for one letter and find the value of the other.",
      templateIds: ["intercept-point-choice"],
      objectives: [
        "Find where a line crosses the $y$-axis by putting $x = 0$, and where it crosses the $x$-axis by putting $y = 0$.",
        "Write an intercept as a point with $x$ first, and tell it apart from the zero of a function.",
      ],
      openingTitle: "Each axis crossing has a 0 in its pair",
      opening: [
        "A point is written as an ordered pair, a pair of numbers in a set order: $(x, y)$. The first number, $x$, says how far across from the starting point $(0, 0)$, called the origin. The second, $y$, says how far up. Negative numbers mean left or down.",
        "The $y$-axis is the up-and-down line where every point has $x = 0$. A line that is not vertical crosses it at one point, written $(0, b)$. That point is called the $y$-intercept.",
        "The $x$-axis is the across line where every point has $y = 0$. A line that is not horizontal crosses it at one point, $(a, 0)$, called the $x$-intercept. A function is a rule that gives one output $y$ for each input $x$. For a line that is not vertical, the number $a$ alone is called a zero of the function: the input that makes the output 0.",
      ],
      example: {
        prompt: "Which ordered pair is the $x$-intercept of $3x - 4y = 10$?",
        steps: [
          "Every point on the $x$-axis has $y = 0$, so put 0 in for $y$: $3x - 4(0) = 10$, so $3x = 10$.",
          "Divide both sides by 3 to get $x$ alone: $x = \\tfrac{10}{3}$.",
          "Write the point with $x$ first and $y = 0$ second: the $x$-intercept is $\\left(\\tfrac{10}{3}, 0\\right)$.",
        ],
        answer: "$\\left(\\tfrac{10}{3}, 0\\right)$",
      },
      methodTitle: "Set one variable to 0",
      method: [
        "$y$-intercept: put $x = 0$ into the equation and solve for $y$. In $y = mx + k$ the point is $(0, k)$, because $m \\times 0 = 0$.",
        "$x$-intercept: put $y = 0$ and solve for $x$. In $y = mx + k$ with $m \\ne 0$, $0 = mx + k$ gives $mx = -k$, so $x = -k \\div m$. So divide by $m$, the slope (the number multiplying $x$), which may be a fraction.",
        "On a graph, find where the line meets the axis and read that one number. If the question asks for a sum, add the two intercept numbers that are not 0, signs included.",
      ],
      formalTitle: "Intercepts of a line",
      formal: [
        "For $ax + by = c$ with $a \\ne 0$ and $b \\ne 0$, the $x$-intercept is $(\\tfrac{c}{a}, 0)$ and the $y$-intercept is $(0, \\tfrac{c}{b})$. For $y = mx + k$ with $m \\ne 0$, they are $(-\\tfrac{k}{m}, 0)$ and $(0, k)$.",
        "A zero of a function is an input $x$ that gives the output 0: $f(x) = 0$, read “$f$ of $x$ equals 0”. For a line, the zero is the $x$ value of the $x$-intercept.",
      ],
      pitfalls: [
        "Writing $(y, 0)$ for the $y$-intercept. The point on the $y$-axis has $x = 0$, so it is $(0, y)$.",
        "Reading $k$ in $y = mx + k$ as the $x$-intercept. It is the $y$ value where $x = 0$.",
        "Stopping at $-k$ when finding the zero of $y = mx + k$. Also divide by the slope $m$.",
        "Dropping a sign when adding intercept numbers. A negative number makes the sum smaller.",
      ],
      parentGuide:
        "Ask which letter is 0 on each axis. Then have your learner put in that 0 and solve the short equation that is left.",
    }),
  },
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
