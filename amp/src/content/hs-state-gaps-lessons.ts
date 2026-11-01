import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const hsStateGapMethods: Record<string, ProblemMethod> = {
  "gauss-3x3-solve": {
    goal: "Combine three equations in $x$, $y$ and $z$ to find the solution, choose a step that cancels a letter, or count the solutions.",
    intuition:
      "A system is a set of equations that must all be true at once. Its solution is an ordered triple $(x, y, z)$ that makes every equation true. If two equations are true, adding them side to side gives another true equation. Multiply one by a number other than 0 first so a letter cancels: its coefficients, the numbers in front of it, add to zero.",
    senses: { term: "term-expression", side: "side-of-equation" },
    noLink: [
      "multiple",
      "multiples",
      "leaves",
      "combination",
      "third",
      "degree",
    ],
    terms: ["elimination", "row-operation", "back-substitution"],
    method: [
      "Use one equation to cancel $x$ from the other two. Compare the $x$ coefficients to choose the multiplier, such as 2 for $2x$ and $x$.",
      "Use one of the two new equations to cancel $y$ from the other. The last equation has only $z$.",
      "Solve for $z$, then put it back to find $y$, then $x$. Check all three original equations.",
      "If a row becomes $0=0$, there are infinitely many solutions. If it becomes $0=c$ with $c$ not 0, there is no solution.",
    ],
    watch:
      "Do each step to the number on the right too, not only to the letters. When a row cancels completely, its right-hand number decides: 0 means infinitely many, anything else means none.",
  },
  "quadratic-inequality-interval": {
    goal: "Solve an inequality with an $x^2$ part by finding where it equals 0, then write the answer with brackets (interval notation).",
    intuition:
      "In $x^2 - x - 6 < 0$, $x^2$ means $x$ times $x$ and $<$ means “is less than.” The graph of the left side is a U-shaped curve called a parabola. The zeros are the $x$-values where it equals 0, where the curve meets the $x$-axis. The sign can only change at a zero. So between and beyond the zeros the sign stays the same.",
    senses: { term: "term-expression", side: "side-of-equation" },
    noLink: [
      "factor",
      "opposite",
      "changes",
      "square",
      "part",
      "parts",
      "change",
    ],
    terms: ["zero-of-a-function", "interval-notation"],
    method: [
      "Move every term to one side so the other side is 0. Find the zeros by factoring or the quadratic formula.",
      "Look at the number multiplying $x^2$, the leading coefficient. Positive: the curve opens up, so it is negative between the zeros. Negative: this reverses.",
      "Keep the parts that fit the inequality. Include the zeros, with square brackets, for $\\le$ or $\\ge$. Leave them out, with round brackets, for $<$ or $>$.",
      "With no real zeros, the curve stays on one side of the axis, so the answer is all real numbers or none. With one repeated zero, only that point differs.",
    ],
    watch:
      "Test one value from your answer in the original inequality. A negative leading coefficient flips which part is positive. Zeros belong only when the sign includes “or equal to.”",
  },
  "conditional-statements": {
    goal: "Build or compare an if-then statement's converse, inverse and contrapositive, or decide if a statement with and, or, not is true.",
    intuition:
      "A conditional is an if-then statement, “if $P$, then $Q$,” where $P$ and $Q$ are statements that are true or false. $P$ is the hypothesis and $Q$ the conclusion. It promises that whenever $P$ is true, $Q$ is true. It is false only when $P$ is true and $Q$ is false. The converse swaps the parts, the inverse adds “not” to both, and the contrapositive does both.",
    senses: {
      inverse: "inverse-statement",
      square: "square-shape",
      side: "side",
      multiple: "multiple",
    },
    noLink: ["parts", "part", "opposite"],
    terms: ["converse", "inverse-statement", "contrapositive", "biconditional"],
    method: [
      "In “if $P$, then $Q$,” name the hypothesis $P$ (after “if”) and the conclusion $Q$ (after “then”).",
      "Build the form asked for. Converse: swap. Inverse: add “not” to both. Contrapositive: do both.",
      "A statement and its contrapositive are always both true or both false. The converse and inverse match each other, but may differ from the original.",
      "For “and,” “or” and “not,” work out the smallest parts first. The opposite of “if $P$, then $Q$” is “$P$ and not $Q$.”",
    ],
    watch:
      "A true conditional can have a false converse. To show a converse false, find one case where its hypothesis is true and its conclusion is false.",
  },
  "cube-root-equation": {
    goal: "Solve equations with a cube root or a cube over the real numbers, and explain why cube roots create no extraneous solutions.",
    intuition:
      "Cubing undoes a cube root, just as a cube root undoes cubing. Unlike squaring, cubing keeps the sign: negative numbers have negative cubes, and each real number has exactly one real cube root.",
    terms: ["cube-root", "extraneous-solution"],
    method: [
      "Isolate the cube root, or isolate $x^3$, on one side.",
      "Cube both sides, or take the cube root of both sides.",
      "Solve the remaining equation for $x$.",
      "Substitute to check. A cube root can equal a negative number, and cubing both sides never adds false solutions.",
    ],
    watch:
      "Do not reject a negative right side, and do not write plus-or-minus for an odd power. $x^3=8$ has one real solution, while $x^2=4$ has two.",
  },
  "polar-graph-identify": {
    goal: "Identify a polar curve from its equation, then use the equation to count petals, find the greatest distance, or name its symmetry.",
    intuition:
      "In polar coordinates a point is a distance $r$ from the pole at an angle $\\theta$. An equation tells how far to go in each direction, so its form reveals the shape: a constant $r$ gives a circle, a trigonometric multiple of $\\theta$ gives a rose, and a constant plus a trigonometric term gives a limaçon.",
    terms: [
      [
        "polar-coordinates",
        "The pole is the center point of the polar grid, like the origin.",
      ],
      "rose-curve",
      "limacon",
    ],
    method: [
      "Match the form of the equation to a family: $r=a$, $r=a\\cos\\theta$, $\\theta=\\alpha$, rose, or limaçon.",
      "For the greatest distance, use that sine and cosine range from $-1$ to $1$ and find the largest $|r|$.",
      "For symmetry, replace $\\theta$ by $-\\theta$ for the polar axis, or by $\\pi-\\theta$ for the line $\\theta=\\frac{\\pi}{2}$. If the equation is unchanged, the graph has that symmetry.",
    ],
    watch:
      "The coefficient of the trigonometric function sets the size, and the multiplier of $\\theta$ sets the petal count. Do not mix them up, and use distance $|r|$, not $r$.",
  },
  "cone-section-name": {
    goal: "Use the angle between a cutting plane and the axis of a double cone to name the conic or degenerate section.",
    intuition:
      "Slicing a double cone with a plane gives different curves depending on how steeply the plane tilts. A level cut gives a circle. Tilting makes an oval. Tilting until the plane is parallel to a side of the cone gives an open curve, and tilting more cuts both halves.",
    terms: [
      "double-cone",
      [
        "vertex",
        "In a double cone, it is the single point where the two cones meet.",
      ],
    ],
    method: [
      "Find the side angle $\\alpha$ between a side line of the cone and the axis, and the plane's angle $\\beta$ with the axis.",
      "If the plane misses the vertex: $\\beta=90^\\circ$ gives a circle, $\\alpha<\\beta<90^\\circ$ an ellipse, $\\beta=\\alpha$ a parabola, $\\beta<\\alpha$ a hyperbola.",
      "If the plane passes through the vertex, the section collapses: $\\beta>\\alpha$ gives a point, $\\beta=\\alpha$ one line, $\\beta<\\alpha$ two intersecting lines.",
    ],
    watch:
      "Check whether the plane passes through the vertex. The same angle gives an ellipse, parabola or hyperbola away from the vertex but a point, line or pair of lines through it.",
  },
};

