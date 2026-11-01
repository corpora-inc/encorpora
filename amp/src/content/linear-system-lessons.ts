import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: MethodTerm[] = [
  "ordered-pair",
  "system-of-equations",
  "solution-of-a-system",
  "coefficient",
];

/** Glossary readings shared by both system lessons and methods. */
const senses = {
  side: "side-of-equation",
  sides: "side-of-equation",
  term: "term-expression",
  terms: "term-expression",
  unit: "unit",
  units: "unit",
  opposites: "opposite-number",
  multiple: "multiple",
  difference: "difference-subtract",
  quarter: "fourth",
  quarters: "fourth",
  eighth: "eighth",
  squared: "square-number",
  square: "square-shape",
  intersection: "intersection-graphs",
  identity: "identity-equation",
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
  "plane",
  "window",
  "more than",
  "rules",
];

/** The words both practice screens need before the generated example. */
const systemIntuition =
  "A system of equations is two equations about the same two unknown numbers, $x$ and $y$. An ordered pair $(x, y)$ lists the two numbers, $x$ first and $y$ second. The solution of the system is a pair that makes both equations true at once. The coefficient of a letter is the number multiplying it: in $2x + 3y = 7$ they are 2 and 3.";

export const linearSystemMethods: Record<string, ProblemMethod> = {
  "linear-system-pair": {
    goal: "Find the ordered pair $(x, y)$ that makes both equations true at the same time.",
    senses,
    noLink,
    intuition: `${systemIntuition} To find it, remove one letter by combining the equations. Solve for the other letter, then go back for the first.`,
    terms: [...terms, "elimination"],
    method: [
      "If one equation already gives a letter, such as $x = 2$ or $y = x + 1$, put that into the other equation in place of the letter.",
      "Otherwise, multiply each whole equation by a number (not 0) so one letter has the same or opposite coefficients. Then subtract or add the equations, side by side, to remove that letter.",
      "Solve the one-letter equation that is left. Put that value into one of the original equations to find the other letter.",
      "Write $(x, y)$ with $x$ first. Check the pair in both original equations; working in only one is not enough.",
    ],
    watch:
      "Multiply every term on both sides, including the number on the right. Write $x$ first in the pair.",
  },
  "linear-system-solution-count": {
    goal: "Decide whether two equations share one pair $(x, y)$, no pair, or endlessly many pairs.",
    senses,
    noLink,
    intuition: `${systemIntuition} Each equation draws a straight line. Two lines can cross once (one solution), never meet (no solution), or be the same line (endlessly many solutions).`,
    terms: [...terms, "contradiction", "identity-equation"],
    method: [
      "If one equation already gives $x$ or $y$, put it into the other equation. Then find the other letter, or see whether the plain numbers left are equal.",
      "Otherwise, line up the $x$ terms, $y$ terms and plain numbers. Multiply a whole equation by a number (not 0) if needed, then add or subtract to remove one letter.",
      "If a letter is left with a coefficient that is not 0, it has one value. Find the other letter from an original equation. There is exactly one shared pair.",
      "If both letters cancel and the numbers left are unequal, like $0 = 2$, no pair works. If they are equal, like $0 = 0$, both equations are the same line: endlessly many pairs on that line work, but not every pair.",
    ],
    watch:
      "One equation can be a negative multiple of the other and still be the same line. Compare the plain numbers as well as the coefficients. Never divide by 0.",
  },
};

export const linearSystemPrinciples: Record<string, string> = {
  "linear-system-pair":
    "A system's solution must make both original equations true. Substitution replaces a letter with something equal to it. Multiplying an equation by a number other than 0, and adding or subtracting the equations, keep the shared solutions, as long as one original equation is kept.",
  "linear-system-solution-count":
    "Two linear equations, each with at least one letter whose coefficient is not 0, describe two straight lines. Their shared points are one crossing point, no point, or one whole shared line.",
};

