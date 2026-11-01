import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneFigureMethods: Record<string, ProblemMethod> = {
  "parabola-axis-vertex-graph": {
    goal: "Read the vertex of a graphed parabola and write the equation of its axis of symmetry.",
    intuition:
      "A parabola is a U-shaped curve, like the graph of $y=x^{2}$. A turning point is where a curve stops going down and starts going up, or the reverse. The turning point of a parabola is called the vertex. It is the lowest point if the parabola opens up, and the highest point if it opens down. A point's coordinates are its two numbers $(x, y)$: across, then up. A line of symmetry is a fold line that makes the two halves of a shape match. A parabola's line of symmetry is a vertical line, straight up and down, through the vertex. It is called the axis of symmetry. A vertical line's equation names the $x$ value it passes through, such as $x=-2$.",
    senses: { vertex: "vertex-parabola", side: "side", sides: "side" },
    noLink: ["units"],
    terms: ["vertex-parabola", "axis-of-symmetry"],
    method: [
      "Find the turning point and read its coordinates as $(x, y)$.",
      "Write the axis as $x =$ the vertex's first coordinate.",
      "Check that the two sides of the curve mirror each other across that line.",
    ],
    watch:
      "A vertical line is written $x = c$, not $y = c$. Read across first, then up or down.",
  },
  "graph-is-function": {
    goal: "Use the vertical line test to decide which graph shows a function.",
    intuition:
      "A function is a rule that turns each input, the number you put in, into exactly one output, the number you get out. On a graph, the input is the position left or right, and the output is the height. A vertical line is a line straight up and down. If some vertical line touches a graph in two places, one input has two outputs, so the graph is not a function. At most means no more than: at most once is once or not at all.",
    noLink: ["more than", "rule"],
    terms: [
      "vertical-line-test",
      [
        "input",
        "Here the input is a point's $x$-value and the output is its $y$-value.",
      ],
      "output",
    ],
    method: [
      "Picture a vertical line sliding across the graph from left to right.",
      "If at any position it touches the graph twice, the graph is not a function.",
      "Choose the graph where every vertical line touches it at most once.",
    ],
    watch:
      "A circle, a sideways U and a vertical line all fail, because some vertical line meets each of them more than once. A graph can go up and down and still be a function.",
  },
  "inequality-both-sides-number-line": {
    goal: "Solve an inequality with the variable on both sides, and choose the number line with the right boundary and direction.",
    intuition:
      "An inequality is a statement that compares two amounts with a sign such as $<$ (less than) or $\\ge$ (greater than or equal to). It has two sides: the amounts to the left and right of its sign. A variable is a letter that stands for a number. A solution is a number that makes the inequality true. A term is one piece of a side, joined to the others by + or −. Solve with the same steps as an equation, plus one rule. To reverse the inequality sign means to turn it around: $<$ becomes $>$. Multiplying or dividing both sides by a negative number, one less than 0, reverses the inequality sign. In these problems the solutions are every number on one side of a boundary number. An open circle is a hollow dot at the boundary: the boundary is not a solution. A closed circle is a filled dot: the boundary is a solution.",
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      term: "term-expression",
      terms: "term-expression",
      boundary: "boundary",
    },
    noLink: ["rule"],
    terms: ["boundary", "open-circle"],
    method: [
      "Collect the variable terms on one side and the constants, the plain numbers, on the other.",
      "Divide both sides by the coefficient, the number multiplying the variable. Reverse the sign if it is negative.",
      "Mark the boundary, open for $<$ or $>$ and closed for $\\le$ or $\\ge$, and shade toward the solutions.",
    ],
    watch:
      "Reverse the sign only when you multiply or divide both sides by a negative number. A boundary such as 3.5 sits halfway between the marks for 3 and 4.",
  },
};

export const regentsAlgebraOneFigurePrinciples: Record<string, string> = {
  "parabola-axis-vertex-graph":
    "The graph of $y=a(x-h)^2+k$ with $a\\neq0$ has vertex $(h,k)$ and mirrors itself across the vertical line $x=h$: its two halves match. A parabola opening up has its lowest point at the vertex, and one opening down has its highest point there.",
  "graph-is-function":
    "A set of points in the plane is the graph of a function exactly when every vertical line meets it in at most one point, because a function assigns one output to each input.",
  "inequality-both-sides-number-line":
    "Adding or subtracting the same quantity on both sides of an inequality keeps its direction. Multiplying or dividing by a positive number keeps it, and by a negative number reverses it. The solutions of $x>c$ or $x<c$ leave out $c$ (open circle). The solutions of $x\\ge c$ or $x\\le c$ include $c$ (closed circle).",
};

