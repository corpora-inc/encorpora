import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/** Glossary readings for every lesson and method in this file. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  rule: "rule",
  rules: "rule",
  multiple: "multiple",
  ratio: "ratio",
  factor: "factor-number",
  square: "square-shape",
} as const;
/** The table lesson also reads “rule”, “unit” and “standard form”. */
const tableSenses = {
  ...senses,
  unit: "unit",
  units: "unit",
  "standard form": "standard-form-line",
} as const;
const noLink = [
  "whole",
  "part",
  "parts",
  "change",
  "changes",
  "opposite",
  "leaves",
  "mean",
  "jump",
  "jumps",
];

export const systemLineChoiceMethods: Record<string, ProblemMethod> = {
  "system-second-equation": {
    goal: "Choose a second equation so the system has no solution, endlessly many, exactly one, or at least one.",
    senses,
    noLink,
    intuition:
      "A system is two equations about the same unknowns $x$ and $y$. Its solution is a point $(x, y)$ that makes both true. Each equation draws a straight line, so a solution is a point on both lines. Two lines can cross once, lie on top of each other, or run in the same direction and never meet. In $2x - 3y = 6$, the coefficients (the numbers multiplying the letters) are 2 and $-3$. Comparing them, and then the numbers on the right, tells which of the three happens.",
    terms: [
      [
        "coefficient",
        "When one equation's $x$ and $y$ coefficients are the same multiple of the other's, the lines have the same slope.",
      ],
      "solution-of-a-system",
    ],
    method: [
      "Write each equation as $ax + by = c$, with the letters on the left. Compare the $x$ coefficients and the $y$ coefficients of the two equations.",
      "If one pair of coefficients is not the other pair times one number (2 and $-3$ against 3 and 2), the lines tilt differently. They cross once: exactly one solution.",
      "If they are the same multiple (2 and $-3$ doubled is 4 and $-6$), check the number on the right. Same multiple again: the same line, endlessly many solutions. A different number: parallel lines, no solution.",
    ],
    watch:
      "Multiply the number on the right too. Doubling only the left side of $2x - 3y = 6$ gives $4x - 6y = 6$, a parallel line, not the same line.",
  },
  "parallel-line-intercept": {
    goal: "Write the line that is parallel to a given line and passes through a given point on an axis.",
    senses,
    noLink,
    intuition:
      "Parallel lines run in the same direction and never meet. The slope of a line measures its steepness: how much $y$ changes when $x$ goes up by 1. Parallel lines have the same slope. In $y = mx + b$, $m$ is the slope and $b$ is where the line crosses the $y$-axis. An intercept is a point where a line crosses an axis. The given point fixes $b$, so it fixes how high the new line sits.",
    terms: [
      [
        "parallel",
        "On a graph, non-vertical parallel lines have equal slopes.",
      ],
      "slope-intercept-form",
    ],
    method: [
      "Find the slope of the given line. In $y = mx + k$ it is $m$. In $ax + by = c$ with $b \\ne 0$, solve for $y$; the slope is $-\\tfrac{a}{b}$.",
      "Keep that slope. If the new line crosses the $y$-axis at $(0, b)$, that $b$ is the number to add. If it passes through $(h, 0)$, put $x = h$ and $y = 0$ into $y = mx + b$ and solve for $b$.",
      "Write $y = mx + b$ with your two numbers and find it among the choices.",
    ],
    watch:
      "Keep the slope exactly, sign included. Turning a slope that is not 0 upside down and changing its sign gives a perpendicular line (one that meets at a square corner), not a parallel one.",
  },
  "table-standard-form": {
    goal: "Write a line from a table with uneven or fraction inputs in standard form, or shift its rule up or down.",
    senses: tableSenses,
    noLink,
    intuition:
      "A table lists inputs $x$ and the outputs $y$ that go with them. For a line, the change in $y$ divided by the change in $x$ between two columns is called the slope. That is true however far apart the inputs are. If the inputs jump unevenly, read the real change in $x$. Standard form writes a line as $Ax + By = C$, with integers (whole numbers or their negatives) and both letters on the left.",
    terms: [
      "standard-form-line",
      [
        "translation",
        "Adding $s$ to every output moves the graph up by $s$: $g(x) = f(x) + s$.",
      ],
    ],
    method: [
      "Pick two columns. The slope is the change in $y$ divided by the change in $x$ between them, using the actual $x$ values.",
      "Put one column into $y = mx + b$ to find $b$, the number added. For standard form, move the $x$ term to the left side and multiply every term to clear fractions.",
      "For a rule shifted up by $s$, add $s$ to $b$ and keep the slope.",
    ],
    watch:
      "Divide the change in $y$ by the change in $x$, not by the number of columns. With uneven steps, they can differ.",
  },
};