const foundations = {
  title: "Equations and ordered pairs",
  paragraphs: [
    "A variable is a letter standing for a number. An expression is a math phrase made of numbers, letters and operations. For example, $2x + 3$ means multiply $x$ by 2, then add 3. An equation says two expressions are equal: the two sides of the equals sign have the same value. A solution makes that true when numbers replace the letters.",
    "The coefficient of a letter is the number multiplying it. In $2x + 3y = 7$, the coefficients are 2 and 3. Writing $x$ alone means $1x$, and $-x$ means $-1x$. A constant, such as 7, is a plain number with no letter.",
    "An ordered pair $(x, y)$ lists two numbers: $x$ first, $y$ second. For $(2, 3)$, use $x = 2$ and $y = 3$. The order matters: $(3, 2)$ gives the letters different values.",
    "A system of equations asks for one pair that makes every equation true at once. Checking one equation is not enough. Here $x$ and $y$ are real numbers, meaning any number on the number line. They can be positive, negative, 0 or fractions, not only whole numbers.",
  ],
};

const coordinates = {
  title: "Why lines show the solutions",
  paragraphs: [
    "A coordinate plane is a flat grid made from two number lines, called axes, that cross at a square corner. The across line is the $x$-axis and the up-and-down line is the $y$-axis. They cross at the origin, $(0, 0)$. To find $(2, 3)$, start at the origin, move 2 right, then 3 up. A negative $x$ means move left; a negative $y$ means move down.",
    "A linear equation in $x$ and $y$ looks like $ax + by = c$. Here $a$, $b$ and $c$ are fixed numbers, and $a$ and $b$ are not both 0. The letters are never squared or multiplied together. Every pair that makes one such equation true lies on one straight line. Every point on that line makes the equation true.",
    "For example, $y = x + 1$ makes $y$ one more than $x$. Its points include $(0, 1)$, $(1, 2)$ and $(2, 3)$. An intersection is a point where two lines cross. That shared point is a pair that makes both equations true.",
  ],
};

const fractionCalculations = {
  title: "Calculate with fractions",
  paragraphs: [
    "In a fraction such as $\\tfrac{5}{4}$, the top number (the numerator) counts parts, and the bottom number (the denominator) says how many parts make one whole. To multiply a fraction by a whole number, multiply the top and keep the bottom: $3 \\times \\tfrac{5}{4} = \\tfrac{15}{4}$. Three groups of five quarters make fifteen quarters.",
    "Signs work as usual: $-2 \\times \\tfrac{3}{4} = -\\tfrac{6}{4} = -\\tfrac{3}{2}$. The last step divides the top and bottom by 2. Dividing top and bottom by the same number (not 0) keeps the value.",
    "To divide a fraction by a positive whole number, multiply the bottom by that number: $\\tfrac{5}{4} \\div 2 = \\tfrac{5}{8}$. Halving each quarter makes an eighth. So $-\\tfrac{5}{4} \\div 5 = -\\tfrac{5}{20} = -\\tfrac{1}{4}$. For a negative divisor, also flip the sign: $-\\tfrac{9}{2} \\div (-3) = \\tfrac{9}{6} = \\tfrac{3}{2}$. You can never divide by 0.",
    "To add or subtract fractions, first give them the same bottom number. Multiplying top and bottom by the same number (not 0) keeps the value: $\\tfrac{1}{2} = \\tfrac{3}{6}$ and $\\tfrac{1}{3} = \\tfrac{2}{6}$. So $\\tfrac{1}{2} + \\tfrac{1}{3} = \\tfrac{3}{6} + \\tfrac{2}{6} = \\tfrac{5}{6}$. Whole numbers can be rewritten too: $-2 - \\tfrac{2}{3} = -\\tfrac{6}{3} - \\tfrac{2}{3} = -\\tfrac{8}{3}$.",
  ],
};