export const hsStateGapPrinciples: Record<string, string> = {
  "gauss-3x3-solve":
    "Replacing an equation by itself plus a multiple of another equation gives an equivalent system, one with the same solutions. A system of linear equations has no solution, exactly one, or infinitely many. Three equations in $x$, $y$ and $z$ have exactly one solution when elimination leaves one equation for each letter, each with a nonzero coefficient on its leading letter.",
  "quadratic-inequality-interval":
    "For real numbers $a$, $b$, $c$ with $a\\ne0$, the expression $ax^2+bx+c$ has the same sign as $a$ outside its real zeros and the opposite sign between them. With no real zeros it has the sign of $a$ everywhere. With one repeated zero it has the sign of $a$ everywhere except at that zero, where it is 0.",
  "conditional-statements":
    "Write $P\\to Q$ for “if $P$, then $Q$” and $\\neg P$ for “not $P$.” $P\\to Q$ is equivalent to its contrapositive $\\neg Q\\to\\neg P$, and the converse $Q\\to P$ is equivalent to the inverse $\\neg P\\to\\neg Q$. The negation of $P\\to Q$ is $P\\land\\neg Q$ (“$P$ and not $Q$”). The biconditional $P\\leftrightarrow Q$ means both $P\\to Q$ and $Q\\to P$.",
  "cube-root-equation":
    "The function $x\\mapsto x^3$ is one-to-one on the real numbers, so $u^3=v^3$ exactly when $u=v$. Every real number has exactly one real cube root, and cubing both sides of an equation is reversible.",
  "polar-graph-identify":
    "A rose $r=a\\cos(n\\theta)$ or $r=a\\sin(n\\theta)$ has $n$ petals if $n$ is odd and $2n$ if $n$ is even. The limaçon $r=a+b\\cos\\theta$ is symmetric about the polar axis; with $\\sin\\theta$ it is symmetric about the line $\\theta=\\frac{\\pi}{2}$.",
  "cone-section-name":
    "For a right circular double cone whose side lines make angle $\\alpha$ with the axis, a plane making angle $\\beta$ with the axis and missing the vertex gives a circle for $\\beta=90^\\circ$, an ellipse for $\\alpha<\\beta<90^\\circ$, a parabola for $\\beta=\\alpha$ and a hyperbola for $\\beta<\\alpha$.",
};

