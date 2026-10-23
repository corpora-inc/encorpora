import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const angleWords: Lesson["sections"][number] = {
  title: "Rays, angles and degrees",
  paragraphs: [
    "A ray starts at a point and goes on forever in one direction. Two rays that start at the same point, the vertex, form an angle. $\\angle AOB$ names the angle whose vertex is $O$ and whose rays pass through $A$ and $B$; the vertex letter is always in the middle. $m\\angle AOB$, or just $\\angle AOB$ in a sentence about size, means its measure in degrees.",
    "A full turn around a point is 360°. Half a turn, a straight angle, is 180°: its two rays point in opposite directions and form a straight line. A quarter turn, a right angle, is 90° and is marked with a small square.",
  ],
};

export const angleTriangleLessons: Lesson[] = [
  {
    id: "angle-relationships",
    title: "Angle relationships",
    summary:
      "Smaller turns that fit together without overlap add to the whole angle.",
    templateIds: ["angle-pair-measure", "angle-equation"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize supplementary, complementary, adjacent and vertical angles.",
      "Write and solve an equation for an unknown angle, including angles given as expressions in $x$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a larger turn from smaller turns",
        paragraphs: [
          "Two angles placed side by side can fill a straight turn or another known angle. When no space is missing or counted twice, their measures add. That gives a way to find an unknown angle.",
        ],
      },
      angleWords,
      {
        title: "Parts add to the whole",
        paragraphs: [
          "Adjacent angles share a vertex and a ray and do not overlap. When adjacent angles fill a larger angle exactly, their measures add to its measure, just as lengths placed end to end add.",
          "Two angles that add to 180° are supplementary; two angles that add to 90° are complementary. Two adjacent angles along a straight line, a linear pair, are supplementary. Angles that fill a full turn add to 360°.",
        ],
        illustration: "angle-pairs",
      },
      {
        title: "Vertical angles are equal",
        paragraphs: [
          "When two lines cross, they form two pairs of vertical angles: angles opposite each other at the crossing. Number the four angles 1, 2, 3 and 4 in order around the crossing, so $\\angle 1$ and $\\angle 3$ are vertical. Each of them forms a straight line with $\\angle 2$, so $\\angle 1$ + $\\angle 2$ = 180° and $\\angle 3$ + $\\angle 2$ = 180°. Both equal 180° − $\\angle 2$, so $\\angle 1$ = $\\angle 3$. In the same way, $\\angle 2$ = $\\angle 4$.",
          "So two crossing lines make only two different measures: an angle and its supplement. If one angle at the crossing is 70°, the angle opposite it is 70° and each of its neighbors is 180° − 70° = 110°.",
        ],
      },
      {
        title: "From a relationship to an equation",
        paragraphs: [
          "When angles are given as expressions such as (3x + 12)°, write the relationship as an equation in $x$: parts of a straight angle add to 180, parts of a right angle add to 90, and vertical angles are equal. Solve the equation, then substitute $x$ back into each expression to find the angles and to check that they fit the relationship.",
          "For vertical angles marked (4x − 6)° and (2x + 30)°, write 4x − 6 = 2x + 30. Subtract 2x from both sides: 2x − 6 = 30. Add 6: 2x = 36, so x = 18. Each angle measures 4(18) − 6 = 66°, and 2(18) + 30 = 66° checks.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Angles in a shared whole",
        paragraphs: [
          "Adjacent angles whose interiors do not overlap add to the angle formed by their outer rays. Angles on a straight line sum to 180 degrees, angles around a point sum to 360 degrees, and opposite angles formed by two intersecting lines are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Points $A$, $O$ and $B$ lie on a straight line, and ray $OC$ is drawn from $O$. $\\angle AOC$ measures (3x + 12)° and $\\angle COB$ measures (2x − 7)°. What is the value of $x$?",
      steps: [
        "$\\angle AOC$ and $\\angle COB$ are a linear pair, so they add to 180°: (3x + 12) + (2x − 7) = 180.",
        "Combine like terms: 5x + 5 = 180.",
        "Subtract 5 from both sides: 5x = 175. Divide by 5: x = 35.",
        "Check: 3(35) + 12 = 117 and 2(35) − 7 = 63; 117 + 63 = 180.",
      ],
      answer: "35",
    },
    pitfalls: [
      "$x$ is not an angle: after solving, substitute it to find a measure if the question asks for one.",
      "Vertical angles are equal; angles side by side along a line add to 180°. Check which pair you have before writing the equation.",
      "Read the middle letter of $\\angle AOC$ as the vertex.",
    ],
    parentGuide:
      "Fold a paper strip into two angles along a ruler's edge and measure both with a protractor; they always add to 180°. Then cross two pencils and compare the opposite angles.",
  },
  {
    id: "triangle-angle-theorems",
    title: "Triangle angles and parallel lines",
    summary:
      "A triangle's three inside angles fit together to make a straight angle.",
    templateIds: [
      "triangle-angle-sum",
      "triangle-exterior-angle",
      "parallel-lines-angle",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use equal and supplementary angle pairs formed by parallel lines and a transversal.",
      "Explain why the angles of a triangle add to 180° and find unknown angles.",
      "Use the exterior angle of a triangle to find unknown angles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The three corners fit a half turn",
        paragraphs: [
          "Cut the three corners from a triangle and place them side by side. They fill a straight line, a half turn. That picture explains why knowing two corner angles lets you find the third.",
        ],
      },
      {
        title: "Parallel lines cut by a transversal",
        paragraphs: [
          "Parallel lines lie in the same flat plane and never meet; arrowheads on two lines mark them parallel. A transversal is a line that crosses both. It makes four angles at each crossing.",
          "Because the lines are parallel, the transversal crosses both at the same tilt. Sliding one crossing along the transversal lands it exactly on the other, so the four angles at one crossing match the four at the other. Angles in matching positions are corresponding angles, and they are equal.",
          "Two more equal pairs follow. Alternate interior angles lie between the parallel lines on opposite sides of the transversal; alternate exterior angles lie outside the lines on opposite sides. Same-side interior angles lie between the lines on the same side of the transversal and add to 180°. At every crossing there are only two measures: an angle and its supplement.",
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
          "The three interior angles of a Euclidean triangle sum to 180 degrees. An exterior angle formed by extending one side equals the sum of the two remote interior angles. With parallel lines, corresponding and alternate interior angles formed by a transversal are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "In triangle $ABC$, side $AB$ is extended past $B$ to point $D$. $\\angle A$ measures 48° and $\\angle CBD$ measures 113°. What is the measure of $\\angle C$, in degrees?",
      steps: [
        "$\\angle CBD$ is an exterior angle; $\\angle A$ and $\\angle C$ are its remote interior angles, so $\\angle CBD = \\angle A + \\angle C$.",
        "$113° = 48° + \\angle C$.",
        "$\\angle C = 113° - 48° = 65°$.",
        "Check with the angle sum: $\\angle B = 180° - 113° = 67°$, and $48° + 67° + 65° = 180°$.",
      ],
      answer: "65",
      answerUnit: "degrees",
    },
    pitfalls: [
      "Corresponding and alternate angles are equal only when the lines are parallel.",
      "An exterior angle equals the two remote angles, not the angle beside it; it and the angle beside it add to 180°.",
      "Add all three angles of the triangle to 180°, including any right angle.",
    ],
    parentGuide:
      "Cut out a paper triangle, tear off its three corners and lay them point to point along a ruler's edge. They always make a straight line.",
  },
  {
    id: "triangle-construction",
    title: "Which triangles exist",
    summary:
      "Three side lengths form a triangle only if the two shorter together exceed the longest.",
    templateIds: [
      "triangle-side-test",
      "triangle-third-side",
      "triangle-conditions",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Decide whether three lengths form a triangle using the triangle inequality.",
      "Find the possible whole-number lengths of a third side.",
      "Decide whether given conditions determine exactly one triangle, more than one, or none.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The ends must meet",
        paragraphs: [
          "Imagine laying down the longest stick as a base. The other two sticks reach from its ends. If together they cannot reach farther than the base's length, their tips cannot meet above it to close a triangle.",
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
          "When two sides $a$ and $b$ are known, the third side $s$ must be shorter than their sum, s < a + b, and longer than their difference, s > a − b for a larger than $b$. For sides 5 cm and 9 cm: 4 < s < 14, so the whole-number lengths 5 through 13 work.",
          "The difference bound comes from the same rule applied to the longer given side: 9 < 5 + s, so s > 4. Both bounds are strict, because a third side of exactly 4 cm or 14 cm would make the three sides lie flat. Counting the whole numbers from 5 through 13 gives 13 − 5 + 1 = 9 possible lengths.",
        ],
      },
      {
        title: "When conditions determine a triangle",
        paragraphs: [
          "Two triangles count as the same when they have the same size and shape, so one can be moved on top of the other. Conditions determine a unique triangle when every triangle meeting them is the same.",
          "Three sides that pass the triangle inequality determine exactly one triangle. Two sides and the angle between them determine exactly one, and so do two angles and the side between them, when the angles add to less than 180°. Three angles that add to 180° fix only the shape: an enlarged copy has the same angles, so infinitely many triangles fit. Two angles that add to 180° or more, three angles whose sum is not 180°, or three sides that fail the triangle inequality give no triangle.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "When three lengths close",
        paragraphs: [
          "Three positive lengths form a nondegenerate triangle exactly when the sum of any two exceeds the third; checking the two shorter against the longest is sufficient. Fixed three side lengths determine one triangle up to rigid motion, while less restrictive data may allow many or none.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Two sides of a triangle measure 6 cm and 10 cm. The third side is a whole number of centimeters. How many different lengths are possible for the third side?",
      steps: [
        "The third side $s$ must be shorter than 6 + 10 = 16.",
        "It must be longer than 10 − 6 = 4, so that 6 + s is more than 10.",
        "The whole numbers from 5 through 15 work: 15 − 5 + 1 = 11 lengths.",
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
      "A flat slice through a solid creates a cross-section whose shape depends on the cut.",
    templateIds: ["cross-section-shape", "cross-section-area"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the cross-section of a right rectangular prism or pyramid cut by a plane.",
      "Find a cross-section's area from the solid's dimensions.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "See the shape inside a cut",
        paragraphs: [
          "Slice a box with a flat plane. The new flat face where the knife passed is a cross-section. Turning the cutting plane can change that face from a rectangle to another polygon.",
        ],
      },
      {
        title: "Solids and their faces",
        paragraphs: [
          "A right rectangular prism is a box: six rectangular faces, with every edge meeting the base at a right angle. A right rectangular pyramid has a rectangular base and four triangular faces that meet at one point, the apex, directly above the center of the base. Its height is the distance from the base straight up to the apex.",
          "A plane is a flat surface that extends without end. Where a plane cuts through a solid, the cut surface is a flat shape called a cross-section.",
        ],
      },
      {
        title: "Each face crossed gives one side",
        paragraphs: [
          "Where the plane crosses a flat face, the cut is a straight segment. So the cross-section is a polygon with one side for every face the plane crosses. A slice parallel to the base of a prism crosses the four side faces: four sides, a copy of the base. A slice standing up from the base of a prism, parallel to one pair of base edges, crosses four faces and copies the faces parallel to it: a rectangle whose sides are a base edge and the height.",
          "A vertical slice of a pyramid through the apex crosses the base and two slanted faces: a triangle whose height is the pyramid's height. A vertical slice that misses the apex crosses the base, two slanted faces and the top of a third: a trapezoid. A slice parallel to the base of a pyramid gives a smaller rectangle; halfway up, each side is half the base edge below it. Cutting off one corner of a prism crosses three faces: a triangle.",
        ],
        illustration: "solid-slices",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "A plane's intersection with a solid",
        paragraphs: [
          "A cross-section is the flat region where a plane cuts a solid. Its boundary comes from the solid's faces that the plane crosses. For a right prism, a slice parallel to a base has the same shape and size as that base when it lies inside the prism.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right rectangular prism is 9 cm long, 4 cm wide and 6 cm tall. A plane slices it perpendicular to its base and parallel to the 9 cm edges of the base. What is the area of the cross-section, in square centimeters?",
      steps: [
        "The plane stands straight up from the base, parallel to the 9 cm edges, so it is parallel to the 9 cm by 6 cm faces.",
        "The cross-section copies those faces: a 9 cm by 6 cm rectangle.",
        "Area = 9 × 6 = 54 square centimeters.",
      ],
      answer: "54",
      answerUnit: "square centimeters",
    },
    pitfalls: [
      "A slice parallel to a face has that face's dimensions, not the base's.",
      "A vertical slice of a pyramid is a triangle only if it passes through the apex.",
      "Name the most specific shape: a square only when all four sides are equal.",
    ],
    parentGuide:
      "Slice a block of cheese or clay parallel to a face, then at a slant through a corner, and name the cut faces before you look.",
  },
];

export const angleTriangleMethods: Record<string, ProblemMethod> = {
  "angle-pair-measure": {
    goal: "Find an unknown angle from the whole it shares with a known angle, or from a vertical pair.",
    terms: [
      ["supplementary", "Two angles whose measures add to 180°."],
      ["complementary", "Two angles whose measures add to 90°."],
      [
        "vertical angles",
        "Opposite angles where two lines cross; they are equal.",
      ],
    ],
    method: [
      "Name the whole the angles fill: a line (180°), a right angle (90°) or a full turn (360°).",
      "Subtract the known angles from the whole.",
      "For vertical angles, copy the measure.",
    ],
    watch:
      "Opposite angles at a crossing are equal; angles side by side on a line add to 180°.",
  },
  "angle-equation": {
    goal: "Write an equation from an angle relationship, solve for $x$, and find an angle if asked.",
    terms: [
      [
        "adjacent angles",
        "Angles that share a vertex and a ray without overlapping.",
      ],
      [
        "linear pair",
        "Adjacent angles along a straight line; they add to 180°.",
      ],
    ],
    method: [
      "Choose the relationship: parts add to the whole, or vertical angles are equal.",
      "Write the equation with the expressions and solve for $x$.",
      "Substitute $x$ into the expression for the asked angle and check.",
    ],
    watch:
      "Answer what is asked: $x$, or the angle's measure after substituting $x$.",
  },
  "triangle-angle-sum": {
    goal: "Find an unknown angle of a triangle, or the value of $x$, from the 180° angle sum.",
    terms: [
      [
        "interior angle",
        "An angle inside the triangle at one of its vertices.",
      ],
    ],
    method: [
      "Write $\\angle A + \\angle B + \\angle C = 180°$ with the given measures or expressions.",
      "Solve for the unknown.",
      "Check that the three angles add to 180°.",
    ],
    watch: "Include every angle, including a right angle, in the sum.",
  },
  "triangle-exterior-angle": {
    goal: "Use an exterior angle and the two remote interior angles to find an unknown.",
    terms: [
      [
        "exterior angle",
        "The angle between one side and the extension of the side next to it.",
      ],
      [
        "remote interior angles",
        "The two interior angles not next to the exterior angle.",
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
    goal: "Find an angle where a transversal crosses two parallel lines.",
    terms: [
      ["transversal", "A line that crosses two other lines."],
      [
        "corresponding angles",
        "Angles in matching positions at the two crossings.",
      ],
      [
        "alternate interior angles",
        "Angles between the lines on opposite sides of the transversal.",
      ],
    ],
    method: [
      "Slide one crossing along the transversal onto the other: matching positions have equal angles.",
      "Decide whether the two marked angles are equal or supplementary.",
      "Write and solve the equation.",
    ],
    watch:
      "Same-side interior angles add to 180°; they are not equal unless both are 90°.",
  },
  "triangle-side-test": {
    goal: "Choose the three lengths that can form a triangle.",
    terms: [
      [
        "triangle inequality",
        "The two shorter sides of a triangle add to more than the longest.",
      ],
    ],
    method: [
      "In each set, find the longest length.",
      "Add the other two and compare with the longest.",
      "Keep the set whose sum is greater.",
    ],
    watch:
      "A sum equal to the longest side gives a flat segment, not a triangle.",
  },
  "triangle-third-side": {
    goal: "Find the greatest, least or number of whole-number lengths for a third side.",
    terms: [
      [
        "triangle inequality",
        "Each side is shorter than the other two together.",
      ],
    ],
    method: [
      "The third side is less than the sum of the given sides.",
      "It is greater than their difference.",
      "Take the whole numbers strictly between those bounds.",
    ],
    watch:
      "Both bounds are strict: the sum and the difference themselves do not work.",
  },
  "triangle-conditions": {
    goal: "Decide whether the conditions determine exactly one triangle, more than one, or none.",
    terms: [
      ["same triangle", "Same size and shape; one fits exactly on the other."],
    ],
    method: [
      "Rule out impossible conditions: angles that cannot add to 180°, or sides failing the triangle inequality.",
      "Three sides, two sides with the angle between them, or two angles with a side fix one triangle.",
      "Angles alone fix only the shape, so many sizes work.",
    ],
    watch: "Three angles that add to 180° give many triangles, not one.",
  },
  "cross-section-shape": {
    goal: "Name the shape where a plane slices a prism or pyramid.",
    terms: [
      ["cross-section", "The flat shape where a plane cuts through a solid."],
      ["apex", "The point of a pyramid, above the center of its base."],
    ],
    method: [
      "List the faces the plane crosses; each gives one straight side.",
      "Compare the sides' directions and lengths.",
      "Choose the most specific name.",
    ],
    watch:
      "A vertical slice of a pyramid that misses the apex is a trapezoid, not a triangle.",
  },
  "cross-section-area": {
    goal: "Find the area of a slice of a prism or pyramid from its dimensions.",
    terms: [
      ["cross-section", "The flat shape where a plane cuts through a solid."],
    ],
    method: [
      "Identify the face the slice copies, or its shape and dimensions.",
      "Use length × width for a rectangle, or ½ × base × height for a triangle.",
    ],
    watch:
      "A vertical slice copies a side face: base edge × height, not length × width.",
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
    "A plane parallel to a face of a prism cuts a copy of that face; a pyramid sliced halfway up has a section with half the base's lengths.",
};
