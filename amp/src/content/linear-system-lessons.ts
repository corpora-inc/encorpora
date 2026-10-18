import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const terms: [string, string][] = [
  [
    "ordered pair",
    "Two coordinates in a stated order: (x, y) gives x first and y second.",
  ],
  [
    "system",
    "Equations that must all hold for the same values of their variables.",
  ],
  ["solution", "An ordered pair that makes both original equations true."],
  [
    "coefficient",
    "The number multiplying a variable; in −3x, the coefficient of x is −3.",
  ],
];

export const linearSystemMethods: Record<string, ProblemMethod> = {
  "linear-system-pair": {
    goal: "Find the complete ordered pair that satisfies both linear equations.",
    terms: [
      ...terms,
      [
        "elimination",
        "Combine equations to remove one variable while retaining one original equation.",
      ],
    ],
    method: [
      "If an equation gives one variable directly, substitute that value or expression into the other equation.",
      "Otherwise multiply whole equations by nonzero numbers so one variable has matching or opposite coefficients. Subtract or add corresponding sides to eliminate it.",
      "Solve the resulting one-variable equation. Substitute into an original equation to recover the second coordinate.",
      "Write (x, y), with x first. Evaluate both original equations at that pair; satisfying only one is insufficient.",
    ],
    watch:
      "Scale every term on both sides. Do not discard both original equations after elimination, and do not reverse the coordinate order.",
  },
  "linear-system-solution-count": {
    goal: "Decide whether two linear equations have one, no, or infinitely many shared ordered pairs.",
    terms: [
      ...terms,
      ["contradiction", "A statement that cannot be true, such as 0 = 2."],
      [
        "identity",
        "An equality true for every permitted variable value, such as 0 = 0.",
      ],
    ],
    method: [
      "If an equation gives x or y directly, substitute into the other equation. Recover the other coordinate, or decide whether the remaining numerical equality is true or false.",
      "Otherwise align the x-terms, y-terms, and constants. Multiply an entire equation by a nonzero number if needed, then eliminate one variable.",
      "A remaining equation with a nonzero variable coefficient determines one coordinate; use an original equation to recover the other. There is exactly one shared pair.",
      "If both variables cancel and unequal constants remain, no pair satisfies both originals. A true equality means the equations describe the same line: infinitely many ordered pairs on that line, not every pair in the plane.",
    ],
    watch:
      "A negative multiple can describe the same line. Compare the constants as well as the variable coefficients, and never divide by a zero coefficient.",
  },
};

export const linearSystemPrinciples: Record<string, string> = {
  "linear-system-pair":
    "A system's solution must satisfy both original equations. Substitution replaces a quantity by an equal expression. Scaling by a nonzero number and combining equations preserves the shared solutions when one original equation is retained.",
  "linear-system-solution-count":
    "Two linear equations, each containing at least one variable with a nonzero coefficient, describe two lines. Their shared points form one intersection, no intersection, or one whole common line.",
};

const foundations = {
  title: "Equations and ordered pairs",
  paragraphs: [
    "A variable is a letter standing for a number. An expression combines numbers or variables with operations; for example, 2x + 3 means multiply x by 2, then add 3. An equation states that two expressions are equal: the quantities on the two sides of the equals sign have the same value. A solution makes that statement true when the numbers replace the variables.",
    "The coefficient of a variable is the number multiplying it. In 2x + 3y = 7, the coefficients are 2 and 3. Writing x alone means 1x; writing −x means −1x. A constant, such as 7, has no variable attached.",
    "An ordered pair (x, y) records two numbers: x first, y second. For (2, 3), use x = 2 and y = 3. The order matters: (3, 2) assigns different values to the variables.",
    "A system of equations requires the same pair to satisfy every equation at once. Checking one equation is not enough. In this lesson, x and y are real numbers: they may be positive, negative, zero, or fractional; they are not restricted to whole numbers.",
  ],
};

