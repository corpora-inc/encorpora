import type { FacetMapping } from "./coverage";
import { workContent, type WorkEntry } from "./structured-work-lesson-kit";

/**
 * Lessons for HSG.GPE.A.2: the equation of a parabola is derived from its
 * focus and directrix, not recalled. One worked chain (focus (1, 3),
 * directrix y = −1) runs through all three lessons.
 */

const senses = {
  vertex: "vertex-parabola",
  vertices: "vertex-parabola",
  focus: "focus",
};
const noLink = ["square", "squares", "squared", "squaring", "level", "drop"];

const chain = [
  "$\\sqrt{(x-1)^2+(y-3)^2}=|y+1|$",
  "$(x-1)^2+(y-3)^2=(y+1)^2$",
  "$(x-1)^2+y^2-6y+9=y^2+2y+1$",
  "$(x-1)^2=8y-8$",
  "$(x-1)^2=8(y-1)$",
];

const entries: WorkEntry[] = [
  {
    id: "parabola-derive-equation",
    title: "Derive a parabola's equation from its focus and directrix",
    goal: "Given a focus and a directrix, choose each line that turns equal distances into the parabola's equation.",
    summary:
      "A parabola is every point that is as far from a fixed point, the focus, as from a fixed line, the directrix. Writing that sentence as an equation and simplifying it gives the parabola's equation. Each line of the work has one job.",
    senses,
    noLink,
    objectives: [
      "Write the distance from a point $P(x, y)$ to the focus with a square root, and the distance to the directrix with an absolute value.",
      "Square both sides, expand, cancel and factor to reach the form $(x-h)^2=4p(y-k)$ or $(y-k)^2=4p(x-h)$.",
    ],
    background: [
      {
        title: "Two distances",
        paragraphs: [
          "Take any point $P(x, y)$. Its distance to the focus $F(1, 3)$ is the long side of a right triangle with legs $x-1$ and $y-3$, so $PF=\\sqrt{(x-1)^2+(y-3)^2}$.",
          "Its distance to the line $y=-1$ is a straight drop. Only the height changes on the way down, so the distance is $|y+1|$. The bars mean absolute value: the size of a number without its sign.",
        ],
      },
    ],
    intuition:
      "The rule is one sentence: $P$ is on the parabola when $PF$ equals the distance from $P$ to the directrix. Write that sentence as an equation. Both sides are distances, so squaring both sides keeps exactly the same points and clears the root and the bars. Then $y^2$ appears on both sides and cancels. That is why the result has a square in only one variable.",
    terms: ["parabola", "focus", "directrix", "vertex-parabola", "distance"],
    method: [
      "Set $PF$, written with a square root, equal to the distance to the directrix: $|y-c|$ for the line $y=c$, or $|x-c|$ for $x=c$.",
      "Square both sides. Expand both squares of the variable in the directrix, then cancel its square.",
      "Move every term with that variable and every number to the right side, changing the sign of each one that crosses.",
      "Factor the coefficient out of the right side. It is $4p$, and the bracket shows the vertex.",
    ],
    watch:
      "Measure the distance to a horizontal line with $y$ and to a vertical line with $x$, and square the whole side: $(y+1)^2$ has three terms, $y^2+2y+1$.",
    principle:
      "For focus $(a, b)$ and directrix $y=c$: $\\sqrt{(x-a)^2+(y-b)^2}=|y-c|$ gives $(x-a)^2=2(b-c)\\left(y-\\frac{b+c}{2}\\right)$. So $4p=2(b-c)$ and the vertex is $\\left(a, \\frac{b+c}{2}\\right)$, halfway between focus and directrix.",
    example: {
      prompt:
        "A parabola has focus $F(1, 3)$ and directrix $y=-1$. Derive its equation.",
      steps: [
        `Line 1, equal distances: ${chain[0]}.`,
        `Line 2, square both sides: ${chain[1]}.`,
        `Expand: ${chain[2]}. Cancel $y^2$, then move $-6y$ and $9$ to the right as $+6y$ and $-9$. Line 3: ${chain[3]}.`,
        `Line 4, factor $8$ out of the right side: ${chain[4]}. So $4p=8$, $p=2$, and the vertex is $(1, 1)$.`,
        "Check: the vertex $(1, 1)$ is $2$ below the focus and $2$ above the directrix.",
      ],
      answer: "$(x-1)^2=8(y-1)$",
    },
    methodTitle: "Read the result",
    methodText: [
      "In $(x-h)^2=4p(y-k)$ the vertex is $(h, k)$ and $p$ is the signed distance from the vertex to the focus. Positive $p$ opens up; negative $p$ opens down.",
      "A vertical directrix swaps the roles: $(y-k)^2=4p(x-h)$, opening right for positive $p$ and left for negative $p$.",
    ],
    formal:
      "Squaring is safe here because both sides are at least 0: for such numbers, $A=B$ exactly when $A^2=B^2$. Every later step adds the same thing to both sides or rewrites one side, so each line has the same solutions as Line 1.",
    pitfalls: [
      "Writing $|x-c|$ for the distance to the line $y=c$.",
      "Squaring only one side, or writing $(y+1)^2$ as $y^2+1$.",
      "Taking $4p$ as four times the focus-directrix distance: it is twice that distance, since $p$ is half of it.",
    ],
    parentGuide:
      "Ask your learner to say Line 1 in words before choosing it: the distance to the focus equals the distance to the line.",
  },
  {
    id: "parabola-derivation-check",
    title: "Check a parabola derivation line by line",
    goal: "Find the first wrong line of a parabola derivation and name the mistake, or give the reason for a step.",
    summary:
      "A derivation is checked by redoing each step from the line above it. The first line that does not follow is the mistake. Every line after it may follow correctly from the wrong line, so a wrong final answer does not show where the error is.",
    senses,
    noLink,
    objectives: [
      "Redo each step of a focus-directrix derivation and find the first line that does not follow from the line above it.",
      "Name the operation each step performs: equal distances, squaring both sides, expanding, cancelling and collecting, factoring.",
    ],
    intuition:
      "Each line of the derivation has one job: state the equal distances, square both sides, expand, cancel and collect, factor. Check each line by asking whether that job was done right from the line above it. A mistake usually hides in a sign, a missing middle term, or one side that was not squared.",
    terms: ["parabola", "focus", "directrix", "vertex-parabola"],
    method: [
      "Write Line 1 yourself from the focus and directrix, and compare. Then redo each next step from the line above it.",
      "Stop at the first line that differs from your own. Name what went wrong there: the wrong distance, one-sided squaring, a dropped middle term, an unchanged sign, or a wrong factor.",
      "For a reason, compare the two lines and name the one operation between them.",
    ],
    watch:
      "Compare each line with the line just above it, not with the final answer. Lines after a mistake can each be correct steps.",
    principle:
      "A step is correct when the new line follows from the line above it by one valid operation. The first line that does not is the error, whatever comes after it.",
    example: {
      prompt:
        "A derivation for focus $F(1, 3)$ and directrix $y=-1$ reads: Line 1 $\\sqrt{(x-1)^2+(y-3)^2}=|y+1|$; Line 2 $(x-1)^2+(y-3)^2=(y+1)^2$; Line 3 $(x-1)^2+y^2-6y+9=y^2+1$; Line 4 $(x-1)^2=6y-8$; Line 5 $(x-1)^2=6\\left(y-\\frac{4}{3}\\right)$. Find the first wrong line.",
      steps: [
        "Line 1 is correct: it sets the distance to the focus equal to the distance to $y=-1$.",
        "Line 2 is correct: it squares both sides.",
        "Line 3 should expand $(y+1)^2$ to $y^2+2y+1$. It shows $y^2+1$: the middle term $2y$ is missing.",
        "Lines 4 and 5 follow correctly from the wrong Line 3, so they carry the mistake. The right ending is $(x-1)^2=8(y-1)$.",
      ],
      answer: "Line 3: the middle term $2y$ of $(y+1)^2$ was dropped",
    },
    methodTitle: "The jobs, in order",
    methodText: [
      "Line 1: the distance to the focus equals the distance to the directrix. Line 2: both sides squared. Line 3: the squares expanded. Line 4: the square of the variable cancelled, terms collected. Line 5: the coefficient factored out.",
      "Wrong reasons are steps that never happen here: taking a square root, dividing both sides by the coefficient, or substituting the vertex.",
    ],
    formal:
      "Each correct step produces an equation with the same solutions as the one above it. A wrong step changes the solution set, and every later correct step keeps that wrong set. So only the first changed line is the error.",
    pitfalls: [
      "Marking a later line as wrong because it looks strange, when it follows correctly from an earlier mistake.",
      "Choosing a reason that is true about parabolas but does not describe the change between the two lines.",
    ],
    parentGuide:
      "Ask your learner what job the next line has, then whether it did that job.",
  },
  {
    id: "parabola-point-equidistance",
    title: "Test the focus-directrix rule at one point",
    goal: "Use equal distances to the focus and directrix to find a point on a parabola or test one.",
    summary:
      "A point is on a parabola exactly when its distance to the focus equals its distance to the directrix. To test a point, compute both distances and compare. To find a missing coordinate, set the two distances equal and solve.",
    senses,
    noLink,
    objectives: [
      "Compute a point's distance to the focus with the Pythagorean theorem and its distance to the directrix as a straight drop.",
      "Decide whether a point is on the parabola, or find the coordinate that puts it there.",
    ],
    intuition:
      "The parabola is the rule itself: equal distances. For a point $Q$, draw the right triangle from $Q$ to the focus; its long side is $QF$. The distance to a horizontal directrix is the difference in heights. If the two numbers match, $Q$ is on the parabola.",
    terms: ["parabola", "focus", "directrix", "distance", "hypotenuse"],
    method: [
      "Find the legs from the point to the focus and compute the focus distance with $\\sqrt{\\text{leg}^2+\\text{leg}^2}$.",
      "Find the distance to the directrix: the difference in $y$ for a line $y=c$, or in $x$ for a line $x=c$.",
      "Compare the two distances, or set them equal, square both sides and solve for the missing coordinate.",
    ],
    watch:
      "Combine the legs with the Pythagorean theorem, not by adding them, and measure the drop from the point itself, not from the focus.",
    principle:
      "$P$ is on the parabola with focus $F$ and directrix $d$ exactly when $PF$ equals the distance from $P$ to $d$.",
    example: {
      prompt:
        "A parabola has focus $F(1, 3)$ and directrix $y=-1$. Is $Q(5, 3)$ on it? Find $y$ so that $P(9, y)$ is on it.",
      steps: [
        "From $Q(5, 3)$ to $F$ the legs are $4$ and $0$, so $QF=4$. The drop from $Q$ to $y=-1$ is $|3-(-1)|=4$. They are equal, so $Q$ is on the parabola.",
        "For $P(9, y)$: $\\sqrt{(9-1)^2+(y-3)^2}=|y+1|$. Square: $64+y^2-6y+9=y^2+2y+1$.",
        "Cancel $y^2$ and collect: $72=8y$, so $y=9$.",
        "Check: $PF=\\sqrt{64+36}=10$ and the drop is $|9+1|=10$.",
      ],
      answer: "$Q$ is on the parabola; $y=9$",
    },
    methodTitle: "Why one point is enough",
    methodText: [
      "The equation of a parabola is this same test written for every point at once. Testing one point is the equation with numbers put in.",
    ],
    formal:
      "With focus $(a, b)$ and directrix $y=c$, a point $(x_0, y_0)$ satisfies $(x_0-a)^2+(y_0-b)^2=(y_0-c)^2$ exactly when it lies on the parabola, because both distances are at least 0.",
    pitfalls: [
      "Adding the legs instead of using the Pythagorean theorem.",
      "Measuring the drop from the focus or the vertex instead of from the point.",
      "Stopping after one distance: the test needs both, compared.",
    ],
    parentGuide:
      "Ask your learner to say the two distances out loud before deciding.",
  },
];

