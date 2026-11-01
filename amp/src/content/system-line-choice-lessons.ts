import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const systemLineChoiceMethods: Record<string, ProblemMethod> = {
  "system-second-equation": {
    goal: "Choose a second linear equation so that a system with a given equation has no, infinitely many, exactly one or at least one solution.",
    intuition:
      "Each equation is a line, and a solution is a point on both lines. Two lines can cross once, lie on top of each other, or run side by side without meeting. Comparing the coefficients tells which of the three happens.",
    terms: [
      [
        "coefficient",
        "When one equation's $x$ and $y$ coefficients are the same multiple of the other's, the lines have the same slope.",
      ],
      "solution-of-a-system",
    ],
    method: [
      "Write the given equation as $ax + by = c$. Compare its $x$-coefficient and $y$-coefficient with each choice's.",
      "If they are not in the same ratio, the slopes differ and there is exactly one solution.",
      "If they are in the same ratio, test the constants: the same ratio again means the same line (infinitely many solutions), a different ratio means parallel lines (no solution).",
    ],
    watch:
      "Multiplying only the left side by a number and leaving the constant alone gives a parallel line, not the same line.",
  },
  "parallel-line-intercept": {
    goal: "Write the equation of the line parallel to a given line that passes through a stated intercept.",
    intuition:
      "Parallel lines slant the same way, so they have the same slope. The point the new line must pass through then fixes how far up or down it sits.",
    terms: [
      [
        "parallel",
        "On a graph, non-vertical parallel lines have equal slopes.",
      ],
      "slope-intercept-form",
    ],
    method: [
      "Find the slope of the given line. In $ax + by = c$ it is $-a/b$; in $y = mx + k$ it is $m$.",
      "Keep that slope. If the new line has $y$-intercept $(0, b)$, that $b$ is the constant. If it passes through $(h, 0)$, substitute $x = h$ and $y = 0$ into $y = mx + b$ and solve for $b$.",
      "Write $y = mx + b$ and compare it with the choices.",
    ],
    watch:
      "A perpendicular line has the negative reciprocal slope. A parallel line keeps the slope and its sign.",
  },
  "table-standard-form": {
    goal: "Write a line from a table with uneven or fractional inputs in standard form, or shift its rule up or down.",
    intuition:
      "The rate of change is the change in $y$ divided by the change in $x$ between two columns, whatever the gap between the columns is. A table with uneven steps does not change this, it only means you must read the gap.",
    terms: [
      "standard-form-line",
      [
        "translation",
        "Adding $s$ to every output moves the graph up by $s$: $g(x) = f(x) + s$.",
      ],
    ],
    method: [
      "Pick two columns. The slope is the change in $y$ divided by the change in $x$ between them, using the actual $x$ values.",
      "Use one column in $y = mx + b$ to find $b$. For standard form, move the $x$-term to the left and multiply to clear fractions.",
      "For a shifted rule, add the shift to $b$ and leave the slope alone.",
    ],
    watch:
      "Dividing the change in $y$ by the number of columns instead of the change in $x$ gives the wrong slope when the steps are uneven.",
  },
};

export const systemLineChoicePrinciples: Record<string, string> = {
  "system-second-equation":
    "For the system $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$, if $a_1b_2 \\ne a_2b_1$ the lines have different slopes and the system has exactly one solution. If $a_1b_2 = a_2b_1$ the lines are parallel or equal: they are equal when $(a_2, b_2, c_2)$ is a multiple of $(a_1, b_1, c_1)$, giving infinitely many solutions, and distinct otherwise, giving none.",
  "parallel-line-intercept":
    "Two non-vertical lines are parallel exactly when they have the same slope and are distinct. The line with slope $m$ through $(x_0, y_0)$ is $y = m(x - x_0) + y_0$, so through $(0, b)$ it is $y = mx + b$ and through $(h, 0)$ it is $y = m(x - h)$, whose constant is $-mh$.",
  "table-standard-form":
    "If a line passes through $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$, its slope is $\\dfrac{y_2 - y_1}{x_2 - x_1}$ for any two of its points, whatever the spacing of the inputs. Clearing denominators in $y = mx + b$ gives $Ax + By = C$ with whole numbers. The function $g(x) = f(x) + s$ has the same slope as $f$ and constant term $b + s$.",
};