const coordinates = {
  title: "Why lines show the solutions",
  paragraphs: [
    "A coordinate plane locates ordered pairs using two number lines called axes. They are perpendicular: they meet at a right angle, the square corner measuring 90°. The horizontal x-axis and vertical y-axis meet at the origin, (0, 0). To locate (2, 3), move 2 units right from the origin and then 3 units up. Negative x-values lie to the left; negative y-values lie below the x-axis.",
    "A linear equation in x and y has the form ax + by = c, where a, b, and c are fixed numbers and at least one of a and b is nonzero. The variables are not squared or multiplied together. All pairs satisfying one such equation lie on one straight line, and every point on that line satisfies the equation.",
    "For example, y = x + 1 gives a y-value one greater than its x-value. Its points include (0, 1), (1, 2), and (2, 3). An intersection is a point shared by two lines. A shared point represents a pair satisfying both equations.",
  ],
};

export const linearSystemPairLesson: Lesson = {
  id: "linear-system-pair",
  title: "Solve two equations together",
  summary:
    "Find both coordinates of the pair that makes two linear equations true.",
  templateIds: ["linear-system-pair"],
  includeGeneratedRepresentation: false,
  objectives: [
    "Distinguish a solution of one equation from a solution of a system.",
    "Use substitution or elimination, recover both coordinates, and check both original equations.",
  ],
  sections: [
    {
      title: "What you will use",
      paragraphs: [
        "You will add, subtract, multiply, and divide signed numbers, and solve equations with one unknown. Multiplying numbers with unlike signs gives a negative product; multiplying two negative numbers gives a positive product. For example, 3 × (−1) = −3 and (−2) × (−1) = 2.",
        "A fraction a/b means a divided by a nonzero b. The numerator a is above the fraction bar; the denominator b is below it. When b is a positive whole number, divide one unit into b equal parts. A nonnegative whole-number numerator counts those parts. Dividing one unit into two equal parts makes halves, so 3/2 counts three halves. A minus sign gives the negative number: −3/2 means negative three halves. To add or subtract fractions, express them with the same denominator: 9/2 − 2 = 9/2 − 4/2 = 5/2.",
      ],
    },
    foundations,
    {
      title: "One equation is only one condition",
      paragraphs: [
        "Consider the system y = x + 1 and x + y = 5. The pair (2, 3) satisfies the first equation because 3 = 2 + 1. It satisfies the second because 2 + 3 = 5. Therefore, (2, 3) solves the system.",
        "The pair (1, 2) satisfies the first equation: 2 = 1 + 1. But 1 + 2 = 3, which is not 5, so it fails the second equation. A correct value for only one condition does not solve the system.",
      ],
    },
    { ...coordinates, illustration: "linear-system-intersection" },
    {
      title: "Substitution replaces equal quantities",
      paragraphs: [
        "Substitution means replacing a variable by a value or expression equal to it. In y = x + 1, the expression x + 1 is exactly the value of y. Replace y by x + 1 in the other equation x + y = 5. This gives x + (x + 1) = 5, or 2x + 1 = 5.",
        "Subtract 1 from both sides: 2x = 4. Divide both sides by 2: x = 2. Keep the original relationship y = x + 1 and substitute x = 2 into it: y = 2 + 1 = 3. The solution is the pair (2, 3), not just the value 2.",
        "This method preserves both conditions. Any shared pair must have y = x + 1, so it must satisfy the substituted equation. Conversely, a solution of the substituted equation, together with y = x + 1, satisfies both originals. The checks above verify the recovered pair directly.",
      ],
    },
    {
      title: "Elimination removes one variable",
      paragraphs: [
        "Elimination combines equations so that one variable disappears. Multiplying every term on both sides of an equation by the same nonzero number preserves its solutions: dividing by that number reverses the operation. Multiplying by zero is different; it would erase the condition.",
        "If two equalities hold for a pair, adding their left sides gives the same result as adding their right sides. Subtracting corresponding sides also preserves a true equality. Arrange matching coefficients to subtract, or opposite coefficients to add. For example, 6x − 6x = 0 removes x.",
        "Keep one original equation together with the combined equation. Their information recovers the other original equation by reversing the addition or subtraction and any nonzero scaling. Keeping only the combined equation usually loses a condition: it cannot by itself determine the whole pair.",
      ],
    },
    {
      title: "When one coordinate is already given",
      paragraphs: [
        "An equation such as x = 2 already fixes the first coordinate. If the other equation is x + y = 5, substitute 2 for x: 2 + y = 5, so y = 3. The first equation represents a vertical line: y may vary while x stays 2.",
        "Similarly, y = 1 represents a horizontal line. The system x = 2 and y = 1 has the solution (2, 1) immediately. No division by an absent variable coefficient is needed.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "Find the ordered pair (x, y) satisfying 2x + 3y = 0 and 3x + 2y = 5/2.",
    steps: [
      "Make the x-coefficients equal. Multiply every term of the first equation by 3: 6x + 9y = 0. Multiply every term of the second equation by 2: 6x + 4y = 5, since 2 × (5/2) = 5.",
      "Subtract the second scaled equation from the first: (6x + 9y) − (6x + 4y) = 0 − 5. Distribute the subtraction: 6x + 9y − 6x − 4y = −5, so 5y = −5.",
      "Divide both sides by 5: y = −1. This gives only the second coordinate; retain an original equation to find x.",
      "Substitute y = −1 into 2x + 3y = 0: 2x + 3(−1) = 0, so 2x − 3 = 0. Add 3 to both sides: 2x = 3. Divide both sides by 2: x = 3/2.",
      "Write x first and y second: (3/2, −1). Check the first original equation: 2 × (3/2) + 3(−1) = 3 − 3 = 0.",
      "Check the second original equation: 3 × (3/2) + 2(−1) = 9/2 − 2 = 9/2 − 4/2 = 5/2. Both originals are true, so this pair solves the system.",
    ],
    answer: "(3/2, −1)",
  },
  pitfalls: [
    "Check both equations with the same pair; do not use a different pair for each equation.",
    "Multiply an entire equation, including its constant side. When subtracting, subtract every term of the second row.",
    "An ordered-pair answer gives x first. A system can have a fractional coordinate even when every variable coefficient is an integer.",
  ],
  parentGuide:
    "For y = x + 1 and x + y = 5, ask the learner to compare (1, 2), (2, 3), and (3, 2). Have them evaluate both equations for each pair and explain which condition rejects each near-miss.",
};

export const linearSystemCountLesson: Lesson = {
  id: "linear-system-solution-count",
  title: "Count the solutions of two linear equations",
  summary:
    "Determine whether two lines share one ordered pair, no pairs, or infinitely many pairs.",
  templateIds: ["linear-system-solution-count"],
  includeGeneratedRepresentation: false,
  objectives: [
    "Connect elimination results to intersecting, parallel, and coincident lines.",
    "Distinguish infinitely many shared pairs on one line from every pair in the coordinate plane.",
  ],
  sections: [
    {
      title: "What you will use",
      paragraphs: [
        "You will substitute numbers into expressions, multiply signed numbers, and solve one-variable equations. Multiplication by a negative number changes every term's sign: −2(x + y) = −2x − 2y. A negative times a negative is positive: (−2)(−3) = 6.",
        "A fraction a/b means a divided by a nonzero b. The numerator a is above the fraction bar; the denominator b is below it. When b is a positive whole number, divide one unit into b equal parts. A nonnegative whole-number numerator counts those parts. Dividing one unit into two equal parts makes halves, so 3/2 counts three halves. A minus sign gives the negative number: −3/2 means negative three halves.",
      ],
    },
    foundations,
    coordinates,
    {
      title: "Combine equations without losing a condition",
      paragraphs: [
        "Elimination combines equations to remove a variable. Multiplying an entire equation by a nonzero number preserves its solutions because division reverses that multiplication. Adding or subtracting corresponding sides of two true equalities gives another true equality.",
        "Keep one original equation along with the combined equation. That retained condition lets you reverse the combination and recover the other original. A combined equation alone may have more solutions than the system.",
        "For these systems, each original equation contains at least one variable with a nonzero coefficient and therefore represents a line. The following three outcomes describe how two such lines can share points.",
      ],
    },
    {
      title: "Exactly one ordered pair",
      paragraphs: [
        "Consider x + y = 4 and x − y = 0. Add corresponding sides: (x + y) + (x − y) = 4 + 0. The y-terms cancel, leaving 2x = 4, so x = 2.",
        "Use x + y = 4 to recover y: 2 + y = 4, so y = 2. Check both originals: 2 + 2 = 4 and 2 − 2 = 0. Each coordinate is fixed, so there is exactly one solution, (2, 2). Geometrically, the two lines intersect at one point.",
      ],
    },
    {
      title: "No ordered pairs",
      paragraphs: [
        "Consider x + y = 2 and x + y = 4. Subtract the first equation from the second: (x + y) − (x + y) = 4 − 2. The result is 0 = 2.",
        "A contradiction is a statement that cannot be true. No choices of x and y can make 0 equal 2, so no pair satisfies both originals. Their lines are parallel: they extend in the same direction and never meet. A drawing shows only a finite window; the algebra proves they do not meet anywhere.",
      ],
    },
    {
      title: "Infinitely many ordered pairs",
      paragraphs: [
        "Consider x + y = 3 and −2x − 2y = −6. Multiplying every term of the first equation by −2 gives the second equation exactly. The equations are proportional, meaning one entire equation is a nonzero multiple of the other, including the constant side. A negative multiplier does not change the set of solutions.",
        "Add the second equation to twice the first: (−2x − 2y) + (2x + 2y) = −6 + 6. The result is 0 = 0, an identity: an equality that is true for every permitted variable value. In this system, it shows that the second equation adds no restriction beyond the first.",
        "The lines are coincident: they occupy exactly the same points. There is one common line, not infinitely many separate lines. Choose any real x and set y = 3 − x; each choice gives a pair on that line. For example, (0, 3), (1, 2), and (3, 0) all satisfy both equations.",
        "There are infinitely many such pairs, but not every pair in the plane works. The pair (0, 0) fails x + y = 3 because 0 + 0 is not 3. Retaining an original equation is essential even when elimination gives 0 = 0.",
      ],
      illustration: "linear-system-count",
    },
    {
      title: "Vertical and horizontal cases",
      paragraphs: [
        "The system x = 2 and y = 1 fixes both coordinates, so its one solution is (2, 1). The system x = 2 and x = 5 has no solution: the first coordinate cannot equal two different numbers at once.",
        "The equations x = 2 and −3x = −6 describe the same vertical line. Every pair with x = 2 works, and y may be any real number. Likewise, y = −1 and −4y = 4 describe the same horizontal line, with x free to vary. Read these fixed-coordinate conditions directly rather than dividing by a zero coefficient.",
      ],
    },
  ],
  workedExample: {
    prompt:
      "How many ordered pairs (x, y) satisfy x + 2y = 3 and −2x − 4y = −6?",
    steps: [
      "Multiply every term of x + 2y = 3 by 2: 2x + 4y = 6.",
      "Add this equation to −2x − 4y = −6: (2x + 4y) + (−2x − 4y) = 6 + (−6). Both variables cancel, giving 0 = 0.",
      "Retain x + 2y = 3. The second equation is −2 times this entire equation, so it adds no restriction: both describe one common line.",
      "Choose any real y and set x = 3 − 2y. For y = 0, 1, and 2, the pairs are (3, 0), (1, 1), and (−1, 2). Infinitely many choices of y give infinitely many shared pairs.",
      "Check (1, 1) in both originals: 1 + 2 × 1 = 3 and −2 × 1 − 4 × 1 = −6. The pair (0, 0) fails both. Only pairs on the common line work, not all pairs in the plane.",
    ],
    answer: "Infinitely many ordered pairs",
  },
  pitfalls: [
    "Compare constants as well as variable coefficients; matching variable terms with unequal constants give no solution.",
    "Retain an original line's condition even when elimination gives 0 = 0. Negative scaling preserves that line; zero scaling erases it.",
  ],
  parentGuide:
    "Pair x + y = 3 first with −2x − 2y = −6, then with −2x − 2y = −8. Use elimination to explain why the first system has infinitely many shared pairs and the second has none.",
};

export const linearSystemLessons = [
  linearSystemPairLesson,
  linearSystemCountLesson,
];
