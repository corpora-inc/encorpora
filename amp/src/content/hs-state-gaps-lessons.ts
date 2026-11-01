import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const hsStateGapMethods: Record<string, ProblemMethod> = {
  "gauss-3x3-solve": {
    goal: "Use elimination on three equations in $x$, $y$, $z$ to find the solution, a row operation, or how many solutions exist.",
    intuition:
      "One equation in three unknowns leaves many possibilities. Each independent equation removes one degree of freedom, so three independent equations can pin down a single point. Elimination turns three equations into two, then one, by adding multiples of one equation to another without changing the solutions.",
    terms: ["elimination", "row-operation", "back-substitution"],
    method: [
      "Use one equation to cancel $x$ from the other two. The multiplier is the ratio of the two $x$ coefficients.",
      "Use one of the two new equations to cancel $y$ from the other. The last equation has only $z$.",
      "Back-substitute: find $z$, then $y$, then $x$. Check in all three original equations.",
      "If one equation reduces to $0=0$, there are infinitely many solutions. If one reduces to $0=c$ with $c\\ne0$, there is no solution.",
    ],
    watch:
      "Apply the same operation to the right-hand sides, not only the coefficients. When one equation is a combination of the others, compare the constants: matching constants give infinitely many solutions, different constants give none.",
  },
  "quadratic-inequality-interval": {
    goal: "Solve a quadratic inequality using its zeros and the sign of its leading coefficient, and write the solution set.",
    intuition:
      "The graph of a quadratic is a parabola. An inequality asks where that parabola is above or below the $x$-axis. The zeros are where the graph crosses the axis, so between them and beyond them the sign is constant.",
    terms: ["zero-of-a-function", "interval-notation"],
    method: [
      "Move every term to one side so the other side is 0, then find the zeros by factoring or the quadratic formula.",
      "Look at the leading coefficient: positive opens up, so the expression is negative between the zeros and positive outside; negative reverses this.",
      "Choose the region matching the inequality. Include the zeros for $\\le$ and $\\ge$; exclude them for $<$ and $>$.",
      "With no real zeros, the parabola stays on one side of the axis, so the solution is all real numbers or none. With one repeated zero, only that point differs.",
    ],
    watch:
      "Check one test value from your answer in the original inequality. A negative leading coefficient flips which region is positive, and the endpoints belong only when the inequality includes equality.",
  },
  "conditional-statements": {
    goal: "Form and compare a conditional, its converse, inverse and contrapositive, and evaluate compound statements from truth values.",
    intuition:
      "A conditional “if $P$, then $Q$” promises that whenever $P$ holds, $Q$ holds. It breaks only when $P$ is true and $Q$ is false. Changing the order or adding negations makes related statements, and only some of them say the same thing.",
    terms: ["converse", "inverse-statement", "contrapositive", "biconditional"],
    method: [
      "Name the hypothesis $P$ and the conclusion $Q$ in “if $P$, then $Q$”.",
      "Build the requested form: converse swaps, inverse negates, contrapositive does both.",
      "A statement and its contrapositive always have the same truth value; the converse and inverse also match each other but may differ from the original.",
      "For a compound statement, evaluate the smallest parts first. A conditional is false only for true then false; the negation of “if $P$, then $Q$” is “$P$ and not $Q$”.",
    ],
    watch:
      "A true conditional does not guarantee a true converse. To show a converse false, find one case where its hypothesis holds and its conclusion fails.",
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
    "Replacing an equation by itself plus a multiple of another equation gives an equivalent system. A linear system has no solution, exactly one, or infinitely many; the three-variable system has exactly one solution when elimination produces a pivot in every variable.",
  "quadratic-inequality-interval":
    "For $a\\ne0$, $ax^2+bx+c$ has the sign of $a$ outside its real zeros and the opposite sign between them. With no real zeros it has the sign of $a$ everywhere; with a double zero it has the sign of $a$ everywhere except at that zero.",
  "conditional-statements":
    "$P\\to Q$ is equivalent to its contrapositive $\\neg Q\\to\\neg P$, and the converse $Q\\to P$ is equivalent to the inverse $\\neg P\\to\\neg Q$. The negation of $P\\to Q$ is $P\\land\\neg Q$, and $P\\leftrightarrow Q$ means both $P\\to Q$ and $Q\\to P$.",
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
      "Cancel one variable at a time with row operations, then back-substitute. A dependent equation signals no solution or infinitely many.",
    templateIds: ["gauss-3x3-solve"],
    objectives: [
      "Choose the row operation that cancels a variable.",
      "Solve a three-equation system by elimination and back-substitution.",
      "Decide from the equations whether a system has one, no or infinitely many solutions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Three equations, three unknowns",
        paragraphs: [
          "You need to solve two-variable systems by elimination. A system of three equations in $x$, $y$ and $z$ works the same way, one variable at a time. Adding a multiple of one equation to another keeps every solution of the system, so you can use it to make variables cancel.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $x+y+z=6$, $2x-y+z=3$, $x+2y-z=2$.",
      steps: [
        "Cancel $x$ from equation 2: subtract 2 times equation 1. The equation becomes $-3y-z=-9$.",
        "Cancel $x$ from equation 3: subtract equation 1. It becomes $y-2z=-4$.",
        "Cancel $y$: add 3 times the new equation 3 to the new equation 2. This gives $-7z=-21$, so $z=3$.",
        "Back-substitute: $y-6=-4$ gives $y=2$, and $x+2+3=6$ gives $x=1$. Check: $2-2+3=3$ and $1+4-3=2$.",
      ],
      answer: "(1, 2, 3)",
    },
    closingSections: [
      {
        stage: "method",
        title: "Cancel one variable at a time",
        paragraphs: [
          "Use one equation to cancel $x$ from the other two, then use one of the two new equations to cancel $y$. The last equation has only $z$. Solve it and substitute upward. Always apply an operation to both sides.",
          "A row operation names the step: $R_2\\to R_2-2R_1$ means replace equation 2 by equation 2 minus 2 times equation 1. The multiple is the ratio of the two $x$ coefficients, so the $x$ terms cancel.",
        ],
      },
      {
        stage: "formal",
        title: "Why the steps keep the solutions",
        paragraphs: [
          "Replacing an equation by itself plus a multiple of another gives an equivalent system, because the old equation can be recovered by subtracting the multiple back. A linear system has no solution, exactly one, or infinitely many. If elimination gives a row $0=c$ with $c\\ne0$ there is no solution; if it gives $0=0$ with fewer than three independent equations, there are infinitely many.",
        ],
      },
    ],
    pitfalls: [
      "Apply each row operation to both sides of the equation.",
      "Check dependent equations on the constants, not only the coefficients.",
    ],
    parentGuide:
      "Ask the learner to say which variable they cancel first and which multiple of which equation they use.",
  },
  {
    id: "quadratic-inequality-interval",
    title: "Solve a quadratic inequality",
    summary:
      "Find where the parabola crosses the axis, then read off where it is above or below. Write the answer in interval notation.",
    templateIds: ["quadratic-inequality-interval"],
    objectives: [
      "Find the zeros and use the sign of the leading coefficient.",
      "Write the solution in interval notation, with correct endpoints.",
      "Handle expressions with no real zeros or one repeated zero.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Read the sign from the graph",
        paragraphs: [
          "You need to solve a quadratic equation. A quadratic inequality uses the same zeros, but asks where the expression is positive or negative. A parabola changes sign only at its zeros, so between consecutive zeros the sign is constant.",
        ],
      },
    ],
    workedExample: {
      prompt: "Solve $x^2-x-6<0$.",
      steps: [
        "Factor: $x^2-x-6=(x-3)(x+2)$, so the zeros are $-2$ and $3$.",
        "The leading coefficient is 1, positive, so the parabola opens up and is below the axis between the zeros.",
        "The inequality is strict, so the zeros are excluded. Test $x=0$: $-6<0$ is true, and 0 is between the zeros.",
      ],
      answer: "(-2, 3)",
    },
    closingSections: [
      {
        stage: "method",
        title: "Zeros, sign, then test",
        paragraphs: [
          "Move every term to one side, find the zeros, and mark them on a number line. They split the line into regions where the expression has one sign. A positive leading coefficient opens the parabola up, so it is negative between the zeros and positive outside; a negative one reverses this.",
          "Pick the regions that match the inequality, and test one value from each region in the original statement. For $\\le$ and $\\ge$ the zeros belong to the answer: use square brackets. For $<$ and $>$ use round brackets.",
        ],
      },
      {
        stage: "formal",
        title: "Sign of a quadratic",
        paragraphs: [
          "For $a\\ne0$ with real zeros $p<q$, $ax^2+bx+c=a(x-p)(x-q)$. It has the sign of $a$ for $x<p$ or $x>q$, and the opposite sign for $p<x<q$. With no real zeros, $b^2-4ac<0$ and the expression has the sign of $a$ for every real $x$. With one repeated zero it has the sign of $a$ everywhere except that zero.",
        ],
      },
    ],
    pitfalls: [
      "A negative leading coefficient reverses which region is positive.",
      "Strict inequalities exclude the zeros; $\\le$ and $\\ge$ include them.",
    ],
    parentGuide:
      "Ask the learner to sketch the parabola and shade where it is above or below the axis.",
  },
  {
    id: "conditional-statements",
    title: "Conditionals, converses and truth values",
    summary:
      "Swap and negate the parts of an if-then statement. Only the contrapositive always says the same thing as the original.",
    templateIds: ["conditional-statements"],
    objectives: [
      "Write the converse, inverse and contrapositive of a conditional.",
      "Tell which related statement is equivalent to the original.",
      "Evaluate compound statements from given truth values.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "A conditional and its related statements",
        paragraphs: [
          "A conditional has a hypothesis $P$ after “if” and a conclusion $Q$ after “then”. Swapping them gives the converse. Negating both gives the inverse. Doing both gives the contrapositive. A statement is true or false, and these related statements can have different truth values.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "For “If a triangle is equilateral, then it is isosceles”, which statement is the contrapositive?",
      steps: [
        "Hypothesis: a triangle is equilateral. Conclusion: it is isosceles.",
        "Negate the conclusion and the hypothesis, and swap them: if a triangle is not isosceles, then it is not equilateral.",
        "This is true whenever the original is, because a triangle with no two equal sides cannot have three.",
      ],
      answer: "If a triangle is not isosceles, then it is not equilateral.",
    },
    closingSections: [
      {
        stage: "method",
        title: "Swap, negate, or both",
        paragraphs: [
          "From “if $P$, then $Q$”: swapping gives the converse “if $Q$, then $P$”; negating both gives the inverse “if not $P$, then not $Q$”; doing both gives the contrapositive “if not $Q$, then not $P$”.",
          "The contrapositive always has the same truth value as the original. The converse and inverse also match each other, but can differ from the original. The negation of a conditional is “$P$ and not $Q$”.",
        ],
      },
      {
        stage: "formal",
        title: "Logical equivalence",
        paragraphs: [
          "Two statements are logically equivalent when they have the same truth value in every case. $P\\to Q$ is false only when $P$ is true and $Q$ is false, so it is equivalent to $\\neg Q\\to\\neg P$ and to $\\neg P\\lor Q$. A biconditional $P\\leftrightarrow Q$ is true exactly when $P$ and $Q$ have the same truth value; it states both $P\\to Q$ and $Q\\to P$.",
        ],
      },
    ],
    pitfalls: [
      "The converse of a true statement can be false: an isosceles triangle need not be equilateral.",
      "A conditional is false only when the hypothesis is true and the conclusion is false.",
    ],
    parentGuide:
      "Ask for a counterexample to the converse of a true statement.",
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
