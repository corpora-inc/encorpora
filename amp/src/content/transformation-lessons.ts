import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const plane: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Points on the coordinate plane",
  paragraphs: [
    "The coordinate plane has a horizontal number line, the $x$-axis, and a vertical number line, the $y$-axis. They cross at 0 on each, a point called the origin. The ordered pair ($x$, $y$) names a point: $x$ tells how far right (positive) or left (negative) of the $y$-axis it is, and $y$ tells how far above (positive) or below (negative) the $x$-axis it is. The point (−4, 3) is 4 units left of the $y$-axis and 3 units above the $x$-axis.",
    "Both axes use the same unit, so one step right is the same length as one step up. A polygon is a closed figure made of straight sides; its corners are its vertices. A label such as $A(−4, 3)$ names vertex $A$ and gives its coordinates.",
  ],
};
const motionTerms: Lesson["sections"][number] = {
  stage: "intuition",
  title: "Transformations and images",
  paragraphs: [
    "A transformation moves every point of the plane to a new point. The figure before the move is the pre-image; the figure after it is the image. The image of a point $A$ is named $A'$, read “A prime”, so the image of triangle $ABC$ is triangle $A'B'C'$, and $A'$ is the image of $A$.",
    "A rigid motion moves a figure without stretching or bending it: every length and every angle stays the same, so the image is congruent to the pre-image, an exact copy in a new position. A translation slides, a reflection flips across a line, and a rotation turns around a fixed point. Each is a rigid motion.",
  ],
};

