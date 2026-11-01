import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const angleWords: Lesson["sections"][number] = {
  title: "Rays, angles and degrees",
  paragraphs: [
    "A ray starts at a point and goes on forever in one direction. Two rays that start at the same point form an angle, and that point is called the vertex. The symbol $\\angle$ means “angle”. $\\angle AOB$ names the angle whose vertex is $O$ and whose rays pass through $A$ and $B$. The vertex letter is always in the middle.",
    "An angle's measure is the amount of turn between its rays, counted in degrees, written with a small circle: 90°. $m\\angle AOB$, or just $\\angle AOB$ in a sentence about size, means that measure.",
    "A full turn around a point is 360°. Half a turn, called a straight angle, is 180°: its two rays point in opposite directions and form a straight line. A quarter turn, called a right angle, is 90° and is marked with a small square.",
  ],
};

export const angleTriangleLessons: Lesson[] = [
  {
    id: "angle-relationships",
    title: "Angle relationships",
    summary:
      "An angle is the turn between two rays (straight paths) that start at one point. Angles are measured in degrees: a straight line is a half turn, 180°. Two angles that sit next to each other without overlapping add up to the bigger angle they fill. So if a straight line is split into a 117° angle and another angle, the other is 180° − 117° = 63°. An unknown angle can be found with an equation.",
    templateIds: ["angle-pair-measure", "angle-equation"],
    includeGeneratedRepresentation: false,
    senses: {
      degrees: "degree-angle",
      vertex: "vertex",
      side: "side",
      sides: "side",
      square: "square-shape",
    },
    noLink: [
      "quarter",
      "opposite",
      "whole",
      "parts",
      "part",
      "rule",
      "third",
      "edge",
    ],
    objectives: [
      "Recognize supplementary, complementary, adjacent and vertical angle pairs.",
      "Write and solve an equation for an unknown angle, including angles given as expressions in $x$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a larger turn from smaller turns",
        paragraphs: [
          "A ray starts at a point and goes on in one direction. Two rays that share their starting point make an angle. Its size, the amount of turn between the rays, is measured in degrees, written °.",
          "Two angles placed next to each other can fill a straight line, a half turn of 180°. Such a pair is called a linear pair. Their measures add, because no space is missing and none is counted twice: 117° + 63° = 180°. A letter such as $x$ can stand for an unknown number of degrees.",
        ],
      },
      angleWords,
      {
        title: "Parts add to the whole",
        paragraphs: [
          "Adjacent angles share a vertex (corner point) and a ray, and do not overlap. When adjacent angles fill a larger angle exactly, their measures add to its measure, just as lengths placed end to end add.",
          "Two angles that add to 180° are called supplementary. Two angles that add to 90° are called complementary. Two adjacent angles along a straight line, a linear pair, are supplementary. Angles that fill a full turn add to 360°.",
        ],
        illustration: "angle-pairs",
      },
      {
        title: "Vertical angles are equal",
        paragraphs: [
          "When two lines cross, they form two pairs of vertical angles: angles across from each other at the crossing. Number the four angles 1, 2, 3 and 4 in order around the crossing, so $\\angle 1$ and $\\angle 3$ are vertical. Each of them forms a straight line with $\\angle 2$, so $\\angle 1$ + $\\angle 2$ = 180° and $\\angle 3$ + $\\angle 2$ = 180°. Both equal 180° − $\\angle 2$, so $\\angle 1$ = $\\angle 3$. In the same way, $\\angle 2$ = $\\angle 4$.",
          "So two crossing lines make no more than two different measures: an angle and its supplement. If the lines cross at right angles, all four angles are 90°. If one angle at the crossing is 70°, the angle opposite it is 70° and each of its neighbors is 180° − 70° = 110°.",
        ],
      },
      {
        title: "From a relationship to an equation",
        paragraphs: [
          "An angle can be given as an expression such as $(3x + 12)$°, which means 3 times $x$, plus 12, degrees. Then write the relationship as an equation in $x$. Parts of a straight angle add to 180. Parts of a right angle add to 90. Vertical angles are equal.",
          "Solve the equation, then substitute: put the value of $x$ back into each expression to find the angles. Check that they fit the relationship.",
          "For vertical angles marked $(4x - 6)$° and $(2x + 30)$°, the angles are equal, so $4x - 6 = 2x + 30$. Subtract $2x$ from both sides so $x$ is on one side only: $2x - 6 = 30$. Add 6 to both sides: $2x = 36$. Divide both sides by 2: $x = 18$. Each angle measures $4 \\times 18 - 6 = 66$°, and $2 \\times 18 + 30 = 66$° checks.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Angles in a shared whole",
        paragraphs: [
          "Adjacent angles whose insides do not overlap add to the angle formed by their outer rays. Angles on a straight line add to 180 degrees. Angles around a point add to 360 degrees. Vertical angles, the angles across from each other where two lines cross, are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Points $A$, $O$ and $B$ lie on a straight line, with $O$ between $A$ and $B$, and ray $OC$ is drawn from $O$. $\\angle AOC$ measures (3x + 12)° and $\\angle COB$ measures (2x − 7)°. What is the value of $x$?",
      steps: [
        "$A$, $O$ and $B$ are on a straight line, so $\\angle AOC$ and $\\angle COB$ together fill a straight angle. They add to 180°: $(3x + 12) + (2x - 7) = 180$.",
        "Combine like terms, the $x$ parts and the plain numbers: $3x + 2x = 5x$ and $12 - 7 = 5$. So $5x + 5 = 180$.",
        "Subtract 5 from both sides to leave the $x$ part alone: $5x = 175$. Divide both sides by 5: $x = 35$.",
        "Check by substituting: $3 \\times 35 + 12 = 117$ and $2 \\times 35 - 7 = 63$. Then 117 + 63 = 180, a straight angle.",
      ],
      answer: "35",
    },
    pitfalls: [
      "$x$ is not an angle: after solving, substitute it to find a measure if the question asks for one.",
      "Vertical angles are equal. Angles next to each other along a line add to 180°. Check which pair you have before writing the equation.",
      "Read the middle letter of $\\angle AOC$ as the vertex.",
    ],
    parentGuide:
      "Fold a paper strip into two angles along a ruler's edge and measure both with a protractor; they always add to 180°. Then cross two pencils and compare the opposite angles.",
  },
  {
    id: "triangle-angle-theorems",
    title: "Triangle angles and parallel lines",
    summary:
      "A triangle is a flat shape with three straight sides and three corners. The angle at each corner, inside the triangle, is called an interior angle. Tear off the three corners of a paper triangle and set them side by side: they always fill a straight line, 180°. So if two angles are 48° and 67°, the third is 180° − 48° − 67° = 65°. Parallel lines (lines that never meet) explain why.",
    templateIds: [
      "triangle-angle-sum",
      "triangle-exterior-angle",
      "parallel-lines-angle",
    ],
    includeGeneratedRepresentation: false,
    senses: {
      "corresponding angles": "corresponding-angles",
      degrees: "degree-angle",
      vertex: "vertex",
      side: "side",
      sides: "side",
      square: "square-shape",
    },
    noLink: [
      "unit",
      "opposite",
      "whole",
      "parts",
      "part",
      "rule",
      "third",
      "edge",
    ],

    objectives: [
      "Use the equal angle pairs, and the pairs that add to 180°, formed where a line crosses two parallel lines.",
      "Explain why the angles of a triangle add to 180° and find unknown angles.",
      "Use the exterior angle of a triangle to find unknown angles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The three corners fit a half turn",
        paragraphs: [
          "An angle is the amount of turn between two lines that meet at a corner. It is measured in degrees, the unit for turns, written °. Cut the three corners from a paper triangle and place them next to each other. They fill a straight line, a half turn of 180 degrees.",
          "If one side of the triangle is extended past a corner, the angle outside the triangle is called an exterior angle. It equals the two triangle angles away from it, added together. The symbol $\\angle$ means “angle”, and in $\\angle CBD$ the middle letter $B$ names the corner.",
        ],
      },
      {
        title: "Parallel lines cut by a transversal",
        paragraphs: [
          "Parallel lines lie in the same flat surface and never meet, like the two rails of a straight track. Arrowheads on two lines mark them parallel. A transversal is a line that crosses both. It makes four angles at each crossing.",
          "Because the lines are parallel, the transversal crosses both at the same tilt. Sliding one crossing along the transversal lands it exactly on the other, so the four angles at one crossing match the four at the other. Angles in matching positions are called corresponding angles, and they are equal.",
          "Two more equal pairs follow. Alternate interior angles lie between the parallel lines, on different sides of the transversal. Alternate exterior angles lie outside the lines, on different sides. Same-side interior angles lie between the lines on the same side of the transversal, and they add to 180°.",
          "At every crossing there are no more than two measures: an angle and its supplement, the angle that adds with it to 180°.",
        ],
        illustration: "parallel-angle-pairs",
      },
      {
        title: "Why a triangle's angles add to 180°",
        paragraphs: [
          "A triangle has three sides and three interior angles. Draw the line through $C$ parallel to side $AB$. Along that line, three angles at $C$ fill a straight angle: the triangle's $\\angle C$ in the middle, and one on each side.",
          "The angle beside $\\angle C$ on the $A$ side is an alternate interior angle to $\\angle A$, using transversal $AC$, so it equals $\\angle A$. In the same way, the angle on the $B$ side equals $\\angle B$. The three angles fill a straight angle, so $\\angle A$ + $\\angle B$ + $\\angle C = 180$°. It is the same as tearing off the three corners of a paper triangle and laying them side by side along a line.",
        ],
        illustration: "triangle-sum-line",
      },
      {
        title: "Exterior angles",
        paragraphs: [
          "Extend side $AB$ past $B$ to a point $D$. The angle $\\angle CBD$ between the extension and side $BC$ is an exterior angle of the triangle. $\\angle A$ and $\\angle C$ are its remote interior angles: the two interior angles not at $B$.",
          "The exterior angle and $\\angle B$ form a straight angle, so $\\angle CBD = 180° - \\angle B$. The angle sum gives $\\angle A + \\angle C = 180° - \\angle B$ too. So an exterior angle equals the sum of the two remote interior angles: $\\angle CBD$ = $\\angle A$ + $\\angle C$.",
        ],
        illustration: "exterior-angle",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Triangle and exterior angles",
        paragraphs: [
          "The three interior angles of a triangle drawn on a flat surface add to 180 degrees. An exterior angle formed by extending one side equals the sum of the two remote interior angles, the two inside angles not next to it. When a transversal crosses parallel lines, corresponding angles are equal and alternate interior angles are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, side $AB$ is extended past $B$ to point $D$. $\\angle A$ measures 48° and $\\angle CBD$ measures 113°. What is the measure of $\\angle C$, in degrees?",
      steps: [
        "Side $AB$ is extended past $B$, so $\\angle CBD$ is an exterior angle at $B$. The two inside angles not at $B$, $\\angle A$ and $\\angle C$, are its remote interior angles. An exterior angle equals their sum: $\\angle CBD = \\angle A + \\angle C$.",
        "Put in the known measures: $113° = 48° + \\angle C$.",
        "Subtract 48° from both sides to find $\\angle C$: $\\angle C = 113° - 48° = 65°$.",
        "Check with the angle sum: $\\angle B = 180° - 113° = 67°$, and $48° + 67° + 65° = 180°$.",
      ],
      answer: "65",
      answerUnit: "degrees",
    },
    pitfalls: [
      "Corresponding and alternate angles are equal only when the lines are parallel.",
      "An exterior angle equals the two remote angles added, not the inside angle next to it. It and that next-door angle add to 180°.",
      "The three angles of a triangle must total 180°, so include every angle, even a right angle.",
    ],
    parentGuide:
      "Cut out a paper triangle, tear off its three corners and lay them point to point along a ruler's edge. They always make a straight line.",
  },
  {
    id: "triangle-construction",
    title: "Which triangles exist",
    summary:
      "A triangle is a flat shape with three straight sides. Not every three lengths can make one. Try sticks 3, 4 and 8 cm long: the two short ones together reach only 7 cm, so their ends cannot meet over the 8 cm stick. Three lengths make a triangle only when the two shorter ones add to more than the longest. This rule is called the triangle inequality.",
    templateIds: [
      "triangle-side-test",
      "triangle-third-side",
      "triangle-conditions",
    ],
    includeGeneratedRepresentation: false,
    senses: {
      "more than": "more-than",
      difference: "difference-subtract",
      degrees: "degree-angle",
      vertex: "vertex",
      side: "side",
      sides: "side",
      square: "square-shape",
    },
    noLink: [
      "base",
      "units",
      "opposite",
      "whole",
      "parts",
      "part",
      "rule",
      "third",
      "edge",
    ],
    objectives: [
      "Decide whether three lengths can form a triangle, by comparing the two shorter ones with the longest.",
      "Find the possible whole-number lengths of a third side.",
      "Decide whether given conditions determine exactly one triangle, more than one, or none.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The ends must meet",
        paragraphs: [
          "A triangle has three straight sides joined end to end. Imagine laying down the longest of three sticks as a base. The other two sticks reach up from its two ends. If together they cannot reach farther than the base's length, their tips cannot meet above it to close a triangle.",
        ],
      },
      {
        title: "The triangle inequality",
        paragraphs: [
          "Lay the longest length flat. The other two must start at its ends and meet above it. If together they are shorter than the longest, they cannot reach each other. If together they equal it exactly, they meet only by lying flat along it, which is a segment, not a triangle. Only when they are longer can they rise and meet.",
          "So three lengths form a triangle exactly when the two shorter ones add to more than the longest. Checking that one sum is enough: the longest length plus any other is automatically more than the third.",
        ],
        illustration: "side-strips",
      },
      {
        title: "Possible third sides",
        paragraphs: [
          "The sign $<$ means “is less than” and $>$ means “is greater than”. When two sides $a$ and $b$ are known, with $a$ the larger, the third side $s$ must be shorter than their sum: $s < a + b$. It must also be longer than their difference: $s > a - b$. For sides 5 cm and 9 cm, $4 < s < 14$, so the whole-number lengths 5 through 13 work.",
          "The difference rule comes from the same test, with the longer given side as the longest: $9 < 5 + s$, so $s > 4$. Both bounds are strict, because a third side of exactly 4 cm or 14 cm would make the three sides lie flat. Counting the whole numbers from 5 through 13 gives 13 − 5 + 1 = 9 possible lengths.",
        ],
      },
      {
        title: "When conditions determine a triangle",
        paragraphs: [
          "Two triangles count as the same when they have the same size and shape, so one can be moved on top of the other. Such triangles are called congruent. Conditions fix exactly one triangle when every triangle that meets them is congruent to every other.",
          "Three sides that pass the triangle inequality determine exactly one triangle. Two sides and the angle between them determine exactly one, and so do two angles and the side between them, when the angles add to less than 180°. Three angles that add to 180° fix only the shape: an enlarged copy has the same angles, so infinitely many triangles fit. Two angles that add to 180° or more, three angles whose sum is not 180°, or three sides that fail the triangle inequality give no triangle.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "When three lengths close",
        paragraphs: [
          "Three positive lengths form a triangle that is not flat exactly when the sum of any two is greater than the third. Checking the two shorter against the longest is enough. Three fixed side lengths give exactly one triangle, apart from moving, turning or flipping it. Fewer conditions may allow many triangles, or none.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two sides of a triangle measure 6 cm and 10 cm. The third side is a whole number of centimeters. How many different lengths are possible for the third side?",
      steps: [
        "Call the third side $s$. The two given sides must reach farther than $s$, so $s$ must be shorter than 6 + 10 = 16.",
        "If $s$ and 6 are the two shorter sides, together they must reach past 10. So $s$ must be longer than 10 − 6 = 4.",
        "The whole numbers longer than 4 and shorter than 16 are 5 through 15. 4 and 16 themselves would make the sides lie flat.",
        "Count them: 15 − 5 + 1 = 11 lengths. Add 1 because both 5 and 15 are included.",
      ],
      answer: "11",
    },
    pitfalls: [
      "When the two shorter sides add to exactly the longest, there is no triangle.",
      "Three angles never fix a triangle's size.",
      "Compare the sum of the two shorter sides with the longest, not any two sides with any third.",
    ],
    parentGuide:
      "Cut straws to 3, 4 and 8 units, then 4, 4 and 8, then 5, 6 and 8. Try to make a triangle with each set before measuring the sums.",
  },
  {
    id: "solid-cross-sections",
    title: "Slicing prisms and pyramids",
    summary:
      "A solid is a shape that takes up space, like a box or a ball. Slice straight through a block of cheese and look at the cut: that flat shape is called a cross-section. Its shape depends on the cut. A slice of a box parallel to its bottom (running the same way, never meeting it) is a rectangle the same size as the bottom. A pyramid is a solid with a flat bottom and sloping faces that meet at a tip. A slice of a pyramid straight down through its tip is a triangle.",
    templateIds: ["cross-section-shape", "cross-section-area"],
    includeGeneratedRepresentation: false,
    senses: {
      solid: "solid-shape",
      plane: "plane",
      edge: "edge",
      edges: "edge",
      face: "face-solid",
      faces: "face-solid",
      base: "base-shape",
      side: "side",
      sides: "side",
      square: "square-shape",
    },
    noLink: ["center", "third", "half"],
    objectives: [
      "Name the cross-section when a flat cut slices a box-shaped prism or a pyramid.",
      "Find a cross-section's area from the solid's dimensions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "See the shape inside a cut",
        paragraphs: [
          "A rectangular prism is a box with six rectangular faces, the flat surfaces of the solid. A rectangle is a four-sided shape with four square corners. Slice the box with a flat cut: the new flat face where the cut passed is called a cross-section.",
          "A plane is a flat surface that goes on without end, like an endless sheet of glass. A plane perpendicular to the base (the face the solid stands on) stands straight up from it, at a right angle. A parallel plane runs the same way as the base without ever meeting it.",
        ],
      },
      {
        title: "Solids and their faces",
        paragraphs: [
          "A right rectangular prism is a box. It has six rectangular faces, and its side faces stand straight up from its base. A right rectangular pyramid has a rectangular base and four triangular faces that meet at one point, the apex, directly above the center of the base. Its height is the distance from the base straight up to the apex.",
          "A plane is a flat surface that extends without end. Where a plane cuts through a solid, the cut surface is a flat shape called a cross-section.",
        ],
      },
      {
        title: "Each face crossed gives one side",
        paragraphs: [
          "Where the plane crosses a flat face, the cut is a straight segment, a straight piece of line. So the cross-section is a polygon, a flat shape with straight sides, with one side for every face the plane crosses. A slice of a box parallel to its base crosses the four side faces. So it has four sides, and it is a copy of the base. A slice standing straight up from the base of a box, parallel to one pair of base edges, also crosses four faces. It copies the side faces parallel to it: a rectangle whose sides are a base edge and the height.",
          "Now take a pyramid with a rectangular base. A vertical slice, standing straight up and parallel to one base edge, through the apex crosses the base and two slanted faces: a triangle whose height is the pyramid's height. The same kind of slice that misses the apex crosses the base and three slanted faces. That makes a trapezoid, a four-sided shape with exactly one pair of parallel sides. A slice parallel to the base of a pyramid gives a smaller rectangle; halfway up, each side is half the base edge below it. Cutting off one corner of a box crosses three faces: a triangle.",
        ],
        illustration: "solid-slices",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A plane's intersection with a solid",
        paragraphs: [
          "A cross-section is the flat region where a plane cuts a solid. Its outline comes from the faces of the solid that the plane crosses. For a right prism, a slice parallel to a base, inside the prism, has the same shape and size as that base.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right rectangular prism is 9 cm long, 4 cm wide and 6 cm tall. A plane slices it perpendicular to its base and parallel to the 9 cm edges of the base. What is the area of the cross-section, in square centimeters?",
      steps: [
        "The plane stands straight up from the base and runs along the 9 cm edges. So it runs the same way as the two side faces that are 9 cm long and 6 cm tall.",
        "In a box, a cut parallel to a face makes a copy of that face. So the cross-section is a rectangle 9 cm long and 6 cm tall.",
        "The area of a rectangle is length times width: 9 × 6 = 54 square centimeters.",
      ],
      answer: "54",
      answerUnit: "square centimeters",
    },
    pitfalls: [
      "In a box, a slice parallel to a side face has that face's length and height, not the base's length and width.",
      "A vertical slice of a pyramid, parallel to a base edge, is a triangle only if it passes through the apex.",
      "Name the most exact shape: call it a square only when all four sides are equal.",
    ],
    parentGuide:
      "Slice a block of cheese or clay parallel to a face, then at a slant through a corner, and name the cut faces before you look.",
  },
];

export const angleTriangleMethods: Record<string, ProblemMethod> = {
  "angle-pair-measure": {
    goal: "Find an unknown angle from the bigger angle it fills with a known angle, or from a vertical pair.",
    terms: ["supplementary", "complementary-angles", "vertical-angles"],
    senses: { degrees: "degree-angle", vertex: "vertex" },
    noLink: ["parts", "side", "unit", "square", "opposite", "whole"],
    intuition:
      "A ray is a straight path that starts at a point and goes on in one direction. An angle is the turn between two rays that start at one point. It is measured in degrees, the unit for turns, written °. Angles next to each other add up to the angle they fill: a straight line is 180°, a right angle (square corner) is 90°, and a full turn is 360°. Where two lines cross, the angles across from each other, called vertical angles, are equal.",
    method: [
      "Name what the angles fill together: a straight line (180°), a right angle (90°) or a full turn (360°).",
      "Subtract the known angles from the whole.",
      "For vertical angles, copy the measure.",
    ],
    watch:
      "Angles across from each other at a crossing are equal. Angles next to each other on a line add to 180°.",
  },
  "angle-equation": {
    goal: "Write an equation from an angle relationship, solve for $x$, and find an angle if asked.",
    intuition:
      "A ray starts at a point and goes on in one direction. Two rays make an angle at their shared starting point. It is measured in degrees, the unit for turns. Angles next to each other on a straight line add to 180 degrees. Where two lines cross, the angles across from each other are equal. A letter such as $x$ stands for an unknown number, and $(3x + 12)$° means 3 times $x$, plus 12, degrees.",
    terms: ["adjacent-angles", "linear-pair"],
    senses: { degrees: "degree-angle" },
    noLink: ["sides", "unit", "parts", "opposite", "whole"],
    method: [
      "Choose the relationship: parts add to the whole, or vertical angles are equal.",
      "Write the equation with the expressions and solve for $x$.",
      "Substitute $x$ into the expression for the asked angle and check.",
    ],
    watch:
      "Answer what is asked: $x$, or the angle's measure after substituting $x$.",
  },
  "triangle-angle-sum": {
    noLink: ["sides", "side", "unit"],
    goal: "Find an unknown angle of a triangle, or the value of $x$, using the fact that a triangle's three angles add to 180°.",
    terms: ["interior-angle"],
    senses: { degrees: "degree-angle" },
    intuition:
      "A triangle has three straight sides and three corners. The angle inside each corner is an interior angle. Angles are measured in degrees, the unit for turns, written °. In every triangle, the three interior angles add to 180°, a straight line's worth of turn.",
    method: [
      "Write $\\angle A + \\angle B + \\angle C = 180°$ with the given measures or expressions.",
      "Solve for the unknown.",
      "Check that the three angles add to 180°.",
    ],
    watch: "Include every angle, including a right angle, in the sum.",
  },
  "triangle-exterior-angle": {
    noLink: ["terms"],
    goal: "Use a triangle's exterior angle, the angle outside one corner, and the two inside angles away from it to find an unknown.",
    senses: { degrees: "degree-angle", side: "side" },
    intuition:
      "Extend one side of a triangle past a corner. The angle between the extension and the next side is an exterior angle. The two inside angles at the other corners are its remote interior angles. The exterior angle equals those two added together.",
    terms: [
      "exterior-angle",
      [
        "exterior-angle",
        "The remote interior angles are the two inside angles not next to it; they add up to the exterior angle.",
      ],
    ],
    method: [
      "Identify the exterior angle and its two remote interior angles.",
      "Write exterior angle = sum of the remote interior angles.",
      "Solve for the unknown.",
    ],
    watch:
      "The interior angle next to the exterior angle is its supplement, not one of the addends.",
  },
  "parallel-lines-angle": {
    goal: "Find an angle where a transversal, a line crossing two parallel lines, meets them.",
    intuition:
      "Angles are measured in degrees, the unit for turns. Parallel lines run the same way and never meet. A line crossing both, called a transversal, makes four angles at each crossing. Angles in matching positions are equal. Take one angle at each crossing, on different sides of the transversal. They are equal when both are between the parallel lines, or both are outside them. Inside angles on the same side add to 180 degrees.",
    senses: {
      "corresponding angles": "corresponding-angles",
      degrees: "degree-angle",
    },
    noLink: ["sides", "side", "unit", "opposite"],
    terms: ["transversal", "corresponding-angles", "alternate-interior-angles"],
    method: [
      "Slide one crossing along the transversal onto the other: matching positions have equal angles.",
      "Decide whether the two marked angles are equal or supplementary.",
      "Write and solve the equation.",
    ],
    watch:
      "Same-side interior angles add to 180°; they are not equal unless both are 90°.",
  },
  "triangle-side-test": {
    goal: "Choose the set of three lengths that can form a triangle.",
    terms: ["triangle-inequality"],
    senses: { "more than": "more-than", side: "side" },
    intuition:
      "A triangle has three straight sides joined end to end. Lay the longest side flat. The other two must reach from its ends and meet above it. They can only meet if together they are longer than the longest side.",
    method: [
      "In each set, find the longest length.",
      "Add the other two and compare with the longest.",
      "Keep the set whose sum is greater.",
    ],
    watch:
      "A sum equal to the longest side gives a flat segment, not a triangle.",
  },
  "triangle-third-side": {
    goal: "Two sides of a triangle are given. Find the greatest, least or number of whole-number lengths for the third side.",
    terms: ["triangle-inequality"],
    senses: {
      "more than": "more-than",
      side: "side",
      sides: "side",
      difference: "difference-subtract",
    },
    noLink: ["third"],
    intuition:
      "In any triangle, two sides together must be longer than the third side, or their ends cannot meet. So with sides 6 and 10, the third side must be less than 6 + 10 = 16 and more than 10 − 6 = 4.",
    method: [
      "The third side is less than the sum of the given sides.",
      "It is greater than their difference, the larger minus the smaller.",
      "Take the whole numbers strictly between those two limits, not the limits themselves.",
    ],
    watch:
      "Both bounds are strict: the sum and the difference themselves do not work.",
  },
  "triangle-conditions": {
    noLink: ["parts", "third", "rule", "impossible"],
    goal: "Decide whether the given sides and angles fit exactly one triangle, more than one, or none.",
    terms: ["congruent"],
    senses: {
      "more than": "more-than",
      side: "side",
      sides: "side",
      degrees: "degree-angle",
    },
    intuition:
      "Triangles with the same size and shape, called congruent, count as one. Some measures fix exactly one triangle, some fit many, and some fit none. A triangle's three angles always add to 180°, and its two shorter sides must add to more than the longest.",
    method: [
      "Rule out impossible conditions: angles that cannot add to 180°, or two shorter sides that do not add to more than the longest.",
      "Three sides, two sides with the angle between them, or two angles with a side fix one triangle.",
      "Angles alone fix only the shape, so many sizes work.",
    ],
    watch: "Three angles that add to 180° give many triangles, not one.",
  },
  "cross-section-shape": {
    noLink: ["third", "opposite"],
    goal: "Name the shape where a plane slices a prism or pyramid.",
    intuition:
      "A solid is a shape that takes up space. A plane is a flat cut that goes on without end. A cross-section is the flat shape left where a plane cuts a solid. A prism has two matching ends joined by flat faces, like a box. A pyramid has one base and flat faces meeting at its tip, called the apex. Trace which faces the cut crosses to see the new shape.",
    terms: ["cross-section", "apex"],
    senses: {
      plane: "plane",
      solid: "solid-shape",
      edges: "edge",
      edge: "edge",
      square: "square-shape",
      face: "face-solid",
      faces: "face-solid",
      base: "base-shape",
      side: "side",
      sides: "side",
    },
    method: [
      "List the faces the plane crosses; each gives one straight side.",
      "Compare the sides' directions and lengths.",
      "Choose the most exact name for the shape.",
    ],
    watch:
      "A vertical slice of a pyramid, parallel to a base edge, that misses the apex (the tip) is a trapezoid: a four-sided shape with one pair of parallel sides.",
  },
  "cross-section-area": {
    noLink: ["square", "center", "whole", "vertex", "side"],
    goal: "Find the area of a slice of a prism or pyramid from its dimensions.",
    intuition:
      "A plane is a flat surface that goes on forever. A cross-section is the flat shape where a plane slices a solid, a shape that takes up space. A rectangular prism is a box. A cut parallel to one of its faces (running the same way, never meeting it) makes a copy of that face. Area measures the flat space the cut face covers.",
    terms: ["cross-section"],
    senses: {
      plane: "plane",
      solid: "solid-shape",
      face: "face-solid",
      faces: "face-solid",
      base: "base-shape",
      edge: "edge",
    },
    method: [
      "Identify the face the slice copies, or its shape and dimensions.",
      "Use length × width for a rectangle, or $\\tfrac{1}{2}$ × base × height for a triangle.",
    ],
    watch:
      "In a box, a vertical slice parallel to a side face copies that face: multiply that face's base edge by the box's height.",
  },
};

export const angleTrianglePrinciples: Record<string, string> = {
  "angle-pair-measure":
    "Adjacent angles that fill a larger angle add to its measure, and vertical angles are equal.",
  "angle-equation":
    "An angle relationship is an equation: parts add to the whole they fill, and vertical angles are equal.",
  "triangle-angle-sum": "The interior angles of every triangle add to 180°.",
  "triangle-exterior-angle":
    "An exterior angle of a triangle equals the sum of the two remote interior angles.",
  "parallel-lines-angle":
    "When a transversal crosses parallel lines, corresponding, alternate interior and alternate exterior angles are equal, and same-side interior angles add to 180°.",
  "triangle-side-test":
    "Three lengths form a triangle exactly when the two shorter ones add to more than the longest.",
  "triangle-third-side":
    "A triangle's third side is greater than the difference of the other two and less than their sum.",
  "triangle-conditions":
    "Three sides, two sides with their included angle, or two angles with their included side determine one triangle; angles alone determine only the shape.",
  "cross-section-shape":
    "A plane meets each flat face it crosses in a segment, so a cross-section has one side for each face crossed.",
  "cross-section-area":
    "In a box, a plane parallel to a face cuts a copy of that face. A pyramid sliced halfway up, parallel to its base, has a cross-section whose sides are half as long as the base's sides.",
};