export const parabolaDerivationContent = workContent(entries);

export const parabolaDerivationFacetMappings: FacetMapping[] = [
  {
    templateId: "parabola-derive-equation",
    facetId: "parabola-locus.HSG.GPE.A.2",
    extent: "partial",
    rationale:
      "Choose each line of the derivation from a numeric focus and directrix, horizontal or vertical: the equal-distance equation, both sides squared, the squares expanded and cancelled, and the factored standard form or its p and vertex. Wrong lines are named slips. Does not assess writing the derivation freely or with a letter focus.",
  },
  {
    templateId: "parabola-derive-equation",
    facetId: "parabola-locus.core",
    extent: "partial",
    rationale:
      "Derive the standard form of a parabola from its focus and directrix by choosing each line. Does not assess graphing the parabola.",
  },
  {
    templateId: "parabola-derivation-check",
    facetId: "parabola-locus.HSG.GPE.A.2",
    extent: "partial",
    rationale:
      "Find the first incorrect line of a five-line derivation and name the mistake (wrong distance, swapped focus and directrix, split root, one-sided squaring, dropped middle term, unchanged sign, wrong factor), or choose the reasons for two marked steps of a correct derivation. Does not assess writing a derivation freely.",
  },
  {
    templateId: "parabola-point-equidistance",
    facetId: "parabola-locus.HSG.GPE.A.2",
    extent: "partial",
    rationale:
      "Apply the equal-distance condition to one point: find the missing coordinate of a point on the parabola, or choose the correct and complete explanation of whether a point is on it. Does not assess the general equation.",
  },
  {
    templateId: "parabola-point-equidistance",
    facetId: "parabola-locus.core",
    extent: "partial",
    rationale:
      "Use equal distances to the focus and directrix to find or test a point on a parabola. Does not assess deriving or graphing the equation.",
  },
];