export const transformationLessons: Lesson[] = [
  {
    id: "coordinate-polygons",
    title: "Side lengths, perimeter and area from coordinates",
    summary:
      "A side whose endpoints share one coordinate is horizontal or vertical; its length is the distance between the other coordinates.",
    templateIds: ["coordinate-side-length", "coordinate-rectangle-measure"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recognize horizontal and vertical sides from the coordinates of their endpoints.",
      "Find side lengths, including sides that cross an axis, and use them for a rectangle's perimeter and area.",
    ],
    sections: [
      plane,
      {
        stage: "intuition",
        title: "Distance around a rectangle",
        paragraphs: [
          "A rectangle has four straight sides and four square corners. Its perimeter is the total distance around all four sides. Opposite sides have equal lengths, so its perimeter is twice its width plus twice its height.",
        ],
      },
      {
        title: "Horizontal and vertical sides",
        paragraphs: [
          "Points with the same $y$-coordinate are the same distance above or below the $x$-axis, so they lie on one horizontal line. A side joining $A(−4, 3)$ and $B(5, 3)$ is horizontal. Its length is the distance between the $x$-coordinates −4 and 5. Points with the same $x$-coordinate lie on one vertical line, and the length is the distance between their $y$-coordinates.",
          "The distance between two numbers is how far apart they are on the number line. When both are on the same side of 0, subtract their distances from 0: from 2 to 7 is 7 − 2 = 5. When they are on opposite sides, the gap passes through 0, so add their distances from 0: from −4 to 5 is 4 + 5 = 9. Both cases equal the larger number minus the smaller: 5 − (−4) = 9.",
        ],
        illustration: "coordinate-side-lengths",
      },
      {
        title: "Perimeter and area of a rectangle",
        paragraphs: [
          "A rectangle has four right angles and opposite sides of equal length. When its sides are horizontal and vertical, one horizontal side gives the width and one vertical side gives the height.",
          "The perimeter is the distance around: add all four sides, or 2 × (width + height). The area is the number of unit squares inside: width × height. The rectangle in the figure is 9 units wide and 5 units tall, so its perimeter is 2 × (9 + 5) = 28 units and its area is 9 × 5 = 45 square units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Rectangle $ABCD$ has vertices $A(−4, 3)$, $B(5, 3)$, $C(5, −2)$ and $D(−4, −2)$. What is its perimeter, in units?",
      steps: [
        "$AB$ joins two points with $y$-coordinate 3, so it is horizontal. −4 and 5 are on opposite sides of the $y$-axis: 4 + 5 = 9.",
        "$BC$ joins two points with $x$-coordinate 5, so it is vertical. 3 and −2 are on opposite sides of the $x$-axis: 3 + 2 = 5.",
        "Opposite sides are equal, so the perimeter is 9 + 5 + 9 + 5 = 2 × (9 + 5) = 28.",
      ],
      answer: "28",
      answerUnit: "units",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Points with the same $y$-coordinate lie on one horizontal line, and points with the same $x$-coordinate on one vertical line; the distance between them is the larger changing coordinate minus the smaller.",
          "A rectangle's perimeter is 2 × (width + height) and its area is width × height.",
        ],
      },
    ],
    pitfalls: [
      "For a side that crosses an axis, do not subtract the distances from 0: from −4 to 5 is 4 + 5 = 9, not 5 − 4 = 1.",
      "Use the coordinate that changes along the side: the $x$-coordinates for a horizontal side, the $y$-coordinates for a vertical one.",
      "Perimeter counts all four sides; width + height is only half of it.",
    ],
    parentGuide:
      "On graph paper, plot (−4, 3) and (5, 3) and count the squares between them. Then ask how the count could be found from the numbers alone, without the grid.",
  },
  {
    id: "coordinate-distance",
    title: "Distance between two points",
    summary:
      "A slanted segment between two grid points completes a right triangle. Its straight-line length comes from the horizontal and vertical changes.",
    templateIds: ["coordinate-distance", "coordinate-distance-exact"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the horizontal and vertical legs of the right triangle under a segment.",
      "Use the Pythagorean theorem to find the exact distance, simplifying a square root when needed.",
    ],
    sections: [
      plane,
      {
        stage: "intuition",
        title: "A right triangle under every segment",
        paragraphs: [
          "A right triangle has one right angle, a square corner. The two sides that form the right angle are the legs, and the longest side, opposite the right angle, is the hypotenuse. The Pythagorean theorem says that for every right triangle, leg² + leg² = hypotenuse².",
          "From $A(−3, −1)$, move horizontally to (5, −1), then vertically to $B(5, 5)$. These moves are the legs of a right triangle whose hypotenuse is $AB$. The horizontal leg is the change in x: 5 − (−3) = 8. The vertical leg is the change in y: 5 − (−1) = 6. So $AB^2 = 8^2 + 6^2 = 64 + 36 = 100$, and $AB = 10$, because 10 × 10 = 100.",
        ],
        illustration: "distance-triangle",
      },
      {
        title: "Exact answers and simplest form",
        paragraphs: [
          "The square root of a number, written √n, is the nonnegative number whose square is $n$. When the sum of the squared legs is not a perfect square, the exact distance is a square root. From (1, 2) to (5, 4), the legs are 4 and 2, so the distance squared is 16 + 4 = 20 and the distance is √20.",
          "A square root is in simplest form when no square factor greater than 1 is left under the root. Because 20 = 4 × 5 and √4 = 2, √20 = 2√5. Check: (2√5)² = 4 × 5 = 20. The distance is a single straight length, so it is shorter than the grid path along the legs: 2√5 is about 4.47, less than 4 + 2 = 6.",
        ],
      },
    ],
    workedExample: {
      prompt: "What is the distance between the points (−3, −1) and (5, 5)?",
      steps: [
        "The horizontal leg is the change in x: 5 − (−3) = 8. The vertical leg is the change in y: 5 − (−1) = 6.",
        "By the Pythagorean theorem, the distance squared is 8² + 6² = 64 + 36 = 100.",
        "The distance is √100 = 10, because 10 × 10 = 100.",
      ],
      answer: "10",
      answerUnit: "units",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For any two points $(x_1,y_1)$ and $(x_2,y_2)$, their distance $d$ satisfies $d^2=(x_2-x_1)^2+(y_2-y_1)^2$. When both coordinate changes are nonzero, the segment is the hypotenuse of a right triangle; if a change is zero, the same formula gives the horizontal or vertical distance.",
          "d = √((x₂ − x₁)² + (y₂ − y₁)²), and √(a²b) = a√b for whole numbers $a$ and $b$.",
        ],
      },
    ],
    pitfalls: [
      "Do not add the legs: 8 + 6 = 14 is the path along the grid, not the straight distance.",
      "Subtracting a negative coordinate adds: the change from −3 to 5 is 5 − (−3) = 8.",
      "The sum of the squares is the distance squared; take its square root to finish.",
    ],
    parentGuide:
      "Mark two points on graph paper and measure the straight line between them with a ruler marked in grid units. Compare the measurement with the square root of the sum of the squared legs.",
  },
  {
    id: "rigid-motions",
    title: "Translations, reflections and rotations",
    summary:
      "A rigid motion moves a figure while keeping every length and angle unchanged. A slide, flip, or turn sends each point to a new point by one coordinate rule.",
    templateIds: ["transformation-image", "identify-rigid-motion"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find image coordinates under a translation, a reflection over an axis and a rotation of 90° or 180° about the origin.",
      "Identify the motion that maps a triangle onto its image by checking every vertex.",
    ],
    sections: [
      plane,
      motionTerms,
      {
        title: "Three motions and their rules",
        paragraphs: [
          "A translation slides every point the same distance in the same direction. Moving 6 units left and 2 units up subtracts 6 from every $x$-coordinate and adds 2 to every $y$-coordinate: $(x, y) \\to (x - 6, y + 2)$.",
          "A reflection over a line flips the figure across it, like a mirror image: each point moves straight across the line, at a right angle to it, to the same distance on the other side. Over the $x$-axis, $x$ stays and $y$ changes sign: ($x$, $y$) → (x, −y). Over the $y$-axis, ($x$, $y$) → (−x, y).",
          "A rotation turns the figure about a fixed point, the center, keeping every point's distance from the center. A half turn (180°) about the origin sends each point to the opposite side: $(x, y)$ → (−x, −y). A quarter turn (90°) counterclockwise sends the point (1, 0) to (0, 1) and (0, 1) to (−1, 0), so $(x, y)$ → (−y, x). A quarter turn clockwise is ($x$, $y$) → (y, −x).",
        ],
        illustration: "rigid-motions-panels",
      },
      {
        title: "Identify a motion by checking every vertex",
        paragraphs: [
          "Labels tell which vertex went where: $A$ goes to $A'$, $B$ to $B'$ and $C$ to $C'$. Write each pair, such as (1, 1) → (−1, 1), and look for one rule that fits all three. If $x$ and $y$ swap places and one changes sign, it is a quarter turn; if only one coordinate changes sign, it is a reflection; if both change sign, it is a half turn; if the same amounts are added to every vertex, it is a translation.",
          "Checking one vertex is not enough. A translation can always carry $A$ onto $A'$, and a reflection can match a vertex that lies near an axis. The motion is the one rule that carries all three vertices onto their images.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ has vertices $A(1, 1)$, $B(4, 1)$ and $C(1, 3)$. It is rotated 90° counterclockwise about the origin to form triangle $A'B'C'$. What are the coordinates of $B'$?",
      steps: [
        "A quarter turn counterclockwise about the origin follows the rule ($x$, $y$) → (−y, x).",
        "For $B(4, 1)$: the new $x$-coordinate is −1 and the new $y$-coordinate is 4.",
        "$B'$ is at (−1, 4), the same distance from the origin as $B$, one quarter turn around.",
      ],
      answer: "(−1, 4)",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "Translation $(x, y)$ → ($x$ + $a$, $y$ + $b$); reflection over the $x$-axis ($x$, $y$) → (x, −y), over the $y$-axis (−x, y); rotation about the origin by 90° counterclockwise (−y, x), 180° (−x, −y), 90° clockwise (y, −x).",
          "A rigid motion is determined by where it sends three vertices of a triangle, so the motion that maps a triangle onto its image is the one rule that fits every vertex.",
        ],
      },
    ],
    pitfalls: [
      "A reflection over the $x$-axis changes the sign of $y$, not $x$: the axis named is the one the points cross.",
      "For a quarter turn, swap the coordinates and change one sign; changing signs without swapping gives a reflection or a half turn.",
      "Check every vertex when identifying a motion; a translation can match one vertex but miss the others.",
    ],
    parentGuide:
      "Cut a triangle from paper, place it on graph paper and trace it. Slide, flip and turn it, tracing each image, and compare the vertex coordinates before and after.",
  },
  {
    id: "dilations-similarity",
    title: "Dilations and similar triangles",
    summary:
      "A dilation resizes a figure from a center by one positive scale factor, keeping angles. Similar figures have the same shape: matched sides share that scale ratio.",
    templateIds: [
      "dilation-image",
      "dilation-scale-factor",
      "similar-triangles-side",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find image coordinates and scale factors of dilations centered at the origin.",
      "Find a missing side of similar triangles from corresponding sides.",
    ],
    sections: [
      plane,
      {
        stage: "intuition",
        title: "One scale for every matched side",
        paragraphs: [
          "A dilation uses a positive multiplier $k$ to move each point farther from or closer to its center. If $k=2$, every side becomes twice as long while the angles stay equal. Figures related by a dilation and a rigid motion are similar. Their corresponding sides match the same corners, and each image side is $k$ times its matching original side.",
        ],
      },
      {
        title: "Dilations change size, not shape",
        paragraphs: [
          "A dilation with center $O$ and scale factor $k$ moves every point $P$ along the ray from $O$ through $P$, to the point $P'$ whose distance from $O$ is $k$ times the distance $OP$. With the center at the origin, both coordinates are multiplied by $k$: ($x$, $y$) → (kx, ky).",
          "In the figure, triangle $ABC$ with $A(2, 1)$, $B(4, 1)$ and $C(2, 3)$ is dilated by 2. The images are $A'(4, 2)$, $B'(8, 2)$ and $C'(4, 6)$, each on the ray from the origin through its point. Every side of the image is 2 times as long, and every angle is unchanged. A scale factor greater than 1 enlarges; one between 0 and 1 reduces.",
          "To find the scale factor from coordinates, divide one image coordinate by its matching original coordinate only when that original coordinate is nonzero. For $A(2,1)$ and $A'(4,2)$, $k=4\\div2=2$.",
        ],
        illustration: "dilation-rays",
      },
      {
        title: "Similar figures and corresponding sides",
        paragraphs: [
          "Two figures are similar when one can be carried onto the other by rigid motions and a dilation. Similar figures have the same shape: corresponding angles are equal, and every side of one is the same number of times its corresponding side in the other. That number is the scale factor.",
          "Triangle $ABC$ ∼ triangle $DEF$ means $A$ corresponds to $D$, $B$ to $E$ and $C$ to $F$, so side $AB$ corresponds to $DE$, $BC$ to $EF$ and $CA$ to $FD$. In the figure, $AB = 4$ and $DE = 6$, so the scale factor from $ABC$ to $DEF$ is 6 ÷ 4 = 3/2. Then $EF = 6 × 3/2 = 9$ and $FD = 5 × 3/2 = 7.5$. Equal numbers of arcs mark corresponding angles.",
        ],
        illustration: "similar-triangles-marked",
      },
    ],
    workedExample: {
      prompt:
        "Triangle $ABC$ is similar to triangle $DEF$, with $A$ corresponding to $D$, $B$ corresponding to $E$ and $C$ corresponding to $F$. In centimeters, $AB = 4$, $BC = 6$, $CA = 5$ and $DE = 6$. What is $EF$, in centimeters?",
      steps: [
        "Corresponding sides join corresponding vertices: $AB$ ↔ $DE$, $BC$ ↔ $EF$ and $CA$ ↔ $FD$.",
        "The scale factor from $ABC$ to $DEF$ is $DE ÷ AB = 6 ÷ 4 = 3/2$.",
        "$EF = BC × 3/2 = 6 × 3/2 = 9$.",
      ],
      answer: "9",
      answerUnit: "cm",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a positive scale factor $k$, a dilation centered at the origin sends $(x,y)$ to $(kx,ky)$.",
          "Such a dilation multiplies every distance by $k$ and preserves every angle; $k>1$ enlarges and $0<k<1$ reduces the figure.",
          "In similar triangles, every side of one is the same multiple, the scale factor, of its corresponding side in the other.",
        ],
      },
    ],
    pitfalls: [
      "A dilation multiplies coordinates by the scale factor; adding the scale factor slides the figure instead.",
      "Match sides by vertex order, not by position on the page: $BC$ corresponds to $EF$ when $B$ ↔ $E$ and $C$ ↔ $F$.",
      "The scale factor from the image back to the original is the reciprocal: 2/3, not 3/2, from $DEF$ to $ABC$.",
    ],
    parentGuide:
      "Photocopy a picture at 150% and measure one length in both copies. Ask which number multiplies every length, and check it on a second length.",
  },
  {
    id: "scale-drawings",
    title: "Scale drawings",
    summary:
      "Every length on a scale drawing is multiplied by the same number to give the actual length; every area by that number squared.",
    templateIds: ["scale-drawing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use a scale to convert lengths from a drawing to actual lengths and back.",
      "Find actual areas by converting side lengths, or by multiplying a drawing's area by the square of the scale.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "What a scale says",
        paragraphs: [
          "This lesson uses multiplication and division with whole numbers, decimals and fractions. A scale drawing, such as a map or floor plan, has the same shape as the real object: every drawing length corresponds to the same positive multiple of actual length. Drawings can be smaller or larger than the object. Its scale states how lengths match: “1 cm represents 2 m” means each centimeter on the drawing stands for 2 meters in reality.",
          "So an actual length is the drawing length times 2, with the unit changed: a wall 4.5 cm long on the plan is 4.5 × 2 = 9 m long. Going back, divide by 2: a wall 7 m long is 7 ÷ 2 = 3.5 cm on the plan. When a scale is “2 cm represents 5 m”, each centimeter stands for 5 ÷ 2 = 5/2 m.",
        ],
      },
      {
        title: "Area grows by the square of the scale",
        paragraphs: [
          "A room drawn 4 cm by 3 cm with the scale 1 cm represents 2 m is actually 8 m by 6 m, so its area is 8 × 6 = 48 square meters. On the plan its area is 4 × 3 = 12 square centimeters.",
          "Each square centimeter of the plan is a square 2 m by 2 m in reality, which is 2 × 2 = 4 square meters. So the actual area is 12 × 4 = 48 square meters: areas are multiplied by the square of the scale, not by the scale. Multiplying 12 by 2 would give 24, only half of the room.",
        ],
        illustration: "scale-drawing-plan",
      },
    ],
    workedExample: {
      prompt:
        "On a floor plan, 1 centimeter represents 2 meters. A rectangular room is 4.5 centimeters by 3 centimeters on the plan. What is its actual area, in square meters?",
      steps: [
        "Convert each side by multiplying by 2: 4.5 × 2 = 9 and 3 × 2 = 6. The room is 9 meters by 6 meters.",
        "Actual area = 9 × 6 = 54 square meters.",
        "Check: the plan area is 4.5 × 3 = 13.5 square centimeters, and 13.5 × 2 × 2 = 54.",
      ],
      answer: "54",
      answerUnit: "square meters",
    },
    closingSections: [
      {
        stage: "formal",
        title: "Precise rule",
        paragraphs: [
          "For a positive scale factor $k$ applied to lengths measured in consistent units, corresponding areas are multiplied by $k^2$.",
        ],
      },
    ],
    pitfalls: [
      "Multiply an area by the square of the scale: 12 square centimeters at 1 cm to 2 m is 48 square meters, not 24.",
      "Going from an actual length back to the drawing, divide by the scale instead of multiplying.",
      "Keep the units straight: drawing lengths are in the drawing's unit, actual lengths in the real unit.",
    ],
    parentGuide:
      "Measure a room with a tape measure and draw it on graph paper with one square for each meter. Count the squares for the area, then check against the measured length times width.",
  },
];