export const systemLineChoiceLessons = [
  chainLesson({
    id: "system-second-equation-lesson",
    title: "Choosing a second equation for a system",
    summary:
      "Decide from the coefficients whether two lines cross once, coincide or never meet.",
    templateIds: ["system-second-equation"],
    objectives: [
      "Compare the $x$- and $y$-coefficients of two equations to tell whether their slopes match.",
      "Use the constants to separate the same line from parallel lines.",
    ],
    openingTitle: "Two lines can meet once, everywhere or nowhere",
    opening: [
      "A solution of a system is a point on both lines. If the lines cross, they share exactly one point. If one line lies on top of the other, they share every point. If they run side by side, they share none.",
      "Lines with different slopes always cross. Lines with the same slope either coincide or never meet, and the constants decide which.",
    ],
    example: {
      prompt:
        "The equation $2x - 3y = 6$ is one equation of a system. Which second equation gives no solution: $4x - 6y = 12$, $4x - 6y = 9$ or $3x + 2y = 6$?",
      steps: [
        "Compare coefficients with $2x - 3y = 6$. In $4x - 6y$ both coefficients are doubled; in $3x + 2y$ they are not in proportion.",
        "$3x + 2y = 6$ has a different slope, so it crosses the first line once.",
        "$4x - 6y = 12$ doubles the constant too ($6 \\times 2 = 12$), so it is the same line: infinitely many solutions.",
        "$4x - 6y = 9$ doubles the coefficients but $6 \\times 2 \\ne 9$. The lines are parallel and distinct: no solution.",
      ],
      answer: "$4x - 6y = 9$",
    },
    methodTitle: "Compare ratios, then constants",
    method: [
      "Write both equations as $ax + by = c$. If $a_1b_2 \\ne a_2b_1$, there is exactly one solution.",
      "If the coefficients are in proportion, multiply the first constant by the same factor. A match means infinitely many solutions; a mismatch means none.",
      '"At least one solution" means anything except parallel distinct lines.',
    ],
    formalTitle: "Counting the solutions",
    formal: [
      "For $a_1x + b_1y = c_1$ and $a_2x + b_2y = c_2$: exactly one solution if $a_1b_2 - a_2b_1 \\ne 0$; otherwise infinitely many if the constants are in the same ratio as the coefficients, and none if not.",
    ],
    pitfalls: [
      "Multiplying only the left side of an equation. A new constant is needed too, or the line changes.",
      "Treating equal coefficients as always giving no solution. The same line also has equal slope.",
      "Reading the slope off an equation that is not yet in standard form. Write $x$ and $y$ on the left first.",
    ],
    parentGuide:
      "Ask whether the two lines tilt the same way. If not, they cross once. If they do, ask whether they are the same line.",
  }),
  chainLesson({
    id: "parallel-line-intercept-lesson",
    title: "A parallel line through an intercept",
    summary:
      "Keep the slope of a given line and use a stated intercept to find the constant.",
    templateIds: ["parallel-line-intercept"],
    objectives: [
      "Find the slope of a line given in standard or slope-intercept form.",
      "Use a $y$-intercept or an $x$-intercept to find the constant of a parallel line.",
    ],
    openingTitle: "Same slope, different position",
    opening: [
      "Parallel lines rise or fall at the same rate, so they have equal slopes. The slope is already known from the given line.",
      "What differs is where the new line sits. A point on it, such as an intercept, fixes the constant $b$ in $y = mx + b$.",
    ],
    example: {
      prompt:
        "Line $s$ is $3x + 2y = 8$. Line $t$ is parallel to $s$ and passes through $(4, 0)$. Write $t$ as $y = mx + b$.",
      steps: [
        "Solve $3x + 2y = 8$ for $y$: $2y = -3x + 8$, so $y = -\\tfrac{3}{2}x + 4$. The slope is $-\\tfrac{3}{2}$.",
        "Parallel lines have equal slopes, so $t$ is $y = -\\tfrac{3}{2}x + b$.",
        "Substitute $(4, 0)$: $0 = -\\tfrac{3}{2}(4) + b = -6 + b$, so $b = 6$.",
      ],
      answer: "$y = -\\tfrac{3}{2}x + 6$",
    },
    methodTitle: "Slope first, then the point",
    method: [
      "In $ax + by = c$ the slope is $-a/b$. In $y = mx + k$ it is $m$. Keep it exactly, signs and fractions included.",
      "A $y$-intercept $(0, b)$ gives $b$ directly. A point $(h, 0)$ gives $0 = mh + b$, so $b = -mh$.",
      "If the point is the $y$-intercept of another line, set $x = 0$ in that line's equation to find it.",
    ],
    formalTitle: "Parallel lines and point-slope form",
    formal: [
      "Non-vertical lines are parallel exactly when their slopes are equal and their $y$-intercepts differ. The line with slope $m$ through $(x_0, y_0)$ is $y - y_0 = m(x - x_0)$.",
    ],
    pitfalls: [
      "Using the negative reciprocal slope. That is the slope of a perpendicular line.",
      "Using the given line's own $y$-intercept. The new line passes through a different point.",
      "Using the $x$-coordinate of $(h, 0)$ as the constant $b$. Substitute both coordinates.",
    ],
    parentGuide:
      "Ask your learner what stays the same and what changes between parallel lines, then which number the stated point decides.",
  }),
  chainLesson({
    id: "table-standard-form-lesson",
    title: "A line from a table with uneven steps",
    summary:
      "Find the slope from the real changes in a table, then write the line in standard form or shift it.",
    templateIds: ["table-standard-form"],
    objectives: [
      "Find a slope from two table columns whose inputs are unevenly spaced or fractions.",
      "Write a line in standard form and apply a vertical shift to its rule.",
    ],
    openingTitle: "Slope is a ratio of two changes",
    opening: [
      "When a table lists $x = 1, 2, 3$, the steps are all 1 and the outputs show the slope at a glance. When the inputs jump by different amounts, the same slope is still the change in $y$ divided by the change in $x$, but now you must read both changes.",
      "Once the slope is known, one column gives the constant. Standard form moves the $x$-term to the left so that the coefficients are whole numbers.",
    ],
    example: {
      prompt:
        "A table has columns $(1, 5)$, $(3, 11)$, $(4, 14)$ and $(8, 26)$. Write the line in standard form.",
      steps: [
        "Use the first two columns: $x$ changes by $3 - 1 = 2$ and $y$ changes by $11 - 5 = 6$, so the slope is $6 \\div 2 = 3$.",
        "Substitute $(1, 5)$ in $y = 3x + b$: $5 = 3 + b$, so $b = 2$ and $y = 3x + 2$.",
        "Move $3x$ to the left: $3x - y = -2$. Check $(8, 26)$: $3(8) - 26 = -2$.",
      ],
      answer: "$3x - y = -2$",
    },
    methodTitle: "Read the gap, then the constant",
    method: [
      "Slope: (change in $y$) $\\div$ (change in $x$) between two columns. Do not divide by the number of columns.",
      "Constant: put one column into $y = mx + b$. Standard form: multiply to clear fractions and make the $x$-coefficient positive.",
      "Shifted rule $g(x) = f(x) + s$: keep the slope and add $s$ to $b$.",
    ],
    formalTitle: "Two points determine a line",
    formal: [
      "A line through $(x_1, y_1)$ and $(x_2, y_2)$ with $x_1 \\ne x_2$ has slope $\\frac{y_2 - y_1}{x_2 - x_1}$, which is the same for every pair of its points. Standard form is $Ax + By = C$ with integer coefficients that share no common factor.",
    ],
    pitfalls: [
      "Dividing the change in $y$ by 1 because the columns are neighbors. Divide by the change in $x$.",
      "Subtracting a shift that should be added, or putting it inside the argument of $f$.",
      "Leaving fractions in standard form. Multiply every term by the common denominator.",
    ],
    parentGuide:
      "Have your learner write the change in $x$ and the change in $y$ for two columns before they divide.",
  }),
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
