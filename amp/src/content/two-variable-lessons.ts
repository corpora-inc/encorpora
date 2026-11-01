import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Glossary readings shared by the two-variable lessons and methods. */
const senses = {
  boundary: "boundary",
  multiple: "multiple",
  identity: "identity-equation",
  intersection: "intersection-graphs",
  unit: "unit",
  units: "unit",
  opposites: "opposite-number",
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
  "means",
  "more than",
  "difference",
  "plane",
  "rule",
  "rules",
  "solid",
  "edges",
  "combination",
  "quarters",
  "sort",
  "side",
  "sides",
  "left side",
  "right side",
  "term",
  "terms",
];

/** The inequality signs, said on every screen that uses them. */
const signWords =
  "The sign $<$ means “is less than” and $>$ means “is greater than”. The sign $\\le$ means “is less than or equal to” and $\\ge$ means “is greater than or equal to”.";

/** Algebra 1: equations, inequalities and systems in two variables. */
export const twoVariableLessons: Lesson[] = [
  {
    id: "two-variable-models",
    title: "Models with two unknowns",
    summary:
      "Some problems have two unknown amounts, like how many adult tickets and how many child tickets were sold. Give each one its own letter. Each fact in the story becomes one equation. Two equations about the same two unknowns are called a system. The answer is the pair of numbers that makes every equation true at once.",
    templateIds: ["system-model-value", "constraint-feasible"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Write two equations for a story with two unknowns, and solve them by substituting one into the other.",
      "Write a story's limits as inequalities, and test whether a pair of numbers meets all of them.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "One equation per fact",
        paragraphs: [
          "When two amounts are unknown, give each its own letter. One fact may give their total count. Another may give their total cost. A pair of numbers solves the story only if it makes both statements true at once.",
          "For tickets, let $a$ be the number of adult tickets and $c$ the number of child tickets. A total of 40 tickets gives $a+c=40$. Adult tickets cost 12 dollars and child tickets cost 7 dollars. A total of 380 dollars then gives $12a+7c=380$, where $12a$ means 12 times $a$. The same values of $a$ and $c$ must make both equations true.",
        ],
      },
      {
        title: "Constraints and the feasible region",
        paragraphs: [
          `A constraint is a limit the answer must meet. It is written as an inequality: a statement that one amount is less than, greater than, at most or at least another. ${signWords}`,
          "A bakery can bake at most 12 boxes a day, and wants to take in at least 60 dollars. Small boxes sell for 4 dollars and large boxes for 7 dollars. With $x$ small boxes and $y$ large boxes: $x + y \\le 12$ and $4x + 7y \\ge 60$. Also $x \\ge 0$ and $y \\ge 0$, because you cannot bake fewer than 0 boxes.",
          "Each inequality is true on one side of a straight line. That line is called the boundary. The pairs that meet every condition are where all those sides overlap. That overlap is shaded and called the feasible region, the set of possible answers. Boxes come whole, so only the whole-number points in it count here.",
          "$(3, 8)$ is inside it: $3 + 8 = 11$, and $11 \\le 12$. Also $4 × 3 + 7 × 8 = 68$, and $68 \\ge 60$. But $(8, 2)$ is not: $4 × 8 + 7 × 2 = 46$, which is less than 60.",
        ],
        illustration: "feasible-bakery",
      },
    ],
    workedExample: {
      prompt:
        "A theater sold 40 tickets for 380 dollars. Adult tickets cost 12 dollars and child tickets cost 7 dollars. How many adult tickets were sold?",
      steps: [
        "Let $a$ be the adult tickets and $c$ the child tickets. One equation for the count and one for the money: $a + c = 40$ and $12a + 7c = 380$.",
        "Subtract $a$ from both sides of the first equation: $c = 40 - a$. Put that in place of $c$ in the second equation, so only $a$ is left: $12a + 7(40 - a) = 380$. Here $7(40 - a)$ means 7 times the whole amount $40 - a$.",
        "Multiply the 7 into the parentheses: $7 × 40 = 280$ and $7 × a = 7a$, so $12a + 280 - 7a = 380$. Combine $12a - 7a = 5a$: $5a + 280 = 380$. Subtract 280 from both sides: $5a = 100$. Divide both sides by 5: $a = 20$.",
        "Check both facts. Then $c = 40 - 20 = 20$, and $12 × 20 + 7 × 20 = 240 + 140 = 380$.",
      ],
      answer: "20",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Two straight-line equations in $x$ and $y$ that are not parallel share exactly one pair. Two different parallel lines share none, and two copies of the same line share endlessly many. Substitution replaces one unknown with an equal expression from the other equation. It does not change the shared solutions.",
          "A pair is feasible exactly when it makes every inequality of the system true. So the feasible region is where all their half-planes overlap. A half-plane is all the points on one side of a line.",
        ],
      },
    ],
    pitfalls: [
      "Do not use one letter for both amounts. Give each unknown its own letter.",
      "A pair must meet every constraint, not just one.",
      "Points on a solid boundary line count. Check the boundary's inequality sign.",
    ],
    parentGuide:
      "Use a real purchase with two kinds of items and a total, such as stamps at two prices. Ask how many of each were bought. Then add a limit (“at most 10 items”) and list the pairs that still work.",
  },
  {
    id: "half-plane-regions",
    title: "Inequalities in two variables",
    summary:
      "An inequality compares two amounts. The sign $<$ means “is less than”, so $y < 2x - 1$ says $y$ is less than $2x - 1$. It is true for some points on a grid and false for others; a point $(x, y)$ means go $x$ across, then $y$ up. For an inequality like this one, the points where the two sides are equal form a straight line, called the boundary. The points that make it true fill one whole side of that line. Draw the line, then test one point to see which side to shade.",
    templateIds: ["half-plane-inequality", "inequality-solution-point"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Graph an inequality in $x$ and $y$: its boundary line, solid or dashed, and the shaded side.",
      "Decide whether a point is a solution, including points on the boundary, and read the inequality from its graph.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Boundary, then side",
        paragraphs: [
          `${signWords} A point $(x, y)$ means across $x$, then up $y$. A solution is a point that makes the inequality true.`,
          "For $y < 2x - 1$, first draw the boundary line $y = 2x - 1$. Points on it make $y$ equal to $2x - 1$, not less. So they are not solutions, and the line is drawn dashed. For $y \\le 2x - 1$, the line is included and drawn solid.",
          "Then test one point that is not on the line. $(0, 0)$ gives $0 < 2 × 0 - 1$, which is $0 < -1$. That is false, so $(0, 0)$ is not a solution, and the other side is shaded. Every point on one side gives the same answer, because the line is where true switches to false.",
        ],
        illustration: "half-plane-test-point",
      },
      {
        title: "Two inequalities at once",
        paragraphs: [
          "A system of inequalities is two or more inequalities that must all be true. Its solutions are where all the shaded sides overlap. For $y \\ge x - 2$ and $x < 3$, shade above the solid line $y = x - 2$. Also shade to the left of the dashed line $x = 3$. The solutions are where the shadings overlap.",
          "To read an inequality from a graph, first name the boundary line from two of its grid points. See whether it is solid or dashed. Then put a shaded point into the inequality to choose the sign.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is (3, 4) a solution of y ≤ 2x − 1?",
      steps: [
        "The point $(3, 4)$ has $x = 3$ and $y = 4$. Work out the right side with $x = 3$: $2 × 3 - 1 = 5$.",
        "Now compare: $4 \\le 5$ is true, so $(3, 4)$ makes the inequality true. It is a solution.",
      ],
      answer: "Yes",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "A line splits the flat grid into two half-planes, one on each side. Every point on one side makes the strict inequality ($<$ or $>$) true, and every point on the other side makes the reverse one true.",
          "A point is a solution exactly when putting in its coordinates makes the inequality true. Points on the boundary make only $\\le$ and $\\ge$ true.",
        ],
      },
    ],
    pitfalls: [
      "Do not shade by the look of the sign alone. Test a point.",
      "For one inequality, a point on a dashed boundary is not a solution, and a point on a solid boundary is. With two inequalities, a point must also make the other one true.",
      "Do not use $(0, 0)$ as the test point when it lies on the boundary line.",
    ],
    parentGuide:
      "Draw the line $y = x + 1$ on graph paper. Pick points above it, below it and on it. Sort them as solutions or not for $y > x + 1$ and for $y \\le x + 1$. Ask which points change when the line becomes dashed.",
  },
  {
    id: "literal-equations",
    title: "Equations with letters as coefficients",
    summary:
      "Sometimes the number multiplying $x$ is itself a letter, as in $kx + 7 = 19$. That number is called the coefficient. To solve for $x$ means to find the value of $x$ that makes the equation true. Do it as usual, treating $k$ like a fixed number. You may divide by $k$ only when $k$ is not 0. In an inequality, a comparison such as $kx \\ge 6$, dividing by a negative $k$ reverses the comparison: $\\ge$ becomes $\\le$.",
    templateIds: ["literal-equation-solve", "parameter-solution-count"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Solve equations and inequalities whose coefficients are letters, saying what each step needs.",
      "Find the value of a letter that leaves an equation or system with no solution or with endlessly many.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Treat the letter as a fixed number",
        paragraphs: [
          "To solve $kx + 7 = 19$ for $x$, subtract 7 from both sides: $kx = 12$. Dividing by $k$ is allowed only when $k \\ne 0$ ($k$ is not 0). So $x = \\frac{12}{k}$ for every $k \\ne 0$. When $k = 0$, the left side is 7 for every $x$, never 19. Then there is no solution.",
          `Inequalities also need the sign of the letter. ${signWords} If $k < 0$, then $kx + 4 \\ge 10$ gives $kx \\ge 6$. Dividing by the negative $k$ flips the sign: $x \\le \\frac{6}{k}$. With $k = -2$, this is $x \\le -3$. Check $x = -4$: $-2 × (-4) + 4 = 8 + 4 = 12$, and $12 \\ge 10$.`,
        ],
      },
      {
        title: "No solution or endlessly many",
        paragraphs: [
          "In $ax + 4 = 3x + 9$, gather the $x$ terms on the left: subtract $3x$ and 4 from both sides. That gives $(a - 3)x = 5$. If $a = 3$, the left side is $0x = 0$ for every $x$, while the right side is 5. So there is no solution. For any other $a$, $x = \\frac{5}{a - 3}$.",
          "Now take $2(x + 3) = 2x + c$, which becomes $2x + 6 = 2x + c$. The $x$ terms always match. If $c = 6$, the two sides are the same, so every $x$ is a solution. Otherwise there is none.",
          "For a system, $kx + 2y = 5$ and $3x + y = 1$ have no solution when their lines are parallel and different. $k = 6$ makes the left side 2 times $3x + y$, but $5 \\ne 2 × 1$. So the lines are parallel and never meet.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For what value of a does the equation ax + 4 = 3x + 9 have no solution?",
      steps: [
        "Gather the $x$ terms on one side: subtract $3x$ and 4 from both sides. That gives $(a - 3)x = 5$.",
        "If $a = 3$, the left side is $0 · x$, which is 0 for every $x$, while the right side is 5. Since $0 \\ne 5$, no $x$ works.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "The rules for keeping both sides equal work for every value of a letter coefficient, with two limits. You may divide only by a letter that is not 0. Dividing an inequality by a negative number, a number less than 0, flips its sign.",
          "An equation $ax = b$ has no solution when $a = 0$ and $b \\ne 0$. Every $x$ is a solution when $a = 0$ and $b = 0$.",
        ],
      },
    ],
    pitfalls: [
      "Do not divide by a letter without saying it is not 0.",
      "Dividing an inequality by a negative letter flips the sign.",
      "For one equation like $ax + 4 = 3x + 9$, no solution needs equal $x$ coefficients and different plain numbers. If the plain numbers are equal too, there are endlessly many solutions.",
    ],
    parentGuide:
      "Solve one equation together with a number, such as $3x + 7 = 19$. Then replace the 3 with $k$ and solve again, saying at each step what the step needs ($k \\ne 0$). Ask what happens when $k$ is 0.",
  },
  {
    id: "equation-reasoning",
    title: "Why each step works",
    summary:
      "A solution of an equation is a number that makes it true. Each step in solving needs a reason that keeps the solution the same. There are two safe kinds of step. You can rewrite one side as something equal to it. Or you can add or subtract the same number on both sides, or multiply or divide both sides by the same number that is not 0. Multiplying both sides by 0 can change the solutions, and dividing by 0 is never allowed.",
    templateIds: ["equation-step-property"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Name the reason for each step: distributing, combining like terms, or adding, subtracting, multiplying or dividing both sides.",
      "Find the step that breaks the equation in a worked solution.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Reasons for the steps",
        paragraphs: [
          "Solve $3(x - 4) = 18$. A number right before parentheses multiplies everything inside. Multiplying it by each part is called distributing, and the rule that allows it is the distributive property. It rewrites the left side: $3x - 12 = 18$.",
          "Next, add 12 to both sides: $3x = 30$. Adding the same number to both sides is called the addition property of equality. Then divide both sides by 3: $x = 10$. That is the division property of equality.",
          "Each step either rewrites one side as an equal expression, or does the same operation to both sides. Combining like terms (terms with the same letter part, like $5x$ and $2x$) is a rewrite too. Both kinds keep the solution: 10 makes every line true.",
        ],
        illustration: "equation-step-reasons",
      },
      {
        title: "Finding the broken step",
        paragraphs: [
          "A wrong step usually changes the solution. Going from $3(x - 4) = 18$ to $3x - 4 = 18$ multiplies only the first part by 3. The lines after it may be done correctly, but they solve the wrong equation: $3x = 22$ and $x = \\frac{22}{3}$.",
          "To find the error, redo each step from the line above it and compare. Then put the final value into the original equation: $3(\\frac{22}{3} - 4) = 10$, not 18.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In solving 3(x − 4) = 18, which property justifies the step from 3x − 12 = 18 to 3x = 30?",
      steps: [
        "Compare the two lines. The left side went from $3x - 12$ to $3x$, so 12 was added. The right side went from 18 to $18 + 12 = 30$. So 12 was added to both sides.",
        "Adding the same number to both sides is called the addition property of equality.",
      ],
      answer: "Addition property of equality",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Adding or subtracting the same expression on both sides keeps an equation's solutions, as long as that expression has a value wherever the original does. Multiplying or dividing both sides by the same amount can be undone, so it also keeps them, if that amount always has a value and is never 0. Multiplying by 0 can add solutions, and dividing by 0 has no meaning. Replacing an expression with an equal one keeps its value.",
        ],
      },
    ],
    pitfalls: [
      "When you add, subtract, multiply or divide, do it to both sides, not one. Rewriting one side as something equal is the only change made to one side alone.",
      "Distribute to every part inside the parentheses.",
      "Subtracting a negative number, a number less than 0, is the same as adding. Name the operation that was really done.",
    ],
    parentGuide:
      "Solve an equation aloud together, saying the reason for each step before writing it. Then write a solution with one deliberate mistake and ask your learner to find it.",
  },
  {
    id: "elimination-why",
    title: "Why elimination works",
    summary:
      "A system is two equations about the same two unknowns, $x$ and $y$. Its solution is the pair of values that makes both true. Elimination means adding the two equations, left sides together and right sides together, so one letter disappears. In $x + 2y = 7$ and $3x - 2y = 5$, $2y$ and $-2y$ add to 0, leaving $4x = 12$. Keep one original equation beside this sum, and the solutions stay exactly the same.",
    templateIds: ["elimination-equivalent"],
    includeGeneratedRepresentation: false,
    senses,
    noLink,
    objectives: [
      "Add two equations, or one equation and a multiple of the other, to remove a letter.",
      "Explain why the new system has the same solutions as the original.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Stack and add",
        paragraphs: [
          "Write $x + 2y = 7$ above $3x - 2y = 5$. The $y$ terms, $2y$ and $-2y$, are opposites: they add to 0. So add the left sides together and the right sides together: $4x + 0y = 12$. That is $4x = 12$, so $x = 3$. Then $x + 2y = 7$ gives $3 + 2y = 7$, so $2y = 4$ and $y = 2$.",
          "If no terms are opposites, first multiply a whole equation, both of its sides, by a number. To remove $y$ from $2x + 3y = 13$ and $x - y = 4$, multiply the second by 3: $3x - 3y = 12$. Add that to the first: $5x = 25$.",
        ],
        illustration: "elimination-stacked",
      },
      {
        title: "No solution gained or lost",
        paragraphs: [
          "Say a pair $(x, y)$ makes both equations true. Adding equal amounts to equal amounts keeps them equal, so it makes the sum true too. Going back, subtracting the first equation from the sum gives the second again.",
          "So the system $x + 2y = 7$ and $3x - 2y = 5$ has the same solutions as the system $x + 2y = 7$ and $4x = 12$.",
          "On a graph, the three lines $x + 2y = 7$, $3x - 2y = 5$ and $x = 3$ all pass through the same point, $(3, 2)$. The new line is different, but it crosses at the same solution.",
        ],
        illustration: "elimination-lines",
      },
    ],
    workedExample: {
      prompt: "Add x + 2y = 7 and 3x − 2y = 5. What is $x$?",
      steps: [
        "Add the left sides together and the right sides together. The $y$ terms cancel, because $2y + (-2y) = 0$. The sum is $4x = 12$.",
        "Divide both sides by 4 to get $x$ alone: $x = 3$.",
      ],
      answer: "3",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Replacing one equation by its sum with the other equation times a number can be undone. So it keeps the system's solutions exactly the same.",
        ],
      },
    ],
    pitfalls: [
      "Multiply every term of an equation, its right side too.",
      "Keep one original equation beside the sum. The sum alone is true for endlessly many pairs.",
      "Add like terms in columns. Do not add an $x$ term to a $y$ term.",
    ],
    parentGuide:
      "Write two equations whose $y$ terms are opposites and add them together. Check that the original solution also makes the sum true. Then ask why adding can never lose a solution.",
  },
];

