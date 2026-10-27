import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsAlgebraOneFigureMethods: Record<string, ProblemMethod> = {
  "parabola-axis-vertex-graph": {
    goal: "Read the vertex of a graphed parabola and write the equation of its axis of symmetry.",
    intuition:
      "A parabola is a mirror image of itself across a line through its turning point. That turning point is the vertex, the lowest point if the parabola opens up and the highest if it opens down. The mirror line is vertical, so its equation says which $x$ value it passes through.",
    terms: [
      ["vertex", "The point where a parabola turns."],
      [
        "axis of symmetry",
        "The vertical line through the vertex that splits the parabola into mirror images.",
      ],
    ],
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
      "A function gives each input exactly one output. On a graph, the input is the position left or right, and the output is the height. If a vertical line touches a graph in two places, one input has two outputs, so the graph is not a function.",
    terms: [
      [
        "vertical line test",
        "A graph is a function exactly when no vertical line crosses it more than once.",
      ],
      ["input and output", "The $x$ value and the $y$ value of a point."],
    ],
    method: [
      "Picture a vertical line sliding across the graph from left to right.",
      "If at any position it touches the graph twice, the graph is not a function.",
      "Choose the graph where every vertical line touches it at most once.",
    ],
    watch:
      "A circle, a sideways curve and a vertical line all fail. A graph can turn around vertically and still be a function.",
  },
  "inequality-both-sides-number-line": {
    goal: "Solve an inequality with the variable on both sides and choose the number line with the right boundary and direction.",
    intuition:
      "Solving an inequality uses the same steps as an equation, with one extra rule: multiplying or dividing both sides by a negative number reverses the inequality sign. The answer is a boundary number and a direction, and the circle at the boundary is open if the number itself is not a solution.",
    terms: [
      ["boundary", "The number where the solutions start or stop."],
      ["open circle", "A circle that marks a boundary that is not included."],
    ],
    method: [
      "Collect the variable terms on one side and the constants on the other.",
      "Divide by the coefficient, reversing the sign if it is negative.",
      "Mark the boundary, open for $<$ or $>$ and closed for $\\le$ or $\\ge$, and shade toward the solutions.",
    ],
    watch:
      "Reverse the sign only when dividing by a negative. A halfway boundary sits between two labeled integers.",
  },
};

export const regentsAlgebraOneFigurePrinciples: Record<string, string> = {
  "parabola-axis-vertex-graph":
    "The graph of $y=a(x-h)^2+k$ has vertex $(h,k)$ and is symmetric about the vertical line $x=h$. A parabola opening up has its lowest point at the vertex and one opening down has its highest point there.",
  "graph-is-function":
    "A set of points in the plane is the graph of a function exactly when every vertical line meets it in at most one point, because a function assigns one output to each input.",
  "inequality-both-sides-number-line":
    "Adding or subtracting the same quantity on both sides of an inequality keeps its direction. Multiplying or dividing by a positive number keeps it, and by a negative number reverses it. The solution set of $x>c$ or $x<c$ excludes $c$ (open circle), and of $x\\ge c$ or $x\\le c$ includes $c$ (closed circle).",
};

