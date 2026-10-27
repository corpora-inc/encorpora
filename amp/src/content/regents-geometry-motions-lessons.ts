import type { FacetMapping } from "./coverage";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

export const regentsGeometryMotionMethods: Record<string, ProblemMethod> = {
  "geo-dilation-center": {
    goal: "Find the scale factor and the center of a dilation from a figure and its image.",
    intuition:
      "A dilation stretches or shrinks a figure from a fixed point, its center. Every point moves along a line through the center, and every distance from the center is multiplied by the same scale factor. The center is the one point that does not move.",
    terms: [
      [
        "center of dilation",
        "The fixed point from which every point of the figure is stretched or shrunk.",
      ],
      [
        "scale factor",
        "The number that multiplies every distance from the center.",
      ],
    ],
    method: [
      "Draw lines through two pairs of corresponding points, such as $A$ and $A'$, and $B$ and $B'$.",
      "The lines cross at the center of dilation.",
      "Compare the distance from the center to $A'$ with the distance to $A$: that ratio is the scale factor.",
    ],
    watch:
      "A factor greater than 1 enlarges and a factor between 0 and 1 reduces; do not use the reciprocal. The center is not always the origin and not always a vertex.",
  },
  "geo-dilation-line-center": {
    goal: "Find the image of a line under a dilation whose center is not the origin, on the line or off it.",
    intuition:
      "A dilation sends a line to a parallel line, or to itself. If the center is on the line, every point moves along the line, so the line does not change. If the center is off the line, the image is a different line with the same slope.",
    terms: [
      ["parallel", "Lines with the same slope, which never meet."],
      ["image", "The figure after the dilation."],
    ],
    method: [
      "Test whether the center satisfies the line's equation.",
      "If it does, the image is the same line.",
      "If not, keep the slope and dilate one point of the line about the center to find the new intercept.",
    ],
    watch:
      "The slope never changes. Multiplying the intercept by the scale factor is correct only when the center is the origin.",
  },
  "geo-motion-chain": {
    goal: "Name the type of each rigid motion in a sequence from the coordinates of three triangles.",
    intuition:
      "A reflection reverses the order of the labels around a triangle, from counterclockwise to clockwise. A translation slides every vertex by the same amount. A rotation keeps the order of the labels but turns the sides.",
    terms: [
      [
        "rigid motion",
        "A translation, reflection or rotation, which keeps lengths and angle measures.",
      ],
      [
        "orientation",
        "The order, clockwise or counterclockwise, of the labels around a figure.",
      ],
    ],
    method: [
      "For each step, compare how the vertices move.",
      "Equal moves of every vertex mean a translation.",
      "Reversed label order means a reflection; the same order with turned sides means a rotation.",
    ],
    watch:
      "Check each step separately and keep the order of the steps. Reversing the order of two different motions gives a different answer.",
  },
  "geo-reflection-side": {
    goal: "Follow the endpoints of a side through two reflections to name its image.",
    intuition:
      "A reflection sends each point to its mirror image across a line. A side is carried by its endpoints, so the image of a side joins the images of its endpoints. Doing two reflections means applying them one after the other.",
    terms: [
      [
        "reflection",
        "A flip across a line, which sends $(x,y)$ to $(x,-y)$ over the $x$-axis and to $(-x,y)$ over the $y$-axis.",
      ],
      [
        "image of a side",
        "The segment between the images of its two endpoints.",
      ],
    ],
    method: [
      "Reflect each endpoint over the first line, then over the second.",
      "Find which labeled points the results land on.",
      "The image of the side joins those two labeled points.",
    ],
    watch:
      "Apply the reflections in the stated order. The labels of the final figure need not follow the alphabet of the original.",
  },
  "geo-rigid-statement": {
    goal: "Decide which statement must be true after a sequence of rigid motions.",
    intuition:
      "Rigid motions move a figure without changing its size or shape: lengths and angles stay the same, so the image is congruent. Things that can change are the position, the direction of sides, and the order of labels around the figure.",
    terms: [
      [
        "congruent",
        "The same size and shape, so one can be moved onto the other by rigid motions.",
      ],
      ["corresponding", "Matching parts of the original and its image."],
    ],
    method: [
      "List what a rigid motion keeps: lengths, angle measures, area.",
      "Test each statement against that list.",
      "Count the reflections: an odd number reverses the order of the labels, an even number restores it.",
    ],
    watch:
      "Sides need not stay parallel to their images, and coordinates change. Similar is weaker than congruent.",
  },
};

export const regentsGeometryMotionPrinciples: Record<string, string> = {
  "geo-dilation-center":
    "A dilation with center $O$ and scale factor $k>0$ sends each point $P$ to $P'$ on ray $OP$ with $OP'=k\\cdot OP$. In coordinates, $P'=O+k(P-O)$, so $O=\\frac{P'-kP}{1-k}$ for $k\\ne1$.",
  "geo-dilation-line-center":
    "A dilation sends a line to a parallel line or to itself. It sends the line to itself exactly when the center is on the line. For the line $y=mx+b$, center $(c,d)$ and factor $k$, the image is $y=mx+b'$ with $b'=(1-k)(d-mc)+kb$.",
  "geo-motion-chain":
    "Translations and rotations preserve orientation and reflections reverse it. A translation sends every vertex by the same vector; a rotation about a point turns every side by the same angle.",
  "geo-reflection-side":
    "A reflection is a function on points, so the image of a segment is the segment between the images of its endpoints. A composition of reflections is applied right to left in function notation and in the order stated in words.",
  "geo-rigid-statement":
    "A rigid motion preserves distance, so it preserves angle measure and area, and the image of a figure is congruent to it. The composition of $n$ reflections reverses orientation exactly when $n$ is odd.",
};

