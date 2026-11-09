import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for the rigid-motion property types
 * (8.G.A.1): measure a figure and its image on the coordinate plane and see
 * that a slide, flip or turn keeps lengths, lines, parallel sides and angles.
 */

const senses = {
  image: "image-transformation",
  images: "image-transformation",
  square: "square-number",
  squares: "square-number",
  squared: "square-number",
};
const noLink = ["change", "changes", "turns"];

export const rigidMotionChecksMethods: Record<string, ProblemMethod> = {
  "rigid-motion-measure-verify": {
    goal: "Measure a figure and its image after a slide, flip or turn, and choose what the measurements show the motion kept.",
    intuition:
      "A rigid motion moves a figure without stretching or bending it, like tracing paper that is lifted and set down. A translation slides the figure, a reflection flips it over a line, and a rotation turns it about a point. The moved figure is called the image. Its corners have new coordinates, so you can measure it and compare.",
    senses,
    noLink,
    terms: [
      "rigid-motion",
      "translation",
      "reflection",
      "rotation",
      "image-transformation",
      "slope",
      "parallel",
      "pythagorean-theorem",
      "converse",
    ],
    method: [
      "For a length, count the change in $x$ and the change in $y$ between the two points, then use the Pythagorean theorem: length $= \\sqrt{(\\text{change in } x)^2 + (\\text{change in } y)^2}$.",
      "For a slope, divide the change in $y$ by the change in $x$. Equal slopes mean the points are on one line, or the two sides are parallel.",
      "For a right angle, square the three side lengths. If the two smaller squares add up to the largest, the angle across from the longest side is a right angle.",
      "Choose the claim that says the motion kept the length, the line, the parallel sides or the right angle, for every figure.",
    ],
    watch:
      "Compute every measurement from the coordinates. A slope can change under a turn or a flip while the two slopes stay equal to each other.",
  },
  "rigid-motion-property-claims": {
    goal: "Select the statements that are true of a quadrilateral's image after a slide, flip or turn.",
    intuition:
      "A slide, flip or turn never changes a length, an angle's measure or whether two lines are parallel. Other things can change: where the figure is, the slopes of its sides, and, after a flip, the order its corners go around. So some statements must be true, and the others need checking with the coordinates.",
    senses,
    noLink,
    terms: [
      "rigid-motion",
      "image-transformation",
      "parallel",
      "orientation",
      "quadrilateral",
    ],
    method: [
      "Mark as true each statement that says a length, an angle or a parallel pair stayed the same.",
      "Check a numbered length or angle against the original figure: a sum of the legs, an angle plus the turn, or the angle at the wrong corner is false.",
      "Check slopes, the order of the corners and the area with the image's coordinates.",
    ],
    watch:
      "Parallel to each other is kept. Parallel to where the side was is not, after a turn or a flip over a slanted line.",
  },
  "rigid-motion-image-check": {
    goal: "Choose the graph whose quadrilateral could be the image of a parallelogram after a slide, flip or turn.",
    intuition:
      "An image after a slide, flip or turn has every side length, every angle and every parallel pair of the original. A figure that looks close is not enough. Measure one side, check one pair of sides for parallel, and compare a diagonal, a segment between opposite corners, to test the angles.",
    senses,
    noLink,
    terms: [
      "rigid-motion",
      "image-transformation",
      "parallelogram",
      "diagonal",
      "parallel",
    ],
    method: [
      "Find the length of $AB$ and of $AD$ from the coordinates.",
      "In each graph, measure $PQ$ and $PS$. Rule out a graph where a length is different.",
      "Check that $SR$ is parallel to $PQ$: the change from $S$ to $R$ points the same way as the change from $P$ to $Q$.",
      "Compare the diagonal $QS$ with $BD$. Equal sides with a different diagonal mean a different angle.",
    ],
    watch:
      "A mirror image is still an image: a flip is a rigid motion, so letters that go around the other way do not rule a figure out.",
  },
  "rigid-motion-image-flaw": {
    goal: "Choose the measured fact that settles whether a quadrilateral could be the image of a parallelogram after a slide, flip or turn.",
    intuition:
      "To test a possible image, measure instead of looking. A slide, flip or turn keeps every side length, every angle and every pair of parallel sides. One mismatch is enough to say no. If nothing is different, the figure could be the image.",
    senses,
    noLink,
    terms: [
      "rigid-motion",
      "image-transformation",
      "parallelogram",
      "diagonal",
      "parallel",
    ],
    method: [
      "Find $AB$ and $PQ$ from the coordinates and compare them.",
      "Check whether $SR$ is parallel to $PQ$, and compare the diagonal $QS$ with $BD$ or the corner at $P$ with the corner at $A$.",
      "Choose the statement whose numbers match your measurements. If every check matches, choose yes.",
    ],
    watch:
      "Test each statement's numbers against your own measurements: a statement can name a mismatch that is not really there.",
  },
};

export const rigidMotionChecksPrinciples: Record<string, string> = {
  "rigid-motion-measure-verify":
    "A rigid motion (a translation, reflection or rotation) takes every segment to a segment of the same length, every line to a line, every pair of parallel lines to parallel lines, and every angle to an angle of the same measure. Measured on the coordinate plane, lengths come from the Pythagorean theorem, lines and parallels from equal slopes, and right angles from its converse.",
  "rigid-motion-property-claims":
    "A rigid motion keeps lengths, angle measures, parallel pairs and area. It can change position, slopes and, for a reflection, the orientation: the order in which the corners go around.",
  "rigid-motion-image-check":
    "A quadrilateral can be the image of another after a rigid motion only when all four side lengths and both diagonals match in order; then every angle and parallel pair matches too. A reflection gives a mirror image, which still qualifies.",
  "rigid-motion-image-flaw":
    "One measured difference in a length, an angle or a parallel pair proves a figure is not the image under a rigid motion. When the side lengths and both diagonals all match in order, the figure could be the image.",
};