export const regentsAlgebraOneFigureLessons = [
  chainLesson({
    id: "regents-parabola-axis-vertex-graph",
    title: "Axis of symmetry and vertex from a graph",
    summary:
      "Read the turning point of a parabola and write the equation of its vertical axis of symmetry.",
    templateIds: ["parabola-axis-vertex-graph"],
    objectives: [
      "Read the coordinates of a vertex from a graph.",
      "Write the axis of symmetry as a vertical line $x = c$.",
    ],
    openingTitle: "The mirror line goes through the turning point",
    opening: [
      "Fold a picture of a parabola along a vertical line through its turning point and the two halves match. That fold line is the axis of symmetry, and the turning point on it is the vertex.",
      "Because the fold line is vertical, its equation has the form $x = c$, where $c$ is the first coordinate of the vertex.",
    ],
    example: {
      prompt:
        "A parabola opens down and its highest point is 2 units to the left of the $y$-axis and 3 units above the $x$-axis. Give its vertex and axis of symmetry.",
      steps: [
        "The highest point is the vertex: 2 units left is $x=-2$ and 3 units up is $y=3$.",
        "The vertex is $(-2, 3)$.",
        "The axis is the vertical line through it: $x=-2$.",
      ],
      answer: "vertex $(-2, 3)$; axis $x=-2$",
    },
    methodTitle: "Vertex first, then the line",
    method: [
      "Find the highest or lowest point and read $(x, y)$.",
      "Write the axis with the same $x$ value: $x = c$.",
      "Check that equal heights occur at equal distances on each side.",
    ],
    formalTitle: "Vertex form and symmetry",
    formal: [
      "For $y=a(x-h)^2+k$ the vertex is $(h,k)$. Replacing $x$ by $2h-x$ gives the same $y$, so the graph is symmetric about $x=h$.",
    ],
    pitfalls: [
      "A horizontal line $y = c$ is not the axis of a parabola that opens up or down.",
      "The vertex is $(x, y)$: do not swap the coordinates.",
      "The sign of $x$ follows the side of the $y$-axis on which the vertex lies.",
    ],
    parentGuide:
      "Ask your learner to trace the curve and say where it turns, then say which direction the fold line runs.",
  }),
  chainLesson({
    id: "regents-graph-is-function",
    title: "The vertical line test",
    summary:
      "Tell which of several graphs shows a function by checking vertical lines.",
    templateIds: ["graph-is-function"],
    objectives: [
      "State why a function's graph cannot have two points above each other.",
      "Apply the vertical line test to a circle, a sideways curve and a vertical line.",
    ],
    openingTitle: "One input, one output",
    opening: [
      "A function takes an input $x$ and gives exactly one output $y$. On a graph, all points with the same input sit on one vertical line. So if some vertical line meets the graph twice, that input has two outputs.",
      "This is the vertical line test: slide a vertical line across the graph, and the graph is a function if the line never touches it in more than one place.",
    ],
    example: {
      prompt:
        "Does a circle with center $(1, 0)$ and radius 3 represent a function?",
      steps: [
        "The vertical line $x=1$ passes through the center.",
        "It meets the circle at $(1, 3)$ and $(1, -3)$.",
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
      "A relation is a function when each input appears with exactly one output. Its graph meets every vertical line $x=c$ at most once, and exactly once for each $c$ in the domain.",
    ],
    pitfalls: [
      "A graph that turns around, like a parabola, can still be a function.",
      "A vertical line itself is not a function.",
      "A sideways parabola fails even though it is a curve.",
    ],
    parentGuide:
      "Have your learner hold a pencil upright and slide it across each graph.",
  }),
  chainLesson({
    id: "regents-inequality-both-sides-number-line",
    title: "Inequalities with the variable on both sides",
    summary:
      "Collect the variable terms, divide while watching the sign, and graph the solutions with a halfway boundary.",
    templateIds: ["inequality-both-sides-number-line"],
    objectives: [
      "Collect variable terms on one side and constants on the other.",
      "Reverse the inequality sign when dividing by a negative number and graph a boundary between integers.",
    ],
    openingTitle: "The same steps as an equation, with one new rule",
    opening: [
      "An inequality like $3x+5<5x-2$ says one side is less than the other. You may add or subtract the same amount on both sides. You may also multiply or divide by the same positive number. If you multiply or divide by a negative number, the sign flips.",
      "The solution is a boundary and a direction. A circle on the boundary is open when the boundary itself does not satisfy the inequality, and closed when it does.",
    ],
    example: {
      prompt: "Graph the solutions of $3x+5<5x-2$.",
      steps: [
        "Subtract $5x$: $-2x+5<-2$.",
        "Subtract 5: $-2x<-7$.",
        "Divide by $-2$ and reverse the sign: $x>\\frac{7}{2}$.",
        "Open circle at $3.5$ with the ray to the right.",
      ],
      answer: "$x>\\frac{7}{2}$",
    },
    methodTitle: "Collect, divide, then draw",
    method: [
      "Subtract the smaller variable term from both sides, then move the constant.",
      "Divide by the coefficient, flipping the sign if it is negative.",
      "Draw an open or closed circle at the boundary and shade toward the solutions.",
    ],
    formalTitle: "Why the sign flips",
    formal: [
      "Multiplying both sides of $a<b$ by $-1$ gives $-a>-b$, because negation reverses the order of numbers. The same holds for dividing by a negative.",
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
