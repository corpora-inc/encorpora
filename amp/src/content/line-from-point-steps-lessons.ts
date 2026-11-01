import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

const entries: WorkEntry[] = [
  {
    id: "line-from-point-steps",
    title: "Write a line from its slope and a point",
    summary:
      "Write the equation $y = mx + b$ of a line from its slope $m$ and one point on it, by finding $b$, where the line crosses the $y$-axis.",
    objectives: [
      "Find the slope of a line from two points, and find $b$ from the slope and one point.",
      "Write the line as $y = mx + b$, called slope-intercept form.",
    ],
    intuition:
      "The slope of a line says how steep it is: how much $y$ changes for each step of 1 in $x$. A slope of $\\frac{2}{3}$ means the line goes up 2 for every 3 across. A line that is not vertical can be written $y = mx + b$. Here $m$ is the slope, $mx$ means $m$ times $x$, and $b$ is the $y$-intercept, the $y$ value where the line crosses the $y$-axis. The slope fixes the steepness but not the place: many lines share that slope. Lines like these, which never meet, are called parallel. One point on the line pins it down. The point's $x$ and $y$ must make $y = \\frac{2}{3}x + b$ true, and only one value of $b$ does that.",
    terms: ["slope", "y-intercept", "slope-intercept-form"],
    method: [
      "If two points with different $x$ values are given, find the slope: $m = \\frac{y_2 - y_1}{x_2 - x_1}$, the change in $y$ over the change in $x$. The small 1 and 2 mark which point a number comes from. Simplify the fraction.",
      "Write $y = mx + b$. Put in the number for $m$, and the $x$ and $y$ of one point.",
      "Multiply the slope by the point's $x$. Then subtract that from the point's $y$ to find $b$.",
      "Write $y = mx + b$ with your numbers for $m$ and $b$. If there is a second point, check it.",
    ],
    watch:
      "Start from the same point on the top and the bottom of the slope fraction. Put the point's $x$ in for $x$ and its $y$ in for $y$; swapping them usually finds a different line.",
    principle:
      "A line with slope $m$ through the point $(x_1, y_1)$ is $y = mx + b$ with $b = y_1 - mx_1$. Exactly one line has a given slope and passes through a given point.",
    example: {
      prompt:
        "A line has slope $-\\frac{3}{4}$ and passes through $(8,2)$. Write its equation in slope-intercept form.",
      steps: [
        "The point $(8, 2)$ has $x = 8$ and $y = 2$. Multiply the slope by its $x$, since $mx$ is part of the equation: $-\\frac{3}{4} \\cdot 8 = -6$.",
        "Put $y = 2$ and $mx = -6$ into $y = mx + b$: $2 = -6 + b$. Add 6 to both sides to get $b$ alone: $b = 8$.",
        "Put $m$ and $b$ back into $y = mx + b$. The equation is $y = -\\frac{3}{4}x + 8$.",
      ],
      answer: "$y=-\\frac{3}{4}x+8$",
    },
    methodTitle: "Check the point",
    methodText: [
      "Put the point's $x$ into your equation. The $y$ that comes out must be the point's $y$: $-\\frac{3}{4} \\cdot 8 + 8 = 2$. So the point is on the line.",
      "When the slope is a fraction, a point whose $x$ is a multiple of the bottom number makes the slope times $x$ come out whole. Here 8 is a multiple of 4.",
    ],
    formal:
      "The line through $(x_1, y_1)$ with slope $m$ is every point $(x, y)$ with $\\frac{y - y_1}{x - x_1} = m$, together with $(x_1, y_1)$ itself. Solving for $y$ gives $y = mx + (y_1 - mx_1)$, so $b = y_1 - mx_1$.",
    pitfalls: [
      "To find $b$, subtract the slope times $x$ from $y$. Adding it instead gives the wrong $b$ whenever the slope times $x$ is not 0.",
      "Use the point's $y$ for $y$ and its $x$ for $x$.",
    ],
    parentGuide:
      "Ask your learner to put the point back into the finished equation, to see that it is on the line.",
  },
];

const work = workContent(entries);
/** The lesson and method read “parallel” and “part” in their plain senses. */
const glossary = {
  noLink: [
    "part",
    "whole",
    "change",
    "changes",
    "multiple",
    "place",
    "side",
    "sides",
    "left side",
    "right side",
    "term",
    "terms",
    "rule",
    "rules",
  ],
};
export const lineFromPointContent = {
  ...work,
  methods: Object.fromEntries(
    Object.entries(work.methods).map(([id, m]) => [id, { ...m, ...glossary }]),
  ),
  // The reference lesson opens with a fuller summary than the short practice goal.
  lessons: work.lessons.map((l) => ({
    ...l,
    ...glossary,
    summary:
      "The slope of a line says how steep it is: how much $y$ goes up for each step of 1 to the right. A negative slope means it goes down. A line that is not vertical can be written $y = mx + b$, where $m$ is the slope. The number $b$ is the height where the line crosses the $y$-axis. If you know the slope and one point on the line, put them in and solve for $b$. Then write the equation.",
  })),
};

export const lineFromPointFacetMappings: FacetMapping[] = [
  {
    templateId: "line-from-point-steps",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Written work: from a fractional slope and a point, or from two points, the slope, the product of the slope and x, the y-intercept and the typed equation y = mx + b (graded as the same relation, so y stands alone). Integer coordinates with whole-number intercepts. Does not assess point-slope form, standard form, vertical lines or lines from a graph or table.",
  },
];
