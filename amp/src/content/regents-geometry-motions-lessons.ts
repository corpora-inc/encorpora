import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

const GEO_SENSES = {
  side: "side",
  vertex: "vertex",
  degrees: "degree-angle",
  "corresponding angles": "corresponding-angles",
  similar: "similar-figures",
  image: "image-transformation",
  center: "center",
  radius: "radius",
  plane: "plane",
  base: "base-shape",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  unit: "unit",
  tangent: "tangent-line",
  multiple: "multiple",
  "one third": "third",
} as const;
const GEO_NOLINK = [
  "opposite",
  "part",
  "parts",
  "rule",
  "rules",
  "third",
  "whole",
  "change",
  "changes",
  "square",
  "squares",
  "factor",
  "factors",
  "more than",
  "leaves",
  "mean",
  "product",
  "term",
  "terms",
  "scale",
  "prime",
  "opposite side",
];

export const regentsGeometryMotionMethods: Record<string, ProblemMethod> = {
  "geo-dilation-center": {
    goal: "Find the scale factor and the center of a dilation from a figure and its image.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A dilation resizes a figure from a fixed point, called its center. Every point moves along the line from the center through it. Its distance from the center is multiplied by the same positive number, the scale factor. The moved point is called the image, named with a prime mark: $A'$, read “$A$ prime”. When the scale factor is not 1, the center is the only point that does not move.",
    terms: ["center-of-dilation", "scale-factor"],
    method: [
      "Draw the line through $A$ and its image $A'$, and the line through $B$ and $B'$.",
      "The two lines cross at the center of dilation.",
      "Divide the distance from the center to $A'$ by the distance from the center to $A$. That is the scale factor.",
    ],
    watch:
      "A scale factor greater than 1 enlarges, and one between 0 and 1 shrinks, so do not flip the fraction. The center is not always the origin, and not always a corner.",
  },
  "geo-dilation-line-center": {
    goal: "Find the image of a line under a dilation whose center is not the origin, when the center is on the line or off it.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A dilation resizes a figure from a fixed point, its center, multiplying distances from the center by the scale factor. It sends a line to a parallel line, one with the same slope (steepness) that never meets it, or to the line itself. If the center is on the line, every point slides along the line, so the line does not change. If the center is off the line, the image is a different line with the same slope. A line written $y=mx+b$ has slope $m$ and crosses the $y$-axis at $b$, its $y$-intercept.",
    terms: [
      [
        "parallel",
        "On a graph, non-vertical parallel lines have equal slopes.",
      ],
      "image-transformation",
    ],
    method: [
      "Test whether the center makes the line's equation true.",
      "If it does, the center is on the line, so the image is the same line.",
      "If not, keep the slope. Dilate one point of the line about the center, and find the line with that slope through the new point.",
    ],
    watch:
      "The slope never changes. Multiplying the $y$-intercept by the scale factor is a shortcut for a center at the origin, the point $(0,0)$. For another center, dilate a point of the line instead.",
  },
  "geo-motion-chain": {
    goal: "Name the type of each rigid motion in a sequence from the coordinates of three triangles.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A rigid motion is a move that keeps a figure's size and shape. A translation slides every corner (vertex) by the same amount. A reflection is a flip across a line, like a mirror. It reverses the order of the labels around the triangle, from counterclockwise to clockwise or back. Clockwise is the way clock hands turn, and counterclockwise is the other way. A rotation turns the figure about a point. It keeps the order of the labels, but the sides point new ways.",
    terms: ["rigid-motion", "orientation"],
    method: [
      "For each step, compare where the vertices move.",
      "If every vertex moves by the same amount, the step is a translation.",
      "If the order of the labels is reversed, it is a reflection. If the order is the same and the sides are turned, it is a rotation.",
    ],
    watch:
      "Check each step separately, and keep the steps in order. Swapping two different motions usually gives a different answer.",
  },
  "geo-reflection-side": {
    goal: "Follow the endpoints of a side through two reflections to name its image.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "A reflection is a flip: it moves each point across a line, called the mirror line, to the point the same distance away on the other side, straight across. Points on the mirror line stay put. The image is the result after the move. A side is fixed by its two endpoints, so the image of a side joins the images of its endpoints. Doing two reflections means applying them one after the other.",
    terms: [
      [
        "reflection",
        "Over the $x$-axis, $(x, y)$ goes to $(x, -y)$; over the $y$-axis, it goes to $(-x, y)$.",
      ],
      [
        "image-transformation",
        "The image of a side is the segment joining the images of its two endpoints.",
      ],
    ],
    method: [
      "Reflect each endpoint over the first line, then reflect the result over the second line.",
      "Find which labeled points the results land on.",
      "The image of the side joins those two labeled points.",
    ],
    watch:
      "Apply the reflections in the stated order. The labels of the final figure need not follow the alphabetical order of the original.",
  },
  "geo-rigid-statement": {
    goal: "Decide which statement must be true after a sequence of rigid motions.",
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
    intuition:
      "Rigid motions are slides, flips and turns. They move a figure without changing its size or shape. Lengths and angles stay the same, so the image, the figure after the moves, is congruent: the same size and shape. What can change is the position, the direction the sides point, and the order of the labels around the figure. A reflection is a flip across a line, and each one reverses that order.",
    terms: ["congruent", "corresponding"],
    method: [
      "List what a rigid motion keeps: lengths, angle measures and area.",
      "Test each statement against that list.",
      "Count the reflections. An odd number reverses the order of the labels, and an even number restores it.",
    ],
    watch:
      "Sides need not stay parallel to their images, and coordinates usually change. Similar means only the same shape, which is weaker than congruent.",
  },
};