export const linearSystemPairLesson: Lesson = {
  id: "linear-system-pair",
  title: "Solve two equations together",
  summary:
    "Two equations can be about the same two unknown numbers, $x$ and $y$. Together they are called a system. Its solution is one pair of numbers, written $(x, y)$ with $x$ first, that makes both equations true. For $y = x + 1$ and $x + y = 5$, the pair $(2, 3)$ works in both. Find one number first by removing the other letter, then find the second.",
  templateIds: ["linear-system-pair"],
  includeGeneratedRepresentation: false,
  senses,
  noLink,
  objectives: [
    "Tell the difference between a pair that works in one equation and a pair that works in both.",
    "Remove one letter by substituting or by combining equations, find both numbers, and check both original equations.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "What you will use",
      paragraphs: [
        "One equation with two letters, such as $x + y = 5$, has many pairs that work: $(1, 4)$, $(2, 3)$, $(0, 5)$ and more. A system adds a second equation. Now we want the one ordered pair $(x, y)$ that makes both equations true at once. Here $x$ is the first number and $y$ is the second. Check the same pair in both equations.",
        "You will solve equations with one letter, and work with positive and negative numbers and fractions. A fraction $\\tfrac{a}{b}$ means $a$ divided by $b$, where $b$ is not 0. Keep fractions exact while you work.",
      ],
    },
    foundations,
    fractionCalculations,
    {
      title: "One equation is only one condition",
      paragraphs: [
        "Take the system $y = x + 1$ and $x + y = 5$. The pair $(2, 3)$ makes the first equation true, because $3 = 2 + 1$. It makes the second true, because $2 + 3 = 5$. So $(2, 3)$ solves the system.",
        "The pair $(1, 2)$ makes the first equation true: $2 = 1 + 1$. But $1 + 2 = 3$, not 5, so it fails the second. A pair that works in only one equation does not solve the system.",
      ],
    },
    { ...coordinates, illustration: "linear-system-intersection" },
    {
      title: "Substitution replaces equal amounts",
      paragraphs: [
        "Substitution means putting in something equal in place of a letter. In $y = x + 1$, the expression $x + 1$ is exactly the value of $y$. So in the other equation, $x + y = 5$, replace $y$ with $x + 1$. That gives $x + (x + 1) = 5$, which is $2x + 1 = 5$.",
        "Subtract 1 from both sides: $2x = 4$. Divide both sides by 2: $x = 2$. Then go back to $y = x + 1$ and put in 2 for $x$: $y = 2 + 1 = 3$. The solution is the pair $(2, 3)$, not just the number 2.",
        "This keeps both conditions. Any shared pair has $y = x + 1$, so it also makes the new equation true. And a solution of the new equation, together with $y = x + 1$, makes both originals true. The checks above confirm the pair.",
      ],
    },
    {
      title: "Elimination removes one letter",
      paragraphs: [
        "Elimination combines the equations so one letter disappears. Multiplying every term on both sides of an equation by the same number keeps its solutions, as long as the number is not 0. You can undo it by dividing. Multiplying by 0 is different: it would wipe out the equation.",
        "If two equations are both true for a pair, adding their left sides gives the same result as adding their right sides. Subtracting works the same way. So make one letter's coefficients match, then subtract. Or make them opposites (like 6 and $-6$), then add. For example, $6x - 6x = 0$ removes $x$.",
        "Keep one original equation alongside the new one. The new equation alone has lost a condition, so it cannot find the whole pair by itself. The original equation lets you find the second number.",
      ],
    },
    {
      title: "When one coordinate is already given",
      paragraphs: [
        "An equation such as $x = 2$ already gives the first number. If the other equation is $x + y = 5$, put 2 in for $x$: $2 + y = 5$, so $y = 3$. On a graph, $x = 2$ is a vertical (straight up-and-down) line: $y$ can be anything while $x$ stays 2.",
        "In the same way, $y = 1$ is a horizontal (straight across) line. The system $x = 2$ and $y = 1$ has the solution $(2, 1)$ right away. There is nothing to divide.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "Find the ordered pair $(x, y)$ satisfying 2x + 3y = 0 and 3x + 2y = 5/2.",
    steps: [
      "Make the coefficients of $x$ match so $x$ can be removed. Multiply every term of the first equation by 3: $6x + 9y = 0$. Multiply every term of the second by 2: $6x + 4y = 5$, since $2 \\times \\tfrac{5}{2} = 5$.",
      "Subtract the second new equation from the first, side by side: $(6x + 9y) - (6x + 4y) = 0 - 5$. Subtract each term: $6x + 9y - 6x - 4y = -5$. The $x$ terms cancel, so $5y = -5$.",
      "Divide both sides by 5 to get $y$ alone: $y = -1$. That is only the second number, so keep an original equation to find $x$.",
      "Put $y = -1$ into $2x + 3y = 0$: $2x + 3(-1) = 0$, so $2x - 3 = 0$. Add 3 to both sides: $2x = 3$. Divide both sides by 2: $x = \\tfrac{3}{2}$.",
      "Write $x$ first and $y$ second: $(\\tfrac{3}{2}, -1)$. Check the first original equation: $2 \\times \\tfrac{3}{2} + 3(-1) = 3 - 3 = 0$.",
      "Check the second original equation: $3 \\times \\tfrac{3}{2} + 2(-1) = \\tfrac{9}{2} - 2 = \\tfrac{9}{2} - \\tfrac{4}{2} = \\tfrac{5}{2}$. Both are true, so this pair solves the system.",
    ],
    answer: "(3/2, −1)",
  },
  closingSections: [
    {
      stage: "formal",
      title: "The precise rule",
      paragraphs: [linearSystemPrinciples["linear-system-pair"]!],
    },
  ],
  pitfalls: [
    "Check both equations with the same pair. Do not use a different pair for each equation.",
    "Multiply a whole equation, including the number on its right side. When subtracting, subtract every term of the second equation.",
    "Write $x$ first in the pair. A pair can have a fraction in it even when every coefficient is a whole number.",
  ],
  parentGuide:
    "For $y = x + 1$ and $x + y = 5$, ask your learner to compare $(1, 2)$, $(2, 3)$ and $(3, 2)$. Have them test both equations for each pair and say which equation rules out each near miss.",
};

export const linearSystemCountLesson: Lesson = {
  id: "linear-system-solution-count",
  title: "Count the solutions of two linear equations",
  summary:
    "A system is two equations about the same two unknown numbers, $x$ and $y$. Each equation draws a straight line. The solutions are the points the two lines share. Two lines can cross once, never meet, or be the very same line. So a system has one solution, no solution, or endlessly many.",
  templateIds: ["linear-system-solution-count"],
  includeGeneratedRepresentation: false,
  senses,
  noLink,
  objectives: [
    "Connect what is left after removing a letter to lines that cross, lines that never meet, and lines that are the same.",
    "Tell endlessly many pairs on one line apart from every pair on the grid.",
  ],
  sections: [
    {
      stage: "intuition",
      title: "What you will use",
      paragraphs: [
        "Each equation in a system is true for many pairs of numbers. A solution of the system must make both equations true. Picture each equation as a straight line. Two lines can cross once, never meet, or lie exactly on top of each other. Those three pictures mean one, no, or endlessly many shared pairs.",
        "An ordered pair $(x, y)$ names $x$ first and $y$ second. You will use positive and negative numbers, fractions and one-letter equations. A fraction $\\tfrac{a}{b}$ means $a$ divided by $b$, where $b$ is not 0.",
      ],
    },
    foundations,
    fractionCalculations,
    coordinates,
    {
      title: "Combine equations without losing a condition",
      paragraphs: [
        "Elimination combines equations to remove a letter. Multiplying a whole equation by a number other than 0 keeps its solutions, because dividing undoes it. Adding or subtracting the two equations, side by side, gives another true equation.",
        "Keep one original equation alongside the new one. The new equation alone may be true for more pairs than the system is.",
        "In these systems, each equation has at least one letter whose coefficient is not 0, so each one draws a line. The next three sections show the three ways two lines can share points.",
      ],
    },
    {
      title: "Exactly one ordered pair",
      paragraphs: [
        "Take $x + y = 4$ and $x - y = 0$. Add the two equations, side by side: $(x + y) + (x - y) = 4 + 0$. The $y$ terms cancel, leaving $2x = 4$, so $x = 2$.",
        "Use $x + y = 4$ to find $y$: $2 + y = 4$, so $y = 2$. Check both: $2 + 2 = 4$ and $2 - 2 = 0$. Each number is fixed, so there is exactly one solution, $(2, 2)$. On a graph, the two lines cross at one point.",
      ],
    },
    {
      title: "No ordered pairs",
      paragraphs: [
        "Take $x + y = 2$ and $x + y = 4$. Subtract the first equation from the second: $(x + y) - (x + y) = 4 - 2$. That leaves $0 = 2$.",
        "A statement that can never be true, like $0 = 2$, is called a contradiction. No choice of $x$ and $y$ makes 0 equal 2, so no pair makes both equations true. The two lines are parallel: they run in the same direction and never meet. A drawing shows only part of the grid; the algebra proves they never meet anywhere.",
      ],
    },
    {
      title: "Endlessly many ordered pairs",
      paragraphs: [
        "Take $x + y = 3$ and $-2x - 2y = -6$. Multiply every term of the first equation by $-2$, and you get the second exactly. So one whole equation is a multiple of the other, including the number on the right. Multiplying by a negative number does not change which pairs work.",
        "Add the second equation to 2 times the first: $(-2x - 2y) + (2x + 2y) = -6 + 6$. That leaves $0 = 0$. A statement that is always true, like $0 = 0$, is called an identity. Here it shows the second equation adds nothing new.",
        "The two lines are the same line, lying on exactly the same points. Pick any real $x$ and set $y = 3 - x$; each choice gives a pair on that line. For example, $(0, 3)$, $(1, 2)$ and $(3, 0)$ all make both equations true.",
        "There are endlessly many such pairs, but not every pair works. The pair $(0, 0)$ fails $x + y = 3$, because $0 + 0$ is not 3. So keep an original equation even when the work gives $0 = 0$.",
      ],
      illustration: "linear-system-count",
    },
    {
      title: "Vertical and horizontal cases",
      paragraphs: [
        "The system $x = 2$ and $y = 1$ fixes both numbers, so its one solution is $(2, 1)$. The system $x = 2$ and $x = 5$ has no solution: $x$ cannot be two different numbers at once.",
        "The equations $x = 2$ and $-3x = -6$ describe the same vertical (up-and-down) line. Every pair with $x = 2$ works, and $y$ can be any number. In the same way, $y = -1$ and $-4y = 4$ describe the same horizontal (across) line, and $x$ can be anything. Read these directly; do not divide by a coefficient of 0.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "How many ordered pairs $(x, y)$ satisfy x + 2y = 3 and −2x − 4y = −6?",
    steps: [
      "Make the coefficients of $x$ opposites so adding removes $x$. Multiply every term of $x + 2y = 3$ by 2: $2x + 4y = 6$.",
      "Add this to $-2x - 4y = -6$, side by side: $(2x + 4y) + (-2x - 4y) = 6 + (-6)$. Both letters cancel, leaving $0 = 0$, which is always true.",
      "Keep $x + 2y = 3$. The second equation is $-2$ times this whole equation, so it adds nothing new. Both equations describe one shared line.",
      "Pick any real $y$ and set $x = 3 - 2y$. For $y = 0$, 1 and 2, the pairs are $(3, 0)$, $(1, 1)$ and $(-1, 2)$. Endlessly many choices of $y$ give endlessly many shared pairs.",
      "Check $(1, 1)$ in both: $1 + 2 \\times 1 = 3$ and $-2 \\times 1 - 4 \\times 1 = -6$. The pair $(0, 0)$ fails both. Only pairs on the shared line work, not every pair.",
    ],
    answer: "Infinitely many ordered pairs",
  },
  closingSections: [
    {
      stage: "formal",
      title: "The precise rule",
      paragraphs: [linearSystemPrinciples["linear-system-solution-count"]!],
    },
  ],
  pitfalls: [
    "Compare the plain numbers as well as the coefficients. Matching letter terms with unequal numbers on the right give no solution.",
    "Keep an original equation even when the work gives $0 = 0$. Multiplying by a negative number keeps the line; multiplying by 0 wipes it out.",
  ],
  parentGuide:
    "Pair $x + y = 3$ first with $-2x - 2y = -6$, then with $-2x - 2y = -8$. Ask your learner to combine the equations and explain why the first system has endlessly many shared pairs and the second has none.",
};

export const linearSystemLessons = [
  linearSystemPairLesson,
  linearSystemCountLesson,
];
