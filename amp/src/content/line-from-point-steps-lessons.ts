import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "line-from-point-steps",
    title: "Write a line from its slope and a point",
    summary:
      "Put a point on the line into $y=mx+b$ to find $b$, then write the equation with the slope and $b$.",
    objectives: [
      "Find the slope of a line from two points and the $y$-intercept from the slope and one point.",
      "Write the equation of the line in slope-intercept form, $y=mx+b$.",
    ],
    intuition:
      "A line with slope $\\frac{2}{3}$ goes up 2 for every 3 across. That fixes its steepness but not its place: many parallel lines have that slope. One point on the line pins it down. The point's $x$ and $y$ must make $y=\\frac{2}{3}x+b$ true, and only one value of $b$ does.",
    terms: [
      [
        "slope",
        "The rise over the run between two points: $m=\\frac{y_2-y_1}{x_2-x_1}$.",
      ],
      [
        "$y$-intercept",
        "The value $b$ of $y$ where the line crosses the $y$-axis, at $x=0$.",
      ],
      [
        "slope-intercept form",
        "The equation $y=mx+b$, with $y$ alone on one side.",
      ],
    ],
    method: [
      "If two points are given, find the slope $m=\\frac{y_2-y_1}{x_2-x_1}$ and reduce it.",
      "Write $y=mx+b$ and substitute $m$ and the $x$ and $y$ of one point.",
      "Multiply the slope by the point's $x$, then solve for $b$.",
      "Write $y=mx+b$ with the numbers for $m$ and $b$, and check the other point if there is one.",
    ],
    watch:
      "Subtract the same way in the numerator and the denominator: start from the same point in both. Put $x$ and $y$ in the right places; swapping them finds a different line.",
    principle:
      "A line with slope $m$ through $(x_1,y_1)$ has $y=mx+b$ with $b=y_1-mx_1$. Exactly one line has a given slope and passes through a given point.",
    example: {
      prompt:
        "A line has slope $-\\frac{3}{4}$ and passes through $(8,2)$. Write its equation in slope-intercept form.",
      steps: [
        "Slope times $x$: $-\\frac{3}{4}\\cdot8=-6$.",
        "Substitute into $y=mx+b$: $2=-6+b$, so $b=8$.",
        "The equation is $y=-\\frac{3}{4}x+8$.",
      ],
      answer: "$y=-\\frac{3}{4}x+8$",
    },
    methodTitle: "Check the point",
    methodText: [
      "Put the point's $x$ into your equation. The $y$ that comes out must be the point's $y$: $-\\frac{3}{4}\\cdot8+8=2$.",
      "When the slope is a fraction, a point whose $x$ is a multiple of the denominator keeps every step a whole number.",
    ],
    formal:
      "The line through $(x_1,y_1)$ with slope $m$ is the set of points with $\\frac{y-y_1}{x-x_1}=m$. Solving for $y$ gives $y=mx+(y_1-mx_1)$, so $b=y_1-mx_1$.",
    pitfalls: [
      "Subtract the slope term from $y$ to find $b$; adding it finds the wrong intercept.",
      "Use the point's $y$ for $y$ and its $x$ for $x$.",
    ],
    parentGuide:
      "Ask your learner to put the point back into the finished equation to see that it is on the line.",
  },
];

export const lineFromPointContent = workContent(entries);

export const lineFromPointFacetMappings: FacetMapping[] = [
  {
    templateId: "line-from-point-steps",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Written work: from a fractional slope and a point, or from two points, the slope, the product of the slope and x, the y-intercept and the typed equation y = mx + b (graded as the same relation, so y stands alone). Integer coordinates with whole-number intercepts. Does not assess point-slope form, standard form, vertical lines or lines from a graph or table.",
  },
];