export const systemLineChoicePrinciples: Record<string, string> = {
  "system-second-equation":
    "Take the system $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$; the small 1 and 2 mark which equation a number comes from. If $a_1b_2 \\ne a_2b_1$, the lines are not parallel, so they cross once and there is exactly one solution. If $a_1b_2 = a_2b_1$, the lines are parallel or the same (each equation has a letter whose coefficient is not 0, so each is a line). They are the same line when $(a_2, b_2, c_2)$ is a multiple of $(a_1, b_1, c_1)$, giving endlessly many solutions. Otherwise they are different lines, giving none.",
  "parallel-line-intercept":
    "Two lines that are not vertical (straight up and down) are parallel exactly when they have the same slope and are different lines. The line with slope $m$ through $(x_0, y_0)$ is $y = m(x - x_0) + y_0$. Through $(0, b)$ it is $y = mx + b$. Through $(h, 0)$ it is $y = m(x - h)$, whose constant, the number added, is $-mh$.",
  "table-standard-form":
    "If a line passes through $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$, its slope is $\\dfrac{y_2 - y_1}{x_2 - x_1}$. Any two of its points give the same slope, however the inputs are spaced. Clearing fractions in $y = mx + b$ gives $Ax + By = C$ with integers. The function $g(x) = f(x) + s$ has the same slope as $f$, and its constant, the number added, is $b + s$.",
};