export const twoVariableMethods: Record<string, ProblemMethod> = {
  "system-model-value": {
    goal: "Solve a story with two unknown amounts and two facts about them.",
    senses,
    noLink,
    intuition:
      "When a story has two unknown amounts, give each its own letter, like $a$ for adult tickets and $c$ for child tickets. Each fact becomes one equation: one for the total count, one for the total cost. Two equations about the same unknowns are called a system. Its solution is the pair that makes both equations true.",
    method: [
      "Name the two unknowns. Write one equation for the count and one for the value, such as $a + c = 40$ and $12a + 7c = 380$.",
      "Get one letter alone in the count equation ($c = 40 - a$), and put that in its place in the value equation. Now only one letter is left.",
      "Solve for that letter, then find the other. Check that the pair fits both facts.",
    ],
    watch:
      "Multiply each price by its own count: $12a + 7c$, not 12 + 7 times the total.",
  },
  "constraint-feasible": {
    goal: "Choose the pair of numbers that meets every limit in a story.",
    senses,
    noLink,
    intuition: `A constraint is a limit that the answer must meet. It is written as an inequality, a statement that compares two amounts. “At most” means less than or equal to, and “at least” means greater than or equal to. ${signWords} A pair $(x, y)$ is feasible, or possible, when it makes every inequality true at once.`,
    terms: ["feasible-region"],
    method: [
      "Put the pair into each inequality in turn: the first number for $x$ and the second for $y$.",
      "Keep the pair only if every inequality is true. A point exactly on the line counts when the sign is $\\le$ or $\\ge$.",
    ],
    watch:
      "A pair that meets one limit can still break another. Test all of them.",
  },
  "half-plane-inequality": {
    goal: "Read the inequality, or the system of inequalities, that a shaded region on a graph shows.",
    senses,
    noLink,
    intuition: `${signWords} A linear inequality, such as $y < 2x - 1$, is true for every point on one side of a straight line, called the boundary. A solid boundary line is included ($\\le$ or $\\ge$); a dashed one is not ($<$ or $>$). The shading shows the side that makes it true.`,
    method: [
      "Name the boundary line from two of its grid points.",
      "Use $\\le$ or $\\ge$ for a solid boundary, and $<$ or $>$ for a dashed one.",
      "Put a shaded point into the inequality to choose which way the sign points.",
    ],
    watch:
      "Test a point instead of guessing the side from the sign. With $y$ alone on the left, $y > \\ldots$ is above the line. But $-y > x$ means $y < -x$, which is below the line.",
  },
  "inequality-solution-point": {
    goal: "Choose the point that makes an inequality in $x$ and $y$ true.",
    senses,
    noLink,
    intuition: `${signWords} A point $(x, y)$ is a solution when putting in its numbers, $x$ first, makes the inequality true. Points exactly on the boundary line, where the two sides are equal, count only for $\\le$ and $\\ge$.`,
    method: [
      "Put each point into the inequality, the first number for $x$ and the second for $y$.",
      "Keep the point that makes it true. If the two sides come out equal, the point counts only for $\\le$ and $\\ge$.",
    ],
    watch:
      "A point on a dashed boundary line is not a solution: equal is not less or greater.",
  },
  "literal-equation-solve": {
    goal: "Solve an equation or inequality in which the number multiplying $x$ is a letter, such as $kx + 7 = 19$.",
    senses,
    noLink,
    intuition: `The coefficient is the number multiplying $x$. Here it is a letter, such as $k$, that stands for a fixed number. Solve as usual, treating $k$ like any number. You may divide by $k$ only when $k \\ne 0$ ($k$ is not 0). ${signWords} Dividing an inequality by a negative number flips the sign.`,
    method: [
      "Treat the letter as a fixed number. Add or subtract on both sides so the $x$ term stands alone.",
      "Divide both sides by the coefficient, using the stated fact that it is not 0.",
      "For an inequality, flip the sign when the letter you divide by is negative.",
    ],
    watch:
      "Dividing by a negative letter flips an inequality, just as dividing by a negative number does.",
  },
  "parameter-solution-count": {
    goal: "Find the value of a letter that gives an equation or system no solution, or endlessly many.",
    senses,
    noLink,
    intuition:
      "A solution is a value of $x$ that makes an equation true. Gather the $x$ terms on one side and the plain numbers on the other. If the number in front of $x$ becomes 0, the $x$ disappears. Then the equation is either always true (endlessly many solutions) or never true (no solution).",
    method: [
      "Gather the $x$ terms on one side and the plain numbers on the other.",
      "No solution: the number in front of $x$ is 0 and the plain numbers differ. Endlessly many: both sides are exactly the same.",
      "For a system of two line equations: no solution when the lines are parallel (lines that never meet) and different.",
    ],
    watch:
      "Equal numbers in front of $x$ are not enough. Compare the plain numbers too.",
  },
  "equation-step-property": {
    goal: "Name the reason for a step in solving an equation, or find the step that is wrong.",
    senses,
    noLink,
    intuition:
      "Each step in solving an equation is one of two kinds. Either one side is rewritten as something equal, or the same number is added to or subtracted from both sides, or both sides are multiplied or divided by the same number that is not 0. Distributing means multiplying a number by each part inside parentheses, the curved brackets ( ). Like terms are parts with exactly the same letter part, such as $5x$ and $2x$; combining them gives $7x$. Doing the same to both sides has names, such as the addition property of equality.",
    method: [
      "Compare the two lines. Was one side rewritten, or was the same thing done to both sides?",
      "Name it: the distributive property, combining like terms, or the addition, subtraction, multiplication or division property of equality.",
      "To find a wrong step, redo each step from the line above and compare.",
    ],
    watch:
      "Name what was really done. Adding a negative number is the addition property; subtracting a positive number is the subtraction property.",
  },
  "elimination-equivalent": {
    goal: "Add two equations of a system to remove a letter, and explain why the solutions stay the same.",
    senses,
    noLink,
    intuition:
      "A system is two equations about the same unknowns $x$ and $y$. If both are true, adding them, left side to left side and right side to right side, gives another true equation. When one letter has opposite numbers in front of it, like $2y$ and $-2y$, adding makes it cancel. This is called elimination.",
    method: [
      "Multiply a whole equation, both sides, by a number (not 0) so one letter has opposite numbers in front of it.",
      "Add the left sides together and the right sides together. That letter cancels.",
      "Keep one original equation beside the sum. The new system has the same solutions as the old one.",
    ],
    watch: "Multiply every term, the right side included.",
  },
};