export const regentsGeometryMotionPrinciples: Record<string, string> = {
  "geo-dilation-center":
    "A dilation with center $O$ and scale factor $k>0$ sends each point $P$ to the point $P'$ on ray $OP$, the half-line from $O$ through $P$, with $OP'=k\\cdot OP$. In coordinates, $P'=O+k(P-O)$. So when $k\\ne1$, the center is $O=\\frac{P'-kP}{1-k}$.",
  "geo-dilation-line-center":
    "A dilation sends a line to a parallel line or to itself. It sends the line to itself exactly when the center is on the line. For the line $y=mx+b$, a center $(c,d)$ and scale factor $k$, the image is $y=mx+b'$, where $b'=(1-k)(d-mc)+kb$.",
  "geo-motion-chain":
    "Translations and rotations keep orientation, the clockwise or counterclockwise order of the labels. Reflections reverse it. A translation moves every vertex by the same amount, and a rotation about a point turns every side by the same angle.",
  "geo-reflection-side":
    "A reflection keeps every distance, so the image of a segment is the segment between the images of its endpoints. When reflections are written one inside the other, as in $r_2(r_1(P))$, the inner one, $r_1$, is applied first. In words, they are applied in the order stated.",
  "geo-rigid-statement":
    "A rigid motion keeps every distance, so it keeps angle measure and area, and the image of a figure is congruent to it. Doing $n$ reflections in a row reverses orientation, the clockwise order of the labels, exactly when $n$ is odd.",
};