export const transformationMethods: Record<string, ProblemMethod> = {
  "coordinate-side-length": {
    goal: "Find the length of a horizontal or vertical side from its endpoints' coordinates.",
    terms: [
      [
        "side",
        "A horizontal side's endpoints share a $y$-coordinate, so its length is the difference of their $x$-coordinates.",
      ],
      [
        "side",
        "A vertical side's endpoints share an $x$-coordinate, so its length is the difference of their $y$-coordinates.",
      ],
    ],
    method: [
      "Find the coordinate the endpoints share; the other coordinates change.",
      "Same side of 0: subtract their distances from 0. Opposite sides: add them.",
    ],
    watch: "Across an axis, add the distances from 0: from −4 to 5 is 9.",
  },
  "coordinate-rectangle-measure": {
    goal: "Find a rectangle's perimeter or area from its vertices.",
    terms: ["perimeter", "area"],
    method: [
      "Find the width from a horizontal side and the height from a vertical side.",
      "Perimeter = 2 × (width + height); area = width × height.",
    ],
    watch: "Count both widths and both heights in the perimeter.",
  },
  "coordinate-distance": {
    goal: "Find the distance between two points with the Pythagorean theorem.",
    terms: [
      [
        "leg",
        "Here the legs are the changes in $x$ and in $y$, which meet at a right angle.",
      ],
      "hypotenuse",
    ],
    method: [
      "Find the change in $x$ and the change in $y$.",
      "Square each, add, and take the square root.",
    ],
    watch: "Do not add the legs; the straight distance is the hypotenuse.",
  },
  "coordinate-distance-exact": {
    goal: "Find an exact distance as a whole number or a simplified square root.",
    terms: [
      [
        "distance",
        "An exact distance keeps the square root, such as $\\sqrt{20}$, instead of a decimal estimate.",
      ],
      "simplest-radical-form",
    ],
    method: [
      "Find the change in $x$ and the change in $y$.",
      "The distance squared is the sum of their squares.",
      "Take the square root and remove square factors: √(a² × b) = a√b.",
    ],
    watch: "Subtracting a negative coordinate adds to the leg.",
  },
  "transformation-image": {
    goal: "Find where a vertex lands after a translation, reflection or rotation.",
    terms: ["image-transformation", "rigid-motion"],
    method: [
      "Write the motion's coordinate rule: a translation adds, a reflection changes one sign, a rotation swaps or negates.",
      "Apply the rule to the vertex's coordinates.",
      "Check the image on the grid: it should sit where the motion carries the point.",
    ],
    watch: "Over the $x$-axis, $y$ changes sign; over the $y$-axis, $x$ does.",
  },
  "identify-rigid-motion": {
    goal: "Name the single motion that carries a triangle onto its labeled image.",
    terms: ["corresponding"],
    method: [
      "Pair each vertex with its image.",
      "Find the rule that fits all three pairs: added amounts, one sign change, both signs, or a swap.",
    ],
    watch: "Check all three vertices; one matching vertex proves nothing.",
  },
  "dilation-image": {
    goal: "Find a vertex's image under a dilation centered at the origin.",
    terms: ["scale-factor"],
    method: [
      "Find the scale factor and the vertex asked about.",
      "Multiply both of its coordinates by the scale factor.",
      "Check: the image lies on the ray from the origin through the point.",
    ],
    watch: "Multiply by the scale factor; do not add it.",
  },
  "dilation-scale-factor": {
    goal: "Find the scale factor of a dilation centered at the origin.",
    terms: [
      ["dilation", "An enlargement has a scale factor greater than 1."],
      ["dilation", "A reduction has a scale factor between 0 and 1."],
    ],
    method: [
      "Divide an image coordinate by the matching original coordinate.",
      "Check the factor on another vertex.",
    ],
    watch: "Divide image by original, not original by image.",
  },
  "similar-triangles-side": {
    goal: "Find a missing side of similar triangles.",
    terms: ["similar-figures", "corresponding"],
    method: [
      "Pair the sides by vertex order.",
      "Divide a known pair to get the scale factor.",
      "Multiply the matching side by the scale factor.",
    ],
    watch: "Match sides by vertex letters, not by where they appear.",
  },
  "scale-drawing": {
    goal: "Convert between a scale drawing and real lengths or areas.",
    terms: ["scale"],
    method: [
      "Drawing to actual: multiply lengths by the scale; actual to drawing: divide.",
      "For areas, multiply by the square of the scale.",
    ],
    watch: "Areas scale by the square of the scale, not by the scale.",
  },
};