export const twoVariablePrinciples: Record<string, string> = {
  "system-model-value":
    "Two straight-line equations in two unknowns share exactly one pair when their lines are not parallel, meaning the lines do cross. Substitution keeps their shared solutions while leaving only one unknown.",
  "constraint-feasible":
    "A pair is feasible exactly when it makes every inequality of the system true. So the feasible region is where all their half-planes (the sides of their lines) overlap.",
  "half-plane-inequality":
    "A line splits the grid into two half-planes. Every point on one side makes the strict inequality ($<$ or $>$) true, and every point on the other side makes the reverse true.",
  "inequality-solution-point":
    "A point is a solution exactly when putting in its coordinates makes the inequality true. Points on the boundary line make only $\\le$ and $\\ge$ true.",
  "literal-equation-solve":
    "The rules for keeping both sides equal work for every value of a letter coefficient. But you may divide only by a letter that is not 0, and dividing an inequality by a negative number flips it.",
  "parameter-solution-count":
    "An equation $ax = b$ has no solution when $a = 0$ and $b \\ne 0$. Every $x$ is a solution when $a = 0$ and $b = 0$.",
  "equation-step-property":
    "Adding or subtracting the same expression on both sides keeps the solutions. Multiplying or dividing both sides by an amount that is never 0 can be undone, so it keeps them too. Dividing by 0 has no meaning.",
  "elimination-equivalent":
    "Replacing one equation by its sum with a multiple of the other can be undone, so it keeps the system's solutions exactly the same.",
};