export const regentsGeometryMotionLessons = [
  {
    ...chainLesson({
      id: "regents-geometry-dilation-centers",
      title: "Dilations about any center",
      summary:
        "A dilation resizes a figure from a fixed point, called the center. Each point slides along the line from the center through it, and its distance from the center is multiplied by the scale factor. The moved point is called the image. So the lines joining each point to its image all meet at the center. A line through the center lands on itself, and any other line lands on a parallel line.",
      templateIds: ["geo-dilation-center", "geo-dilation-line-center"],
      objectives: [
        "Locate the center of a dilation where lines through matching points cross.",
        "Find the image of a line when the center is on the line or off it, and is not the origin.",
      ],
      openingTitle: "The center is the point that does not move",
      opening: [
        "A dilation resizes a figure from a fixed point, called the center of dilation. Every distance from the center is multiplied by the same positive number, called the scale factor. A scale factor above 1 enlarges, and one between 0 and 1 shrinks. The new point is called the image, named with a prime mark: $A'$, read “$A$ prime”, is the image of $A$.",
        "A point and its image lie on one line through the center. So the lines through two points and their images cross at the center. The origin is the point $(0, 0)$, where the axes cross. The point $(x, y)$ is $x$ units across and $y$ units up from it.",
        "A line through the center lands on itself, because each of its points slides along it. A line that misses the center lands on a parallel line: one with the same slope (steepness) that never meets it.",
      ],
      example: {
        prompt:
          "A dilation with center $(1, 2)$ and scale factor 2 is applied. Find the image of $A=(3, 3)$, and the image of the line $y=x+1$.",
        steps: [
          "Find how far $A$ is from the center: from $(1,2)$ to $(3,3)$ is 2 across and 1 up. Double both, because the scale factor is 2: 4 across and 2 up.",
          "Move that far from the center: $A'=(1+4,\\,2+2)=(5,4)$.",
          "Test whether the center is on the line $y=x+1$. Put in $x=1$: $y=1+1=2$, which matches the center's $y$. So the center lies on the line.",
          "A line through the center lands on itself, so the image of $y=x+1$ is the same line.",
        ],
        answer: "$A'=(5,4)$; the line is unchanged",
      },
      methodTitle: "Lines through pairs, then the ratio",
      method: [
        "Draw the line through $A$ and $A'$, and the line through $B$ and $B'$. They cross at the center.",
        "Divide the distance from the center to an image point by the distance from the center to the original point. That gives the scale factor.",
        "For a line, test whether the center is on it. If not, keep the slope and dilate one point of the line to find the new line.",
      ],
      formalTitle: "Dilations in coordinates",
      formal: [
        "With center $O$ and scale factor $k$, the image of $P$ is $P'=O+k(P-O)$: start at the center and go $k$ times as far, in the direction of $P$. When $k\\ne1$, meaning $k$ is not 1, the center is the only point that stays put.",
        "A dilation keeps angle measures and sends each line to a parallel line or to itself, so slopes do not change.",
      ],
      pitfalls: [
        "An enlargement has a scale factor greater than 1, not its reciprocal (1 divided by it).",
        "The center is not always the origin.",
        "The slope of a line never changes. The line moves only when the center is off it.",
      ],
      parentGuide:
        "Ask your learner to draw one line through a point and its image. Then ask what every such line must pass through, and why.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
  },
  {
    ...chainLesson({
      id: "regents-geometry-rigid-motion-sequences",
      title: "Sequences of rigid motions",
      summary:
        "A rigid motion is a move that does not change a figure's size or shape, built from slides, flips and turns. To name each motion between two triangles, compare their corners. A flip reverses the order of the labels around the triangle. A slide moves every corner the same way, and a turn keeps the order but points the sides new ways. Lengths and angles never change, so the final triangle matches the first exactly.",
      templateIds: [
        "geo-motion-chain",
        "geo-reflection-side",
        "geo-rigid-statement",
      ],
      objectives: [
        "Tell a translation, a reflection and a rotation apart from coordinates.",
        "Follow endpoints through two motions, and state what every rigid motion keeps the same.",
      ],
      openingTitle: "Same size, same shape",
      opening: [
        "The basic rigid motions are a translation (a slide), a reflection (a flip across a line) and a rotation (a turn about a point). Every rigid motion is one of these or a sequence of them, and none changes any length or angle. So the image, the figure after the move, is congruent to the original: the same size and shape. A list of motions done one after another is called a sequence.",
        "To tell the motions apart, read the labels around the figure in order, such as $A$ to $B$ to $C$. They run either clockwise, the way clock hands turn, or counterclockwise. A reflection reverses that direction. A translation moves every corner the same way. A rotation keeps the direction but turns the sides.",
        "The origin is the point $(0, 0)$. Points are named by coordinates: $(1, 2)$ is 1 unit right of the origin and 2 units up. Reflecting over the $y$-axis changes the sign of $x$, so $(x, y)$ goes to $(-x, y)$. Moving 5 units down subtracts 5 from $y$.",
      ],
      example: {
        prompt:
          "Triangle $ABC$ has $A(1,2)$, $B(4,2)$, $C(1,4)$. It is reflected over the $y$-axis to $DEF$, then $DEF$ is translated 5 units down. Find the vertices of $GHI$ and describe the sequence.",
        steps: [
          "Reflect over the $y$-axis by changing the sign of each $x$: $D(-1,2)$, $E(-4,2)$, $F(-1,4)$.",
          "Translate 5 units down by subtracting 5 from each $y$: $G(-1,-3)$, $H(-4,-3)$, $I(-1,-1)$.",
          "The sequence is a reflection followed by a translation. Neither move changes lengths or angles, so $GHI$ is congruent to $ABC$.",
        ],
        answer: "a reflection followed by a translation",
      },
      methodTitle: "Compare each pair of triangles",
      method: [
        "For each step, compare the order of the labels and how the corners moved.",
        "To follow a side, apply the motions to both endpoints, in order.",
        "A statement is true after any sequence when every single motion keeps it true.",
      ],
      formalTitle: "Preserved properties",
      formal: [
        "A rigid motion keeps distance, angle measure and area, so the image is congruent to the original. In general it does not keep each side pointing the same way as its image, and it changes the coordinates and possibly the order of the labels.",
        "An even number of reflections restores the order of the labels, and an odd number reverses it.",
      ],
      pitfalls: [
        "The order of two different motions usually matters.",
        "Congruent is stronger than similar: rigid motions never change size, while similar figures may differ in size.",
        "A rotation is not a reflection, because it keeps the order of the labels.",
      ],
      parentGuide:
        "Have your learner cut out a paper triangle, label the corners, and slide, flip and turn it to see what changes.",
    }),
    senses: GEO_SENSES,
    noLink: GEO_NOLINK,
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
export const regentsGeometryMotionFacetMappings: FacetMapping[] = [
  fm(
    "geo-dilation-center",
    "dilation-properties.core",
    "Single choice, with a drawn triangle and image, of the scale factor and center of a dilation with scale factor 2, 3, 3/2, 1/2 or 1/3 and a center off the origin, or of the center alone for a stated factor. Does not assess negative scale factors, non-lattice centers or constructing the center.",
  ),
  fm(
    "geo-dilation-line-center",
    "dilation-properties.core",
    "Single choice of the image of a line under a dilation about a lattice center on or off the line, with factor 2, 3, 4 or 1/2. Does not assess dilating a segment or polygon, finding the center, or proofs about dilated lines.",
  ),
  fm(
    "geo-motion-chain",
    "transformation-constructions.core",
    "Single choice of the types of two successive rigid motions from the coordinates of three triangles, using axis and diagonal reflections, quarter-turn rotations about the origin and translations. Does not assess rotations about other points, glide reflections or writing the motion's rule.",
  ),
  fm(
    "geo-reflection-side",
    "transformation-constructions.core",
    "Single choice of the segment that is the image of a named side of a quadrilateral after reflections over the axes and the lines $y=x$ and $y=-x$, with a drawn figure. Does not assess reflections over other lines or the intermediate image.",
  ),
  fm(
    "geo-rigid-statement",
    "transformation-invariants.core",
    "Single choice of the statement that must be true after two to four rigid motions, with an odd or even number of reflections. Does not assess dilations, specific coordinates of the image or proofs of congruence.",
  ),
];
