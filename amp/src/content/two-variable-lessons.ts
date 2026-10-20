import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** Algebra 1: equations, inequalities and systems in two variables. */
export const twoVariableLessons: Lesson[] = [
  {
    id: "two-variable-models",
    title: "Models with two unknowns",
    summary:
      "Two unknown amounts need two facts: write one equation (or inequality) for each and find the pair that makes all of them true.",
    templateIds: ["system-model-value", "constraint-feasible"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Write a system of two equations for a situation and solve it by substitution.",
      "Read a situation's limits as inequalities and test combinations against all of them.",
    ],
    sections: [
      {
        title: "One equation per fact",
        paragraphs: [
          "A theater sold 40 tickets for 380 dollars; adult tickets cost 12 dollars and child tickets 7 dollars. Let a be the adult tickets and $c$ the child tickets. Counting gives a + c = 40, and the money gives 12a + 7c = 380.",
          "Substitute c = 40 − a: 12a + 7(40 − a) = 380, so 5a + 280 = 380, 5a = 100 and a = 20. Then c = 40 − 20 = 20. Check: 12 × 20 + 7 × 20 = 380.",
        ],
      },
      {
        title: "Constraints and the feasible region",
        paragraphs: [
          "A bakery can bake at most 12 boxes a day and wants to take in at least 60 dollars, selling small boxes at 4 dollars and large boxes at 7 dollars. With $x$ small and $y$ large boxes: x + y ≤ 12 and 4x + 7y ≥ 60, with x ≥ 0 and y ≥ 0.",
          "Each inequality is true on one side of its boundary line. The combinations that meet every condition are the overlap: the shaded feasible region. (3, 8) is inside it: 3 + 8 = 11 ≤ 12 and 4 × 3 + 7 × 8 = 68 ≥ 60. (8, 2) is not: 4 × 8 + 7 × 2 = 46, less than 60.",
        ],
        illustration: "feasible-bakery",
      },
    ],
    workedExample: {
      prompt:
        "A theater sold 40 tickets for 380 dollars. Adult tickets cost 12 dollars and child tickets cost 7 dollars. How many adult tickets were sold?",
      steps: [
        "a + c = 40 and 12a + 7c = 380.",
        "Substitute c = 40 − a: 12a + 280 − 7a = 380, so 5a = 100 and a = 20.",
        "Check: 12 × 20 + 7 × 20 = 380.",
      ],
      answer: "20",
    },
    pitfalls: [
      "Do not use one variable for both amounts: name each unknown.",
      "A combination must meet every constraint, not just one.",
      "Points on a solid boundary count; check the boundary's inequality sign.",
    ],
    parentGuide:
      "Use a real purchase with two kinds of items and a total, such as stamps at two prices, and ask how many of each were bought. Then add a limit (“at most 10 items”) and list the combinations that still work.",
  },
  {
    id: "half-plane-regions",
    title: "Inequalities in two variables",
    summary:
      "The solutions of a linear inequality fill a half-plane: draw the boundary line, solid when it is included and dashed when it is not, then test a point to choose the side.",
    templateIds: ["half-plane-inequality", "inequality-solution-point"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Graph a linear inequality: its boundary, solid or dashed, and the shaded side.",
      "Decide whether a point is a solution, including points on the boundary, and read the inequality from its graph.",
    ],
    sections: [
      {
        title: "Boundary, then side",
        paragraphs: [
          "For y < 2x − 1, first draw the boundary y = 2x − 1. Points on it make $y$ equal to 2x − 1, not less, so they are not solutions: draw the line dashed. For y ≤ 2x − 1 the line is included and drawn solid.",
          "Then test one point off the line. (0, 0) gives 0 < 2 × 0 − 1 = −1, which is false, so (0, 0) is not a solution and the other side is shaded. Every point on one side gives the same answer, because the line is where the two sides change places.",
        ],
        illustration: "half-plane-test-point",
      },
      {
        title: "Two inequalities at once",
        paragraphs: [
          "A system of inequalities is solved where all of its half-planes overlap. For y ≥ x − 2 and x < 3, shade above the solid line y = x − 2 and to the left of the dashed line x = 3: the solutions are the overlap.",
          "To read an inequality from a graph, name the boundary line from two of its grid points, note whether it is solid or dashed, and substitute a shaded point to choose the sign.",
        ],
      },
    ],
    workedExample: {
      prompt: "Is (3, 4) a solution of y ≤ 2x − 1?",
      steps: [
        "Substitute x = 3: 2 × 3 − 1 = 5.",
        "4 ≤ 5 is true, so (3, 4) is a solution.",
      ],
      answer: "Yes",
    },
    pitfalls: [
      "Do not shade by the look of the sign alone; test a point.",
      "A point on a dashed boundary is not a solution; on a solid boundary it is.",
      "Do not use (0, 0) as the test point when it lies on the boundary.",
    ],
    parentGuide:
      "Draw a line on graph paper, pick points on both sides and on the line, and sort them as solutions or not for “$y$ is greater than” and “$y$ is at most”. Ask which points change when the line becomes dashed.",
  },
  {
    id: "literal-equations",
    title: "Equations with letters as coefficients",
    summary:
      "Solve with a letter exactly as with a number, but every division needs that letter to be nonzero, and dividing an inequality by a negative letter reverses it.",
    templateIds: ["literal-equation-solve", "parameter-solution-count"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Solve linear equations and inequalities whose coefficients are letters, stating the condition each step needs.",
      "Find the parameter value that leaves an equation or system with no solution or infinitely many.",
    ],
    sections: [
      {
        title: "Treat the letter as a fixed number",
        paragraphs: [
          "To solve kx + 7 = 19 for $x$, subtract 7: kx = 12. Dividing by $k$ is allowed only when k ≠ 0, so x = 12/k for every k ≠ 0. When k = 0 the left side is 7 for every $x$, never 19, so there is no solution.",
          "Inequalities need the sign of the letter. If k < 0, then kx + 4 ≥ 10 gives kx ≥ 6 and, dividing by the negative $k$, x ≤ 6/k. With k = −2: x ≤ −3, and indeed x = −4 gives 8 + 4 = 12 ≥ 10.",
        ],
      },
      {
        title: "No solution or infinitely many",
        paragraphs: [
          "Collecting the $x$-terms of ax + 4 = 3x + 9 gives (a − 3)x = 5. If a = 3 the left side is 0 for every $x$ while the right side is 5: no solution. For any other $a, x = 5/(a - 3)$.",
          "2(x + 3) = 2x + c becomes 2x + 6 = 2x + c. The $x$-terms always match, so if c = 6 the two sides are identical and every $x$ is a solution; otherwise there is none. For a system, kx + 2y = 5 and 3x + y = 1 have no solution when the lines are parallel and different: k = 6 makes the left side twice 3x + y while 5 ≠ 2 × 1.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For what value of a does the equation ax + 4 = 3x + 9 have no solution?",
      steps: [
        "Subtract 3x and 4 from both sides: (a − 3)x = 5.",
        "If a = 3, the left side is $0 · x$, which is 0 for every $x$, while the right side is 5: no $x$ works.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Do not divide by a letter without saying it is nonzero.",
      "Dividing an inequality by a negative letter reverses it.",
      "No solution needs equal $x$-coefficients and different constants; equal constants too give infinitely many.",
    ],
    parentGuide:
      "Solve one equation together with a number, such as 3x + 7 = 19, then replace the 3 with $k$ and solve again, saying at each step what the step needs (k ≠ 0). Ask what happens when $k$ is 0.",
  },
  {
    id: "equation-reasoning",
    title: "Why each step works",
    summary:
      "Each step of solving an equation does the same thing to both sides, or rewrites one side as an equal expression, so every line has the same solutions as the one before.",
    templateIds: ["equation-step-property"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the property that justifies each step: distributive, combining like terms, or adding, subtracting, multiplying or dividing both sides.",
      "Find the step that breaks the equality in a worked solution.",
    ],
    sections: [
      {
        title: "Reasons for the steps",
        paragraphs: [
          "Solving 3(x − 4) = 18: the distributive property rewrites the left side, 3x − 12 = 18. The addition property of equality adds 12 to both sides, 3x = 30. The division property of equality divides both sides by 3, x = 10.",
          "Each step either rewrites one side as an equal expression (distributing, combining like terms) or applies the same operation to both sides. Both keep the solutions: 10 makes every line true.",
        ],
        illustration: "equation-step-reasons",
      },
      {
        title: "Finding the broken step",
        paragraphs: [
          "A wrong step changes the solutions. In 3(x − 4) = 18 → 3x − 4 = 18, only the first term was multiplied by 3. The lines after it may be done correctly, but they solve the wrong equation: 3x = 22 and x = 22/3.",
          "To find the error, redo each step from the line above it and compare. Then substitute the final value into the original equation: 3(22/3 − 4) = 10, not 18.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In solving 3(x − 4) = 18, which property justifies the step from 3x − 12 = 18 to 3x = 30?",
      steps: [
        "The step adds 12 to both sides: 18 + 12 = 30.",
        "Adding the same number to both sides is the addition property of equality.",
      ],
      answer: "Addition property of equality",
    },
    pitfalls: [
      "Do not apply an operation to one side only.",
      "Distribute to every term inside the parentheses.",
      "Subtracting a negative is adding: name the operation actually done.",
    ],
    parentGuide:
      "Solve an equation aloud together, saying the reason for each step before writing it. Then write a solution with one deliberate mistake and ask your learner to find it.",
  },
  {
    id: "elimination-why",
    title: "Why elimination works",
    summary:
      "Replacing an equation of a system by its sum with a multiple of the other keeps exactly the same solutions, so elimination never gains or loses one.",
    templateIds: ["elimination-equivalent"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Add two equations, or one and a multiple of the other, to eliminate a variable.",
      "Explain why the new system has the same solutions as the original.",
    ],
    sections: [
      {
        title: "Stack and add",
        paragraphs: [
          "Write x + 2y = 7 above 3x − 2y = 5. The $y$-terms are opposites, so adding the left sides and the right sides gives 4x + 0y = 12, that is 4x = 12, and x = 3. Then x + 2y = 7 gives 2y = 4 and y = 2.",
          "If no terms are opposites, multiply an equation first, both of its sides: to eliminate $y$ from 2x + 3y = 13 and x − y = 4, add 3 times the second, 3x − 3y = 12, to the first: 5x = 25.",
        ],
        illustration: "elimination-stacked",
      },
      {
        title: "No solution gained or lost",
        paragraphs: [
          "If $(x, y)$ makes both equations true, adding equal amounts to equal amounts keeps them equal, so it makes the sum true. Back the other way, subtracting the first equation from the sum gives the second. So the systems {$x + 2y = 7$, 3x − 2y = 5} and {$x + 2y = 7$, 4x = 12} have the same solutions.",
          "On a graph, the three lines x + 2y = 7, 3x − 2y = 5 and x = 3 all pass through the same point, (3, 2). The new line is different, but it crosses at the same solution.",
        ],
        illustration: "elimination-lines",
      },
    ],
    workedExample: {
      prompt: "Add x + 2y = 7 and 3x − 2y = 5. What is $x$?",
      steps: [
        "The $y$-terms cancel: 2y + (−2y) = 0. The sum is 4x = 12.",
        "Divide by 4: x = 3.",
      ],
      answer: "3",
    },
    pitfalls: [
      "Multiply every term of an equation, its right side too.",
      "Keep one original equation beside the sum; the sum alone has infinitely many solutions.",
      "Add like terms in columns; do not add an $x$-term to a $y$-term.",
    ],
    parentGuide:
      "Write two equations whose $y$-terms are opposites, add them together, and check that the original solution also makes the sum true. Then ask why adding can never lose a solution.",
  },
];

export const twoVariableMethods: Record<string, ProblemMethod> = {
  "system-model-value": {
    goal: "Solve a situation with two unknown amounts and two facts about them.",
    method: [
      "Name the two unknowns, and write one equation for the count and one for the value.",
      "Solve the count equation for one unknown and substitute it into the value equation.",
      "Solve, find the other unknown, and check both facts.",
    ],
    watch:
      "Multiply each price by its own count: 12a + 7c, not 12 + 7 times the total.",
  },
  "constraint-feasible": {
    goal: "Choose the combination that meets every constraint of a situation.",
    terms: [["feasible region", "The points that make every inequality true."]],
    method: [
      "Substitute the pair into each inequality in turn.",
      "Keep the pair only if every inequality is true; a point on a solid boundary counts.",
    ],
    watch:
      "A pair that meets one constraint can still break another: test all of them.",
  },
  "half-plane-inequality": {
    goal: "Read the inequality or system that a shaded region shows.",
    method: [
      "Name the boundary line from two of its grid points.",
      "Use ≤ or ≥ for a solid boundary and < or > for a dashed one.",
      "Substitute a shaded point to choose the direction of the sign.",
    ],
    watch:
      "Test a point instead of guessing the side from the sign: $y$ > … is above, but 2x + 3y > … depends on the coefficients.",
  },
  "inequality-solution-point": {
    goal: "Choose the point that solves a two-variable inequality.",
    method: [
      "Substitute each point, $x$ first, into the inequality.",
      "Keep the point that makes it true; on the boundary, only ≤ and ≥ include it.",
    ],
    watch: "A point on a dashed boundary is not a solution.",
  },
  "literal-equation-solve": {
    goal: "Solve a linear equation or inequality with a letter as a coefficient.",
    method: [
      "Treat the letter as a fixed number and isolate the $x$-term with inverse operations.",
      "Divide by the coefficient, using the stated condition that it is not 0.",
      "For an inequality, reverse the sign when the letter you divide by is negative.",
    ],
    watch:
      "Dividing by a negative letter reverses an inequality, just as dividing by a negative number does.",
  },
  "parameter-solution-count": {
    goal: "Find the parameter value that gives no solution or infinitely many.",
    method: [
      "Collect the $x$-terms on one side and the constants on the other.",
      "No solution: the $x$-coefficient is 0 and the constants differ. Infinitely many: both sides are identical.",
      "For a system: no solution when the lines are parallel and different.",
    ],
    watch:
      "Equal $x$-coefficients alone are not enough: compare the constants too.",
  },
  "equation-step-property": {
    goal: "Name the reason for a step in solving an equation, or find the wrong step.",
    method: [
      "Compare the two lines: was one side rewritten, or was the same operation done to both sides?",
      "Name it: distributive property, combining like terms, or the addition, subtraction, multiplication or division property of equality.",
      "To find an error, redo each step from the line above and compare.",
    ],
    watch:
      "Adding a negative number is the addition property; subtracting a positive one is the subtraction property: name what was done.",
  },
  "elimination-equivalent": {
    goal: "Add equations of a system and explain why the solutions stay the same.",
    method: [
      "Multiply an equation through, both sides, so that one variable's coefficients are opposites.",
      "Add the left sides and the right sides; that variable cancels.",
      "Keep one original equation beside the sum: the new system has the same solutions.",
    ],
    watch: "Multiply every term, the right side included.",
  },
};

export const twoVariablePrinciples: Record<string, string> = {
  "system-model-value":
    "Two independent linear facts about two unknowns determine them: substitution reduces the system to one equation in one unknown.",
  "constraint-feasible":
    "A combination is feasible exactly when it satisfies every inequality of the system, so the feasible set is the intersection of their half-planes.",
  "half-plane-inequality":
    "A line divides the plane into two half-planes; every point of one side satisfies the strict inequality and every point of the other its reverse.",
  "inequality-solution-point":
    "A point satisfies an inequality exactly when substituting its coordinates makes it true; boundary points satisfy only ≤ and ≥.",
  "literal-equation-solve":
    "Properties of equality hold for every value of a letter coefficient, except that division requires it to be nonzero and dividing an inequality by a negative reverses it.",
  "parameter-solution-count":
    "A linear equation ax = b has no solution when a = 0 and b ≠ 0, and every $x$ is a solution when a = 0 and b = 0.",
  "equation-step-property":
    "Applying the same operation to both sides, or rewriting one side as an equal expression, produces an equation with exactly the same solutions.",
  "elimination-equivalent":
    "Replacing one equation by its sum with a multiple of the other is reversible, so it keeps the solution set of the system.",
};