export const regentsAlgebraOneFigureLessons = [
  {
    ...chainLesson({
      id: "regents-parabola-axis-vertex-graph",
      title: "Axis of symmetry and vertex from a graph",
      summary:
        "A parabola is a U-shaped curve. Its turning point, the highest or lowest point, is called the vertex. A vertical line, a line straight up and down, through the vertex splits the parabola into two mirror halves. That line is called the axis of symmetry. Its equation is $x =$ the first number of the vertex.",
      templateIds: ["parabola-axis-vertex-graph"],
      objectives: [
        "Read the coordinates of a vertex from a graph.",
        "Write the axis of symmetry as a vertical line $x = c$.",
      ],
      openingTitle: "The mirror line goes through the turning point",
      opening: [
        "Fold a picture of a parabola along a vertical line through its turning point, and the two halves match. A line of symmetry is a fold line like that. For a parabola it is called the axis of symmetry, and the turning point on it is the vertex.",
        "A point's coordinates are its two numbers $(x, y)$: across, then up. Every point on a vertical line has the same $x$-coordinate. So the axis has an equation of the form $x = c$, where $c$ is the $x$-coordinate of the vertex.",
      ],
      example: {
        prompt:
          "A parabola opens down and its highest point is 2 units to the left of the $y$-axis and 3 units above the $x$-axis. Give its vertex and axis of symmetry.",
        steps: [
          "The highest point is the vertex. 2 units left of the $y$-axis is $x=-2$, and 3 units up is $y=3$.",
          "So the vertex is $(-2, 3)$.",
          "The axis is the vertical line through the vertex: $x=-2$.",
        ],
        answer: "vertex $(-2, 3)$; axis $x=-2$",
      },
      methodTitle: "Vertex first, then the line",
      method: [
        "Find the highest or lowest point and read $(x, y)$.",
        "Write the axis with the same $x$ value: $x = c$.",
        "Check that equal heights occur at equal distances on each side of the axis.",
      ],
      formalTitle: "Vertex form and symmetry",
      formal: [
        "For $y=a(x-h)^2+k$ with $a\\neq0$, the vertex is $(h,k)$. Replacing $x$ by $2h-x$ gives the same $y$. So the graph mirrors itself across the line $x=h$: its two halves match.",
      ],
      pitfalls: [
        "A horizontal line is a line running straight across. The line $y = c$ is horizontal, so it is not the axis of a parabola that opens up or down.",
        "The vertex is $(x, y)$: do not swap the coordinates.",
        "The sign of $x$ follows the side of the $y$-axis on which the vertex lies.",
      ],
      parentGuide:
        "Ask your learner to trace the curve and say where it turns, then say which direction the fold line runs.",
    }),
    senses: { vertex: "vertex-parabola", side: "side", sides: "side" },
    noLink: ["units"],
  },
  {
    ...chainLesson({
      id: "regents-graph-is-function",
      title: "The vertical line test",
      summary:
        "A function is a rule that turns each input, the number you put in, into exactly one output, the number you get out. A vertical line is a line straight up and down. A graph shows a function when no vertical line meets it more than once.",
      templateIds: ["graph-is-function"],
      objectives: [
        "State why a function's graph cannot have two points above each other.",
        "Apply the vertical line test to a circle, a sideways curve and a vertical line.",
      ],
      openingTitle: "One input, one output",
      opening: [
        "On a graph, the input is $x$ and the output is $y$. All points with the same input sit on one vertical line. So if some vertical line meets the graph twice, that input has two outputs.",
        "Sliding a vertical line across a graph is called the vertical line test. The graph is a function if the line never touches it in more than one place.",
        "A circle is all the points at one distance, called the radius, from a point called the center.",
      ],
      example: {
        prompt:
          "Does a circle with center $(1, 0)$ and radius 3 represent a function?",
        steps: [
          "The vertical line $x=1$ passes through the center.",
          "It meets the circle 3 units above and 3 units below the center, at $(1, 3)$ and $(1, -3)$.",
          "The input 1 has two outputs, so the circle is not a function.",
        ],
        answer: "no",
      },
      methodTitle: "Slide a vertical line across",
      method: [
        "Imagine a vertical line at each position from left to right.",
        "Look for any position where it meets the graph two or more times.",
        "A graph where that never happens is a function.",
      ],
      formalTitle: "Function graphs",
      formal: [
        "A relation, any set of input-output pairs, is a function when each input appears with exactly one output. At most means no more than. Its graph meets every vertical line $x=c$ at most once. It meets $x=c$ exactly once for each $c$ in the domain, the set of allowed inputs.",
      ],
      pitfalls: [
        "A parabola, a U-shaped curve, turns around but can still be a function.",
        "A vertical line itself is not a function.",
        "A sideways U fails, even though it is a curve.",
      ],
      parentGuide:
        "Have your learner hold a pencil upright and slide it across each graph.",
    }),
    senses: { center: "center" },
    noLink: ["more than", "rule", "units"],
  },
  {
    ...chainLesson({
      id: "regents-inequality-both-sides-number-line",
      title: "Inequalities with the variable on both sides",
      summary:
        "An inequality is a statement that compares two amounts with a sign such as $<$ (less than) or $\\ge$ (greater than or equal to). It has two sides: the amounts left and right of its sign. A variable is a letter that stands for a number. When the variable is on both sides, collect the variable parts on one side, then divide. If you divide by a negative number, one less than 0, reverse the sign: $<$ becomes $>$. A solution is a number that makes the inequality true, and a number line shows them all. The boundary, where the solutions start, may sit halfway between two marks.",
      templateIds: ["inequality-both-sides-number-line"],
      objectives: [
        "Collect variable terms on one side and constants on the other.",
        "Reverse the inequality sign when dividing by a negative number and graph a boundary between integers.",
      ],
      openingTitle: "The same steps as an equation, with one new rule",
      opening: [
        "An inequality like $3x+5<5x-2$ says the left side is less than the right side. Its sides are the amounts on each side of the sign. A variable is a letter that stands for a number, and a solution is a number that makes the inequality true.",
        "You may add or subtract the same amount on both sides. You may also multiply or divide both sides by the same positive number. If you multiply or divide by a negative number, the sign flips: $<$ becomes $>$.",
        "Here the solutions are every number on one side of a boundary. The boundary is the number where they start. An open circle is a hollow dot: the boundary is not a solution. A closed circle is a filled dot: the boundary is a solution. A ray is a part of the number line that starts at one point and goes on forever one way.",
      ],
      example: {
        prompt: "Graph the solutions of $3x+5<5x-2$.",
        steps: [
          "Subtract $5x$ from both sides to collect the $x$ parts on the left: $-2x+5<-2$.",
          "Subtract 5 from both sides: $-2x<-7$.",
          "Divide both sides by $-2$, a negative number, so reverse the sign: $x>\\frac{7}{2}$.",
          "$\\frac{7}{2}=3.5$ is not a solution, so draw an open circle at $3.5$. The solutions are greater, so the ray points right.",
        ],
        answer: "$x>\\frac{7}{2}$",
      },
      methodTitle: "Collect, divide, then draw",
      method: [
        "Subtract one variable part from both sides so the variable is on one side only, then move the plain number.",
        "Divide by the coefficient, the number multiplying the variable, and flip the sign if it is negative.",
        "Draw an open or closed circle at the boundary and shade toward the solutions.",
      ],
      formalTitle: "Why the sign flips",
      formal: [
        "Multiplying both sides of $a<b$ by $-1$ gives $-a>-b$, because taking the negative reverses the order of numbers: $2<5$ but $-2>-5$. The same holds for dividing by a negative number.",
        "Check by testing a number from the shaded ray in the original inequality.",
      ],
      pitfalls: [
        "Flip the sign only when you multiply or divide by a negative number.",
        "Use an open circle for $<$ and $>$, a closed circle for $\\le$ and $\\ge$.",
        "A boundary like $3.5$ sits halfway between the marks for 3 and 4.",
      ],
      parentGuide:
        "Ask your learner to test one number from the shaded part in the original inequality.",
    }),
    senses: {
      side: "side-of-equation",
      sides: "side-of-equation",
      boundary: "boundary",
    },
    noLink: ["terms", "term", "part", "parts"],
  },
];

const fm = (
  templateId: string,
  facetId: string,
  rationale: string,
): FacetMapping => ({
  templateId,
  facetId,
  extent: "partial",
  rationale,
});
export const regentsAlgebraOneFigureFacetMappings: FacetMapping[] = [
  fm(
    "parabola-axis-vertex-graph",
    "quadratic-graphs.core",
    "Single choice for the axis equation and vertex of a drawn parabola with integer vertex. Does not assess nonvertical features such as intercepts or the maximum value, or writing the equation of the parabola.",
  ),
  fm(
    "graph-is-function",
    "function-domain-range.core",
    "Figure choice of the one graph that passes the vertical line test among four drawn graphs. Does not assess tables, mappings or equations, or explaining the test in words.",
  ),
  fm(
    "inequality-both-sides-number-line",
    "linear-inequalities.core",
    "Figure choice of the number line for an inequality with the variable on both sides and a halfway boundary. Does not assess compound inequalities, word problems or writing the solution set in notation.",
  ),
];