export const rigidMotionChecksLessons: Lesson[] = [
  chainLesson({
    id: "rigid-motion-checks-lesson",
    title: "What a slide, flip or turn keeps",
    summary:
      "A slide, flip or turn moves a figure without stretching it. Measure a figure and its image on the coordinate plane: lengths stay the same, points on a line stay on a line, parallel sides stay parallel and right angles stay right angles.",
    senses,
    noLink,
    templateIds: [
      "rigid-motion-measure-verify",
      "rigid-motion-property-claims",
      "rigid-motion-image-check",
      "rigid-motion-image-flaw",
    ],
    objectives: [
      "Measure lengths, slopes and right angles before and after a translation, reflection or rotation.",
      "Decide which statements about an image must be true, and whether a figure could be an image.",
    ],
    openingTitle: "Tracing paper never stretches",
    opening: [
      'A rigid motion moves a figure without stretching, shrinking or bending it. A translation slides it. A reflection flips it over a line, like a mirror. A rotation turns it about a point. The moved figure is called the image, and its corners are named with a prime mark: $A\'$ is said "A prime".',
      "On a coordinate plane you can check what the motion kept. Count the change in $x$ and the change in $y$ between two corners. Those two changes are the legs of a right triangle, a triangle with a square corner. The Pythagorean theorem says the squares of the legs add up to the square of the longest side, so the length is $\\sqrt{(\\text{change in } x)^2 + (\\text{change in } y)^2}$.",
      "The slope of a segment is its change in $y$ divided by its change in $x$. Points lie on one line when the slopes between them are equal. Two lines are parallel, never meeting, when their slopes are equal.",
    ],
    example: {
      prompt:
        "Segment $AB$ has endpoints $A(1, 2)$ and $B(4, 6)$. It is reflected over the $y$-axis to $A'(-1, 2)$ and $B'(-4, 6)$. Did the reflection keep the length?",
      steps: [
        "From $A$ to $B$ go 3 right and 4 up. By the Pythagorean theorem, $AB = \\sqrt{3^2 + 4^2} = \\sqrt{25} = 5$.",
        "From $A'$ to $B'$ go 3 left and 4 up. The direction changed, but the legs are still 3 and 4, so $A'B' = \\sqrt{25} = 5$.",
        "Both lengths are 5. The flip moved the segment without stretching it, and the same is true for every segment.",
      ],
      answer: "Yes: $A'B' = AB = 5$",
    },
    methodTitle: "Measure, then compare",
    method: [
      "Lengths: use the change in $x$ and the change in $y$ with the Pythagorean theorem. Compare the original with the image.",
      "Lines and parallel sides: compute slopes. Equal slopes keep points on one line and keep sides parallel, even when the slope itself changes after a turn or a flip.",
      "Right angles: square the three side lengths. If the two smaller squares add up to the largest, the angle across from the longest side is a right angle. This is the converse of the Pythagorean theorem: the theorem read backward.",
      "To test a possible image, compare side lengths, one parallel pair and a diagonal. One difference rules it out.",
    ],
    formalTitle: "Properties of rigid motions",
    formal: [
      "Translations, reflections and rotations take lines to lines and segments to segments of the same length.",
      "They take angles to angles of the same measure, and parallel lines to parallel lines.",
      "They keep area. A reflection reverses orientation, the order in which the corners go around; a translation or rotation keeps it.",
    ],
    pitfalls: [
      "Deciding by eye instead of computing a length, slope or angle from the coordinates.",
      "Thinking a turn adds its own angle to the figure's angles, or that a flip opens an angle the other way.",
      'Confusing "parallel to each other" with "parallel to where the side was".',
      "Rejecting a mirror image: a flip is a rigid motion.",
    ],
    parentGuide:
      "Ask your learner to compute one length before and after the motion instead of judging by eye. Then ask what changed, such as position or slope, and what stayed the same.",
  }),
];

const facet = "rigid-motion-properties.core";
export const rigidMotionChecksFacetMappings: FacetMapping[] = [
  {
    templateId: "rigid-motion-measure-verify",
    facetId: facet,
    extent: "partial",
    rationale:
      "Measures a segment's length, three points' slopes, two parallel sides' slopes or a triangle's squared sides on integer coordinates before and after a stated translation, reflection or rotation about the origin, then chooses the claim that the motion kept the length, line, parallel pair or right angle. General angles are not measured.",
  },
  {
    templateId: "rigid-motion-property-claims",
    facetId: facet,
    extent: "partial",
    rationale:
      "Selects the true statements about a trapezoid's or parallelogram's image: kept lengths and angles, parallel sides, area, parallel to the original side, and orientation, against taxicab lengths, an angle plus the turn and the angle at the wrong corner. The number of true statements is shown.",
  },
  {
    templateId: "rigid-motion-image-check",
    facetId: facet,
    extent: "partial",
    rationale:
      "Chooses the one graph whose quadrilateral is congruent in order to a parallelogram, against decoys that change one length, one angle or one parallel pair. The motion is not named, and the true image is a mirror image in a large share of items.",
  },
  {
    templateId: "rigid-motion-image-flaw",
    facetId: facet,
    extent: "partial",
    rationale:
      "Chooses the measured fact that settles whether one quadrilateral could be a parallelogram's image: a length, a diagonal or right angle, a parallel pair, or that everything matches. It does not ask the learner to name or perform the motion.",
  },
];