export const hsStateGapLessons: Lesson[] = [
  {
    id: "gauss-3x3-solve",
    title: "Solve a three-variable system by elimination",
    summary:
      "A system is a group of equations that must all be true at once. Here there are three unknown numbers, $x$, $y$ and $z$, and three equations. Combine two equations so one letter cancels, which means it adds to zero. Do that until one equation has a single letter. Solve it, then put that value back to find the other two.",
    senses: { term: "term-expression", side: "side-of-equation" },
    noLink: [
      "multiple",
      "multiples",
      "leaves",
      "combination",
      "third",
      "degree",
      "rules",
      "whole",
    ],
    templateIds: ["gauss-3x3-solve"],
    objectives: [
      "Choose a step that cancels a letter: add or subtract a multiplied copy of one equation from another.",
      "Solve three equations in $x$, $y$ and $z$ by cancelling letters, then working back up.",
      "Tell from the equations whether there is one solution, no solution, or infinitely many.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three equations, three unknowns",
        paragraphs: [
          "An equation says two amounts are equal, like $x + y + z = 6$. The letters $x$, $y$ and $z$ stand for unknown numbers. Writing $2x$ means 2 times $x$. The number in front of a letter is called its coefficient, so in $2x - y$ the coefficient of $y$ is $-1$.",
          "A system is a set of equations that must all be true at the same time. A solution is a set of values, one for each letter, that makes every equation true. We write it as an ordered triple $(x, y, z)$: the value of $x$, then $y$, then $z$.",
          "One equation with three letters has many answers. For $x + y + z = 6$, both $(1, 2, 3)$ and $(6, 0, 0)$ work. Each new equation rules out more answers. Three equations that each add new information can leave exactly one answer.",
          "The main tool is this. If two equations are both true, you can add them, side to side, and the result is still true. You can also multiply every number in an equation by the same number other than 0 first. Choose the numbers so that one letter cancels. Its coefficients add to zero, so that letter disappears.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $x+y+z=6$, $2x-y+z=3$, $x+2y-z=2$.",
      steps: [
        "Number the equations 1, 2 and 3 from the top. Remove $x$ from equation 2. Equation 2 has $2x$ and equation 1 has $x$, so subtract 2 times equation 1. The $2x$ and $-2x$ cancel. The left sides give $-3y - z$ and the right sides give $3 - 12 = -9$. So $-3y - z = -9$.",
        "Remove $x$ from equation 3. Both have $x$ with coefficient 1, so subtract equation 1 from equation 3. That gives $y - 2z = 2 - 6 = -4$.",
        "Now there are two equations with only $y$ and $z$. Remove $y$: add 3 times $y - 2z = -4$ to $-3y - z = -9$. The $3y$ and $-3y$ cancel, leaving $-7z = -21$. Divide both sides by $-7$: $z = 3$.",
        "Work back up. Put $z = 3$ into $y - 2z = -4$: $y - 6 = -4$, so $y = 2$. Put both into equation 1: $x + 2 + 3 = 6$, so $x = 1$.",
        "Check all three original equations: $1 + 2 + 3 = 6$, $2 - 2 + 3 = 3$ and $1 + 4 - 3 = 2$. All are true, so the solution is $(1, 2, 3)$.",
      ],
      answer: "(1, 2, 3)",
    },
    closingSections: [
      {
        stage: "method",
        title: "Cancel one letter at a time",
        paragraphs: [
          "Use one equation to remove $x$ from the other two. That leaves two equations in $y$ and $z$. Use one of them to remove $y$ from the other. The last equation has only $z$. Solve it, then put the value back into the earlier equations. This working back up is called back-substitution.",
          "To pick the multiplier, compare the $x$ coefficients. If one equation has $2x$ and the other has $x$, subtract 2 times the second from the first. Then $2x - 2x = 0$.",
          "Whatever you do, do it to the whole equation: every term on the left and the number on the right. A term is one piece joined by + or −, such as $2x$ or $-y$.",
          "Each step is called a row operation, because each equation is a row. Problems write $R_2$ for equation 2. The step $R_2 \\to R_2 - 2R_1$ means “replace equation 2 by equation 2 minus 2 times equation 1.”",
        ],
      },
      {
        stage: "method",
        title: "When there is not exactly one solution",
        paragraphs: [
          "Sometimes every letter cancels. If you get $0 = 0$, that equation added no new information, so there are infinitely many solutions.",
          "If you get something false, like $0 = 5$, the equations disagree. No values make them all true, so there is no solution.",
        ],
      },
      {
        stage: "formal",
        title: "Why the steps keep the solutions",
        paragraphs: [
          "Replacing an equation by itself plus a multiple of another gives an equivalent system, one with exactly the same solutions. The step can be undone by subtracting that multiple back.",
          "A system of linear equations (equations whose letters are only multiplied by numbers, never by each other) has no solution, exactly one, or infinitely many.",
          "If elimination gives a row $0 = c$ where $c$ is a number other than 0 (written $c \\ne 0$), there is no solution. If it gives $0 = 0$ and fewer than three equations that add new information remain, there are infinitely many.",
        ],
      },
    ],
    pitfalls: [
      "Apply each step to both sides. Multiply and subtract the number on the right, not only the letters on the left.",
      "When a whole row cancels, look at the number on the right. $0 = 0$ means infinitely many solutions, and $0 = 5$ means none.",
      "Check the answer in all three original equations, not just one.",
    ],
    parentGuide:
      "Before each step, ask which letter is being removed and which multiple of which equation is used. After the answer, ask to check it in all three equations.",
  },
  {
    id: "quadratic-inequality-interval",
    title: "Solve a quadratic inequality",
    summary:
      "An inequality compares two amounts with a sign like $<$ (“is less than”) instead of $=$. In $x^2 - x - 6 < 0$, $x^2$ ($x$ squared) means $x$ times $x$. We want every $x$ that makes the left side negative. First find where it equals 0: at $x = -2$ and $x = 3$. Between and outside those two numbers, its sign cannot change. Test one number in each part to see which parts work.",
    senses: {
      term: "term-expression",
      side: "side-of-equation",
      product: "product-multiply",
    },
    noLink: [
      "factor",
      "opposite",
      "changes",
      "square",
      "squared",
      "change",
      "part",
      "parts",
      "mean",
    ],
    templateIds: ["quadratic-inequality-interval"],
    objectives: [
      "Find the zeros of a quadratic, the $x$-values where it equals 0, and use the sign of its leading coefficient.",
      "Write the solution in interval notation, with the right kind of bracket at each end.",
      "Handle a quadratic with no real zeros or with one repeated zero.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the sign from the graph",
        paragraphs: [
          "A quadratic expression has an $x^2$ part and no higher power, like $x^2 - x - 6$. The number multiplying $x^2$ is called the leading coefficient. Here it is 1.",
          "The signs $<$ and $>$ mean “is less than” and “is greater than.” The signs $\\le$ and $\\ge$ mean “is less than or equal to” and “is greater than or equal to.” Such a statement is called an inequality.",
          "The graph of $y = x^2 - x - 6$ is a U-shaped curve called a parabola. Where the curve is below the $x$-axis, the expression is negative. Where it is above, the expression is positive.",
          "The zeros are the $x$-values where the expression equals 0. That is where the curve meets the $x$-axis. The curve can only switch from above to below by passing through a zero. So between two zeros, and on each side beyond them, the sign stays the same.",
          "A positive leading coefficient makes the curve open upward, like a cup. Then the curve is below the axis between the zeros and above it outside them. A negative leading coefficient flips the curve upside down, so the pattern reverses.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $x^2-x-6<0$.",
      steps: [
        "Find the zeros by factoring, which means writing it as a product. Two numbers that multiply to $-6$ and add to $-1$ are $-3$ and $2$. So $x^2 - x - 6 = (x - 3)(x + 2)$. A product is 0 only when one part is 0, so the zeros are $3$ and $-2$.",
        "The leading coefficient is 1, which is positive. So the parabola opens upward. It is below the axis, and the expression is negative, between $-2$ and $3$.",
        "Check with a test value between the zeros. Try $x = 0$: $0 - 0 - 6 = -6$, and $-6 < 0$ is true.",
        "The sign is $<$, not $\\le$, so the zeros themselves do not count. At $x = 3$ the expression equals 0, and 0 is not less than 0. In interval notation the answer is $(-2, 3)$: all numbers between $-2$ and $3$, ends left out.",
      ],
      answer: "(-2, 3)",
    },
    closingSections: [
      {
        stage: "method",
        title: "Zeros, sign, then test",
        paragraphs: [
          "Move every term to one side so the other side is 0. A term is one piece joined by + or −, such as $-x$. Then find the zeros, by factoring or by the quadratic formula.",
          "Mark the zeros on a number line. They split it into parts. In each part, the expression keeps one sign. Test one value from each part in the original inequality, and keep the parts where it is true.",
          "Interval notation writes a stretch of the number line by its two ends. A round bracket ( or ) means that end is left out. A square bracket [ or ] means it is included. Use square brackets at the zeros for $\\le$ and $\\ge$. Use round ones for $<$ and $>$.",
          "Two separate parts are joined with the symbol $\\cup$, read “or.” For example, $(-\\infty, -2) \\cup (3, \\infty)$ means less than $-2$, or greater than $3$. The symbol $\\infty$ (infinity) means the part goes on forever.",
        ],
      },
      {
        stage: "method",
        title: "No zeros or one repeated zero",
        paragraphs: [
          "If the curve never meets the axis, there are no real zeros. Then it is above the axis everywhere, or below it everywhere. So the answer is all real numbers or no numbers at all.",
          "If the curve only touches the axis at one point, that zero repeats, as in $(x - 1)^2$. The sign is the same on both sides of that point. Only the point itself is different, where the value is 0.",
        ],
      },
      {
        stage: "formal",
        title: "Sign of a quadratic",
        paragraphs: [
          "Let $a$, $b$ and $c$ be real numbers with $a \\ne 0$ ($a$ is not 0). If $ax^2 + bx + c$ has real zeros $p < q$, it equals $a(x - p)(x - q)$.",
          "It has the same sign as $a$ when $x < p$ or $x > q$. It has the opposite sign when $p < x < q$.",
          "If $b^2 - 4ac < 0$, there are no real zeros, and the expression has the sign of $a$ for every real $x$. With one repeated zero, it has the sign of $a$ everywhere except at that zero, where it is 0.",
        ],
      },
    ],
    pitfalls: [
      "A negative leading coefficient turns the curve upside down, so the expression is positive between the zeros and negative outside.",
      "Strict signs, $<$ and $>$, leave the zeros out: use round brackets. The signs $\\le$ and $\\ge$ include them: use square brackets.",
      "Move everything to one side first. Find zeros of the expression compared with 0, not with another number.",
    ],
    parentGuide:
      "Ask the learner to sketch the cup-shaped graph, mark the zeros and shade where the curve is above or below the axis. Then ask for one test value that checks the answer.",
  },
  {
    id: "conditional-statements",
    title: "Conditionals, converses and truth values",
    summary:
      "An if-then sentence, like “If it is raining, then the ground is wet,” is called a conditional. Turning its parts around, or adding “not” to them, makes new sentences. Some of these mean the same as the original, and some do not. Only the one that swaps the parts and adds “not” to both, the contrapositive, is always true exactly when the original is.",
    senses: {
      inverse: "inverse-statement",
      square: "square-shape",
      side: "side",
      multiple: "multiple",
    },
    noLink: ["parts", "part", "mean", "opposite"],
    templateIds: ["conditional-statements"],
    objectives: [
      "Write the converse, inverse and contrapositive of an if-then statement.",
      "Tell which of these always has the same truth value (true or false) as the original.",
      "Decide whether a statement built with “and,” “or” and “not” is true from the truth of its parts.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A conditional and its related statements",
        paragraphs: [
          "A statement is a sentence that is either true or false. Whether it is true or false is called its truth value.",
          "A conditional is an if-then statement: “if $P$, then $Q$.” The letters $P$ and $Q$ stand for statements. The part after “if” is the hypothesis. The part after “then” is the conclusion. In “If a shape is a square, then it has four sides,” the hypothesis is “a shape is a square.” The conclusion is “it has four sides.”",
          "A conditional is a promise: whenever $P$ is true, $Q$ is true too. It is broken, and so false, only when $P$ is true and $Q$ is false.",
          "Three related statements come from rearranging it. The converse swaps the parts: “if $Q$, then $P$.” The inverse adds “not” to both parts: “if not $P$, then not $Q$.” The contrapositive does both: “if not $Q$, then not $P$.” Adding “not” is called negating.",
          "Try them on the square example. The original is true. The converse, “If a shape has four sides, then it is a square,” is false: a long thin rectangle has four sides. The contrapositive, “If a shape does not have four sides, then it is not a square,” is true, like the original.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For “If a triangle is equilateral, then it is isosceles”, which statement is the contrapositive?",
      steps: [
        "Find the parts. An equilateral triangle has all three sides equal. An isosceles triangle has at least two equal sides. The hypothesis is “a triangle is equilateral.” The conclusion is “it is isosceles.”",
        "The contrapositive swaps the parts and negates both. Put the negated conclusion first and the negated hypothesis second: “If a triangle is not isosceles, then it is not equilateral.”",
        "Check that it makes sense. Not isosceles means no two sides are equal. Then the three sides cannot all be equal, so it is not equilateral. It is true, just like the original.",
      ],
      answer: "If a triangle is not isosceles, then it is not equilateral.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Swap, negate, or both",
        paragraphs: [
          "Start from “if $P$, then $Q$.” Swap the parts to get the converse, “if $Q$, then $P$.” Negate both to get the inverse, “if not $P$, then not $Q$.” Do both to get the contrapositive, “if not $Q$, then not $P$.”",
          "The contrapositive always has the same truth value as the original. The converse and the inverse always match each other. They may or may not match the original.",
          "To show a statement is false, one counterexample is enough. A counterexample is a single case where the hypothesis is true and the conclusion is false.",
        ],
      },
      {
        stage: "method",
        title: "And, or, not",
        paragraphs: [
          "“$P$ and $Q$” is true only when both are true. “$P$ or $Q$” is true when at least one is true. “Not $P$” has the opposite truth value of $P$.",
          "Work out the smallest parts first, then combine them. The opposite of “if $P$, then $Q$” is “$P$ and not $Q$”: the promise is broken exactly when $P$ happens and $Q$ does not.",
        ],
      },
      {
        stage: "formal",
        title: "Logical equivalence",
        paragraphs: [
          "Two statements are logically equivalent when they have the same truth value in every case.",
          "Logic uses short symbols. The arrow $P \\to Q$ means “if $P$, then $Q$.” The sign $\\neg P$ means “not $P$.” The sign $\\land$ means “and,” and $\\lor$ means “or.”",
          "$P \\to Q$ is false only when $P$ is true and $Q$ is false. So it is equivalent to its contrapositive $\\neg Q \\to \\neg P$, and to $\\neg P \\lor Q$.",
          "A biconditional, $P \\leftrightarrow Q$, read “$P$ if and only if $Q$,” is true exactly when $P$ and $Q$ have the same truth value. It says both $P \\to Q$ and $Q \\to P$.",
        ],
      },
    ],
    pitfalls: [
      "A true statement can have a false converse. Every equilateral triangle is isosceles, but an isosceles triangle need not be equilateral.",
      "A conditional is false only when the hypothesis is true and the conclusion is false. In every other case it is true.",
      "The contrapositive both swaps and negates. Doing only one of the two gives the converse or the inverse.",
    ],
    parentGuide:
      "Say a true if-then sentence from daily life, such as “If it is a dog, then it is an animal.” Ask the learner for its converse and a counterexample that shows the converse is false.",
  },
  {
    id: "cube-root-equation",
    title: "Solve equations with cube roots",
    summary:
      "Isolate the cube root and cube both sides. Unlike square roots, cube roots never produce extraneous solutions.",
    templateIds: ["cube-root-equation"],
    objectives: [
      "Solve equations containing a cube root or a cube.",
      "Work with negative values.",
      "Explain why cubing creates no extraneous solutions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A root that keeps the sign",
        paragraphs: [
          "You need to solve equations with square roots, where squaring can add false solutions. A cube root $\\sqrt[3]{a}$ is the number whose cube is $a$. Because $(-2)^3=-8$, the cube root of $-8$ is $-2$, and every real number has exactly one real cube root.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $\\sqrt[3]{2x+3}-1=-4$.",
      steps: [
        "Isolate the cube root: $\\sqrt[3]{2x+3}=-3$.",
        "Cube both sides: $2x+3=-27$.",
        "Solve: $2x=-30$, so $x=-15$.",
        "Check: $\\sqrt[3]{-27}-1=-3-1=-4$.",
      ],
      answer: "x = -15",
    },
    closingSections: [
      {
        stage: "method",
        title: "Isolate, cube, solve",
        paragraphs: [
          "Get the cube root alone on one side, then cube both sides. Solve the resulting equation and check in the original. For $ax^3+b=c$, isolate $x^3$ and take the cube root of both sides: there is exactly one real value.",
          "Square-root equations can have extraneous solutions because squaring loses the sign. Cubing does not: each real number has one cube, and each cube has one real cube root.",
        ],
      },
      {
        stage: "formal",
        title: "Cube roots over the reals",
        paragraphs: [
          "For every real $a$ there is exactly one real number $y$ with $y^3=a$, written $\\sqrt[3]{a}$. The function $y\\mapsto y^3$ is increasing, so $u^3=v^3$ exactly when $u=v$. Therefore $\\sqrt[3]{f(x)}=c$ is equivalent to $f(x)=c^3$ for every real $c$, including negative $c$.",
        ],
      },
    ],
    pitfalls: [
      "A cube root can equal a negative number.",
      "An odd power gives one real solution, not plus-or-minus.",
    ],
    parentGuide:
      "Ask why a negative number can have a real cube root but not a real square root.",
  },
  {
    id: "polar-graph-identify",
    title: "Identify polar graphs from equations",
    summary:
      "The form of a polar equation tells the shape: circle, line, rose or limaçon. The numbers give petals, size and symmetry.",
    templateIds: ["polar-graph-identify"],
    objectives: [
      "Name a polar curve from its equation.",
      "Count petals and find the greatest distance from the pole.",
      "Use the equation to identify symmetry.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Distance as a function of angle",
        paragraphs: [
          "You need to locate polar points $(r,\\theta)$. A polar equation gives the distance $r$ for each angle $\\theta$. If $r$ is constant the curve is a circle about the pole. If $r$ varies with the angle, the curve bends toward or away from the pole as $\\theta$ turns.",
        ],
      },
    ],
    workedExample: {
      prompt: "How many petals does $r=4\\sin(3\\theta)$ have?",
      steps: [
        "The equation has the form $r=a\\sin(n\\theta)$ with $n=3$, so it is a rose.",
        "For odd $n$, a rose has $n$ petals.",
        "The coefficient 4 is the length of each petal.",
      ],
      answer: "3 petals",
    },
    closingSections: [
      {
        stage: "method",
        title: "Read the form of the equation",
        paragraphs: [
          "Constant $r=a$ is a circle about the pole. $r=a\\cos\\theta$ or $r=a\\sin\\theta$ is a circle through the pole. $\\theta=\\alpha$ is a line through the pole. $r=a\\cos(n\\theta)$ or $r=a\\sin(n\\theta)$ with $n\\ge2$ is a rose. $r=a+b\\cos\\theta$ or $r=a+b\\sin\\theta$ is a limaçon: a cardioid when $a=b$, with an inner loop when $a<b$.",
          "Sine and cosine stay between $-1$ and $1$, so $r=a+b\\cos\\theta$ ranges from $a-b$ to $a+b$, and the greatest distance from the pole is the largest $|r|$.",
        ],
      },
      {
        stage: "formal",
        title: "Petals and symmetry",
        paragraphs: [
          "A rose $r=a\\cos(n\\theta)$ or $r=a\\sin(n\\theta)$ has $n$ petals if $n$ is odd and $2n$ if $n$ is even, each of length $|a|$. If replacing $\\theta$ by $-\\theta$ leaves the equation unchanged, the graph is symmetric about the polar axis. If replacing $\\theta$ by $\\pi-\\theta$ leaves it unchanged, the graph is symmetric about the line $\\theta=\\frac{\\pi}{2}$.",
        ],
      },
    ],
    pitfalls: [
      "Even $n$ gives $2n$ petals, odd $n$ gives $n$.",
      "Greatest distance is the largest $|r|$.",
    ],
    parentGuide:
      "Ask the learner to say what changes in the graph when the coefficient changes and when the multiplier changes.",
  },
  {
    id: "cone-section-name",
    title: "Name a conic section cut from a cone",
    summary:
      "Compare the cutting plane's angle with the side angle of the cone to name the circle, ellipse, parabola or hyperbola.",
    templateIds: ["cone-section-name"],
    objectives: [
      "Name the conic from the plane's angle with the axis.",
      "Describe how tilting the plane changes the curve.",
      "Identify degenerate sections through the vertex.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Slicing a double cone",
        paragraphs: [
          "A double cone is two cones tip to tip, sharing an axis. Every cut by a plane is called a conic section. The curve depends on the plane's angle $\\beta$ with the axis compared with the angle $\\alpha$ between the cone's side and the axis. A steeper plane gives a more open curve.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A double cone has side angle 40°. A plane missing the vertex makes a 25° angle with the axis. What curve results?",
      steps: [
        "The side angle is $\\alpha=40^\\circ$ and the plane's angle is $\\beta=25^\\circ$.",
        "Since $\\beta<\\alpha$, the plane is steeper than the sides and cuts both nappes.",
        "A plane cutting both nappes and missing the vertex gives a hyperbola.",
      ],
      answer: "A hyperbola",
    },
    closingSections: [
      {
        stage: "method",
        title: "Compare two angles",
        paragraphs: [
          "Let $\\alpha$ be the angle between a side line of the cone and its axis, and $\\beta$ the angle between the plane and the axis. Away from the vertex: $\\beta=90^\\circ$ gives a circle, $\\alpha<\\beta<90^\\circ$ an ellipse, $\\beta=\\alpha$ a parabola, and $\\beta<\\alpha$ a hyperbola.",
          "If the plane passes through the vertex, the section is degenerate: a single point for $\\beta>\\alpha$, one line for $\\beta=\\alpha$, and two intersecting lines for $\\beta<\\alpha$.",
        ],
      },
      {
        stage: "formal",
        title: "Why the angles decide",
        paragraphs: [
          "A plane that meets every side line of one nappe gives a closed curve, so it is an ellipse, or a circle if it is perpendicular to the axis. A plane parallel to exactly one side line misses that line and gives one open branch, a parabola. A plane steeper than the sides meets both nappes and gives two branches, a hyperbola.",
        ],
      },
    ],
    pitfalls: [
      "Equal angles give a parabola, not an ellipse.",
      "A plane through the vertex gives a point, a line or two lines.",
    ],
    parentGuide:
      "Use a flashlight beam on a wall to see how tilting changes the shape of the lit region.",
  },
];