export const transformationPrinciples: Record<string, string> = {
  "coordinate-side-length":
    "Points with the same $y$-coordinate lie on one horizontal line, and points with the same $x$-coordinate on one vertical line; the distance between them is the larger changing coordinate minus the smaller.",
  "coordinate-rectangle-measure":
    "A rectangle's perimeter is 2 × (width + height) and its area is width × height.",
  "coordinate-distance":
    "For any two points $(x_1,y_1)$ and $(x_2,y_2)$, $d^2=(x_2-x_1)^2+(y_2-y_1)^2$; when both coordinate changes are nonzero, their segment is a right triangle's hypotenuse.",
  "coordinate-distance-exact":
    "d = √((x₂ − x₁)² + (y₂ − y₁)²), and √(a²b) = a√b for whole numbers $a$ and $b$.",
  "transformation-image":
    "Translation $(x, y)$ → ($x$ + $a$, $y$ + $b$); reflection over the $x$-axis ($x$, $y$) → (x, −y), over the $y$-axis (−x, y); rotation about the origin by 90° counterclockwise (−y, x), 180° (−x, −y), 90° clockwise (y, −x).",
  "identify-rigid-motion":
    "A rigid motion is determined by where it sends three vertices of a triangle, so the motion that maps a triangle onto its image is the one rule that fits every vertex.",
  "dilation-image":
    "For $k>0$, a dilation centered at the origin sends $(x,y)$ to $(kx,ky)$.",
  "dilation-scale-factor":
    "For $k>0$, a dilation centered at the origin multiplies coordinates by $k$ and every length by $k$.",
  "similar-triangles-side":
    "In similar triangles, every side of one is the same multiple, the scale factor, of its corresponding side in the other.",
  "scale-drawing":
    "For a positive scale factor $k$ applied to lengths in consistent units, corresponding areas are multiplied by $k^2$.",
};