export const regentsGeometryMotionLessons = [
  chainLesson({
    id: "regents-geometry-dilation-centers",
    title: "Dilations about any center",
    summary:
      "Find a dilation's scale factor and center from a figure and its image, and the image of a line.",
    templateIds: ["geo-dilation-center", "geo-dilation-line-center"],
    objectives: [
      "Locate the center of a dilation where lines through corresponding points cross.",
      "Find the image of a line when the center is on the line or off it, and is not the origin.",
    ],
    openingTitle: "The center is the point that does not move",
    opening: [
      "A dilation moves every point along a line through its center. The point and its image are on the same line through the center, so such lines meet at the center. The distance from the center is multiplied by the scale factor.",
      "A line through the center is sent onto itself. A line that misses the center is sent to a parallel line.",
    ],
    example: {
      prompt:
        "A dilation with center $(1, 2)$ and scale factor 2 is applied. Find the image of $A=(3, 3)$, and the image of the line $y=x+1$.",
      steps: [
        "$A'=(1,2)+2\\cdot(3-1,\\,3-2)=(1,2)+(4,2)=(5,4)$.",
        "The center $(1,2)$ satisfies $y=x+1$, since $2=1+1$.",
        "So the line passes through the center, and its image is the same line, $y=x+1$.",
      ],
      answer: "$A'=(5,4)$; the line is unchanged",
    },
    methodTitle: "Lines through pairs, then the ratio",
    method: [
      "Draw the lines through $A$ and $A'$ and through $B$ and $B'$ to find the center.",
      "Divide a distance from the center to an image point by the distance to its point for the factor.",
      "For a line, test whether the center is on it, then keep the slope and move one point if it is not.",
    ],
    formalTitle: "Dilations in coordinates",
    formal: [
      "With center $O$ and factor $k$, $P'=O+k(P-O)$. The center is the only fixed point when $k\\ne1$.",
      "A dilation preserves angle measure and sends each line to a parallel line, so slopes do not change.",
    ],
    pitfalls: [
      "An enlargement has a scale factor greater than 1, not its reciprocal.",
      "The center is not always the origin.",
      "The slope of a line never changes; the intercept changes only when the center is off the line.",
    ],
    parentGuide:
      "Ask your learner to draw one line through a point and its image and say what the other lines through the center must do.",
  }),
  chainLesson({
    id: "regents-geometry-rigid-motion-sequences",
    title: "Sequences of rigid motions",
    summary:
      "Name the motions between triangles, follow a side through reflections, and say what a sequence preserves.",
    templateIds: [
      "geo-motion-chain",
      "geo-reflection-side",
      "geo-rigid-statement",
    ],
    objectives: [
      "Tell a translation, a reflection and a rotation apart from coordinates.",
      "Follow endpoints through two motions and state what every rigid motion preserves.",
    ],
    openingTitle: "Same size, same shape",
    opening: [
      "A rigid motion is a translation, a reflection or a rotation. It moves a figure without changing any length or angle.",
      "To tell the motions apart, look at the order of the labels around the figure. A reflection reverses it. A translation moves every vertex the same way. A rotation keeps the order but turns the sides.",
    ],
    example: {
      prompt:
        "Triangle $ABC$ has $A(1,2)$, $B(4,2)$, $C(1,4)$. It is reflected over the $y$-axis to $DEF$, then $DEF$ is translated 5 units down. Find the vertices of $GHI$ and describe the sequence.",
      steps: [
        "Reflect over the $y$-axis: $D(-1,2)$, $E(-4,2)$, $F(-1,4)$.",
        "Translate down 5: $G(-1,-3)$, $H(-4,-3)$, $I(-1,-1)$.",
        "The sequence is a reflection followed by a translation. Lengths and angles are the same throughout, so $GHI$ is congruent to $ABC$.",
      ],
      answer: "a reflection followed by a translation",
    },
    methodTitle: "Compare each pair of triangles",
    method: [
      "For each step, compare the labels' order and the motion of the vertices.",
      "To follow a side, apply the motions to both endpoints in order.",
      "A statement is true after any sequence if every single motion preserves it.",
    ],
    formalTitle: "Preserved properties",
    formal: [
      "A rigid motion preserves distance, angle measure and area. So the image is congruent to the original. Parallelism with the image, the coordinates and the order of the labels are not preserved in general.",
      "An even number of reflections restores the order of the labels, and an odd number reverses it.",
    ],
    pitfalls: [
      "The order of two different motions matters.",
      "Congruent is stronger than similar: rigid motions never change size.",
      "A rotation is not a reflection: it keeps the order of the labels.",
    ],
    parentGuide:
      "Have your learner cut out a paper triangle, label the corners, and slide, flip and turn it to see what changes.",
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