export const systemLineChoiceLessons = [
  {
    senses,
    noLink,
    ...chainLesson({
      id: "system-second-equation-lesson",
      title: "Choosing a second equation for a system",
      summary:
        "A system is two equations about the same unknowns $x$ and $y$. Each equation draws a straight line, and a solution is a point on both lines. Two lines can cross once, be the same line, or never meet. The numbers multiplying $x$ and $y$, called coefficients, tell you which. Then the number on the right decides between the same line and lines that never meet.",
      templateIds: ["system-second-equation"],
      objectives: [
        "Compare the numbers multiplying $x$ and $y$ in two equations to tell whether the lines tilt the same way.",
        "Use the numbers on the right to tell the same line from two lines that never meet.",
      ],
      openingTitle: "Two lines can meet once, everywhere or nowhere",
      opening: [
        "A system of equations is two equations about the same unknown numbers $x$ and $y$. A solution of the system is a point $(x, y)$ that makes both equations true. On a graph, that is a point on both lines.",
        "If the lines cross, they share exactly one point. If one line lies on top of the other, they share every point. If they run in the same direction without touching, they are called parallel, and they share no point.",
        "In $2x - 3y = 6$, the coefficient of $x$ (the number multiplying $x$) is 2, and the coefficient of $y$ is $-3$. The slope of a line is how steep it is. If the coefficients of one equation are the same multiple of the other's, the lines tilt the same way. Lines that tilt differently always cross once. Lines that tilt the same way are either the same line or parallel, and the numbers on the right decide which.",
      ],
      example: {
        prompt:
          "The equation $2x - 3y = 6$ is one equation of a system. Which second equation gives no solution: $4x - 6y = 12$, $4x - 6y = 9$ or $3x + 2y = 6$?",
        steps: [
          "Compare each choice's coefficients with 2 and $-3$, because matching multiples mean matching slopes. In $4x - 6y$, both are doubled. In $3x + 2y$, they are not the same multiple.",
          "So $3x + 2y = 6$ has a different slope. It crosses the first line once, giving one solution, not none.",
          "$4x - 6y = 12$ doubles the right side too, since $6 \\times 2 = 12$. Every number is doubled, so it is the same line: endlessly many solutions.",
          "$4x - 6y = 9$ doubles the coefficients, but $6 \\times 2 \\ne 9$. Same slope, different line, so the lines are parallel and never meet: no solution.",
        ],
        answer: "$4x - 6y = 9$",
      },
      methodTitle: "Compare ratios, then constants",
      method: [
        "Write both equations as $ax + by = c$, letters on the left. For coefficients $a_1, b_1$ and $a_2, b_2$ (the small 1 and 2 mark the equation), check whether $a_1b_2 \\ne a_2b_1$. If so, the coefficients are not the same multiple, so there is exactly one solution.",
        "If the coefficients are the same multiple, multiply the first right-side number by that multiple. A match means endlessly many solutions; a mismatch means none.",
        "“At least one solution” means anything except two different parallel lines: one solution or endlessly many.",
      ],
      formalTitle: "Counting the solutions",
      formal: [
        "Take $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$, where each equation has a letter whose coefficient is not 0. There is exactly one solution if $a_1b_2 - a_2b_1 \\ne 0$. Otherwise there are endlessly many solutions if the right-side numbers are the same multiple as the coefficients, and none if not.",
      ],
      pitfalls: [
        "Multiplying only the left side of an equation. Doubling only the left of $2x - 3y = 6$ gives $4x - 6y = 6$, a parallel line. Multiply the number on the right too.",
        "Thinking matching coefficients always mean no solution. The same line also has matching slope, and it has endlessly many solutions.",
        "Comparing coefficients before both equations have $x$ and $y$ on the left. Rearrange first.",
      ],
      parentGuide:
        "Ask whether the two lines tilt the same way. If not, they cross once. If they do, ask whether they are the same line.",
    }),
  },
  {
    senses,
    noLink,
    ...chainLesson({
      id: "parallel-line-intercept-lesson",
      title: "A parallel line through an intercept",
      summary:
        "Parallel lines run in the same direction and never meet. The slope of a line is how much it rises for each step of 1 to the right, so parallel lines that are not vertical have the same slope. For example, $y = 2x + 3$ has slope 2. The 3 is the height where the line crosses the $y$-axis, the up-and-down number line. To write a parallel line, keep the slope and use a point on the new line to find its new height.",
      templateIds: ["parallel-line-intercept"],
      objectives: [
        "Find the slope of a line written as $ax + by = c$ or as $y = mx + b$.",
        "Use the point where a line crosses the $y$-axis or the $x$-axis to finish a parallel line's equation.",
      ],
      openingTitle: "Same slope, different position",
      opening: [
        "The slope of a line says how steep it is: how much $y$ changes each time $x$ goes up by 1. In $y = mx + b$, the number $m$ is the slope. The number $b$ is the $y$-intercept, the height where the line crosses the $y$-axis. This way of writing a line is called slope-intercept form.",
        "Parallel lines that are not vertical rise or fall at the same rate, so they have equal slopes. So the new line takes the given line's slope.",
        "What changes is where the new line sits. An intercept is a point where a line crosses an axis. A point on the new line, such as an intercept, fixes $b$.",
      ],
      example: {
        prompt:
          "Line $s$ is $3x + 2y = 8$. Line $t$ is parallel to $s$ and passes through $(4, 0)$. Write $t$ as $y = mx + b$.",
        steps: [
          "Get $y$ alone in $3x + 2y = 8$ to read the slope. Subtract $3x$ from both sides: $2y = -3x + 8$. Divide both sides by 2: $y = -\\tfrac{3}{2}x + 4$. The slope is $-\\tfrac{3}{2}$.",
          "Parallel lines have equal slopes, so $t$ is $y = -\\tfrac{3}{2}x + b$ for some number $b$.",
          "The point $(4, 0)$ is on $t$, so put $x = 4$ and $y = 0$ in: $0 = -\\tfrac{3}{2}(4) + b = -6 + b$. Add 6 to both sides: $b = 6$.",
        ],
        answer: "$y = -\\tfrac{3}{2}x + 6$",
      },
      methodTitle: "Slope first, then the point",
      method: [
        "In $ax + by = c$ with $b \\ne 0$, the slope is $-\\tfrac{a}{b}$. In $y = mx + k$, it is $m$. Keep it exactly, signs and fractions included.",
        "A $y$-intercept $(0, b)$ gives $b$ directly. A point $(h, 0)$ gives $0 = mh + b$, so $b = -mh$.",
        "If the point is where another line crosses the $y$-axis, put $x = 0$ into that line's equation to find it.",
      ],
      formalTitle: "Parallel lines and point-slope form",
      formal: [
        "Lines that are not vertical are parallel exactly when their slopes are equal and their $y$-intercepts differ. The line with slope $m$ through $(x_0, y_0)$ is $y - y_0 = m(x - x_0)$.",
      ],
      pitfalls: [
        "Turning the slope fraction upside down and changing its sign. For a slope that is not 0, that gives a perpendicular line, one that meets the first at a square corner.",
        "Using the given line's own $y$-intercept. The new line passes through a different point.",
        "Using $h$ from $(h, 0)$ as $b$. Put both numbers of the point into the equation.",
      ],
      parentGuide:
        "Ask your learner what stays the same and what changes between parallel lines, then which number the given point decides.",
    }),
  },
  {
    senses: tableSenses,
    noLink,
    ...chainLesson({
      id: "table-standard-form-lesson",
      title: "A line from a table with uneven steps",
      summary:
        "A table lists inputs $x$ (numbers you put in) and the outputs $y$ that go with them. For a line, the slope (steepness) is the change in $y$ divided by the change in $x$. When the inputs jump by different amounts, read both changes. Then write the line in standard form: both letters on the left and no fractions, such as $3x - y = -2$. To move the line up 3, add 3 to every output.",
      templateIds: ["table-standard-form"],
      objectives: [
        "Find a slope from two columns of a table whose inputs are unevenly spaced or fractions.",
        "Write a line in standard form, and shift its rule up or down.",
      ],
      openingTitle: "Slope is a ratio of two changes",
      opening: [
        "The slope of a line measures how much $y$ changes each time $x$ goes up by 1. When a table lists $x = 1, 2, 3$, every step is 1, so the slope shows at a glance. When the inputs jump by different amounts, the slope is still the change in $y$ divided by the change in $x$. Now you must read both changes.",
        "A line can be written $y = mx + b$, where $m$ is the slope and $b$ is the number added. Once the slope is known, one column gives $b$.",
        "Standard form writes the same line as $Ax + By = C$. Both letters sit on the left, and $A$, $B$ and $C$ are integers: whole numbers or their negatives. A rule like $g(x) = f(x) + 3$, read “$g$ of $x$ equals $f$ of $x$ plus 3”, adds 3 to every output of $f$. That moves the line up 3.",
      ],
      example: {
        prompt:
          "A table has columns $(1, 5)$, $(3, 11)$, $(4, 14)$ and $(8, 26)$. Write the line in standard form.",
        steps: [
          "Use the first two columns to find the slope. $x$ changes by $3 - 1 = 2$ and $y$ changes by $11 - 5 = 6$. So the slope is $6 \\div 2 = 3$.",
          "Find $b$ by putting $(1, 5)$ into $y = 3x + b$: $5 = 3 + b$, so $b = 2$. The line is $y = 3x + 2$.",
          "Subtract $3x$ from both sides and then multiply both sides by $-1$, so both letters are on the left: $3x - y = -2$. Check $(8, 26)$: $3(8) - 26 = -2$.",
        ],
        answer: "$3x - y = -2$",
      },
      methodTitle: "Read the gap, then the constant",
      method: [
        "Slope: the change in $y$ divided by the change in $x$, between two columns. Do not divide by the number of columns.",
        "The number $b$: put one column into $y = mx + b$. Standard form: move the $x$ term to the left, multiply to clear fractions, and make the number multiplying $x$ positive if it is not 0.",
        "A rule shifted up by $s$, $g(x) = f(x) + s$: keep the slope and add $s$ to $b$.",
      ],
      formalTitle: "Two points determine a line",
      formal: [
        "A line through $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$ has slope $\\frac{y_2 - y_1}{x_2 - x_1}$. Any two different points of the line give the same slope. Standard form is $Ax + By = C$, where $A$, $B$ and $C$ are integers and no whole number greater than 1 divides all three evenly.",
      ],
      pitfalls: [
        "Dividing the change in $y$ by 1 because the columns sit next to each other. Divide by the change in $x$.",
        "Subtracting a shift that should be added, or putting it inside the curved brackets of $f$.",
        "Leaving fractions in standard form. Multiply every term by the common denominator.",
      ],
      parentGuide:
        "Have your learner write the change in $x$ and the change in $y$ for two columns before they divide.",
    }),
  },
];

export const systemLineChoiceFacetMappings: FacetMapping[] = [
  {
    templateId: "system-second-equation",
    facetId: "linear-systems.core",
    extent: "partial",
    rationale:
      "Choose the second equation that gives a system with a stated equation no solution, infinitely many solutions, exactly one solution or at least one solution, from proportional coefficients and constants. Does not assess solving for the solution, graphing the lines or writing equations in context.",
  },
  {
    templateId: "parallel-line-intercept",
    facetId: "slope-proofs.core",
    extent: "partial",
    rationale:
      "Choose the slope-intercept equation of a line parallel to a given line, in standard or slope-intercept form, through a stated x- or y-intercept or through the y-intercept of another line. Does not assess proving the parallel criterion, perpendicular lines or constructions.",
  },
  {
    templateId: "table-standard-form",
    facetId: "linear-equation-modeling.core",
    extent: "partial",
    rationale:
      "Choose the standard-form equation of a line from a table with unevenly spaced or fractional inputs, or the rule of that function shifted vertically. Does not assess tables with symbolic inputs, writing the equation without choices or interpreting the table in a context.",
  },
];
