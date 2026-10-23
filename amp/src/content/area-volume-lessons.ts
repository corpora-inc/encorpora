import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const areaMeaning: Lesson["sections"][number] = {
  title: "Area counts unit squares",
  paragraphs: [
    "This lesson uses whole-number and fraction multiplication. Area is the amount of flat surface a shape covers. It is measured in square units: a square centimeter is a square 1 cm on each side. A rectangle 5 cm long and 3 cm wide holds 3 rows of 5 unit squares, so its area is 5 × 3 = 15 square centimeters.",
    "Cutting a shape into pieces and moving the pieces does not change the total area, as long as no piece overlaps another and no gap is left. Every area method in this lesson rests on that fact: rearrange or split a shape into rectangles and triangles whose areas you can find.",
  ],
};
const baseAndHeight: Lesson["sections"][number] = {
  title: "Base and height",
  paragraphs: [
    "Any side of a triangle or parallelogram can be called the base. The height that goes with it is the distance from the base to the opposite vertex or side, measured along a line perpendicular to the base. Perpendicular means meeting at a right angle, a square corner, marked in figures with a small square.",
    "The height is usually not a side. In a slanted shape it is drawn as a dashed segment inside the shape; in an obtuse triangle, which has one angle wider than a right angle, it can land outside the shape on the base extended as a dashed line. A slanted side is always longer than the height, so using it gives too large an area.",
  ],
};
const volumeMeaning: Lesson["sections"][number] = {
  title: "Volume counts unit cubes",
  paragraphs: [
    "Volume is the amount of space a solid fills. It is measured in cubic units: a cubic centimeter is a cube 1 cm on each edge. A rectangular prism is a box shape whose six faces are rectangles; its length, width and height are its three edge lengths.",
    "A prism 4 cm long, 3 cm wide and 2 cm tall holds layers of 4 × 3 = 12 unit cubes, and there are 2 layers, so its volume is 4 × 3 × 2 = 24 cubic centimeters. In general, volume = length × width × height, which is the same as the area of the base times the height.",
  ],
};
const circleFacts: Lesson["sections"][number] = {
  title: "Radius, diameter and circle area",
  paragraphs: [
    "The radius $r$ of a circle is the distance from its center to the circle; the diameter is the distance across through the center, so the diameter is $2 \\times r$. The number $\\pi$ (pi), about 3.14, is the ratio of any circle's circumference to its diameter.",
    "A circle's area is $\\pi \\times r \\times r$, written $\\pi r^2$. A circle of radius 3 cm has area $\\pi \\times 3^2 = 9\\pi$ square centimeters. An exact answer keeps $\\pi$ as a symbol: $9\\pi$. When a problem says to use 3.14 for $\\pi$, multiply: 3.14 × 9 = 28.26, an approximate value.",
  ],
};

export const areaVolumeLessons: Lesson[] = [
  {
    id: "triangle-area-base-height",
    title: "Area of a triangle",
    summary:
      "A triangle covers half of a parallelogram with the same base and height.",
    templateIds: ["triangle-area-base-height"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why a triangle's area is half the product of a base and its height.",
      "Pick the height that is perpendicular to the base, ignoring slanted sides, including when the height falls outside the triangle.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two matching triangles make a larger shape",
        paragraphs: [
          "Make a copy of a triangle and fit the two together into a parallelogram, a four-sided shape with opposite sides parallel. Each triangle covers half of it. Choose a side as the base; the triangle's height is the perpendicular distance from that side's line to the opposite corner.",
        ],
      },
      areaMeaning,
      baseAndHeight,
      {
        title: "Why a triangle is half a parallelogram",
        paragraphs: [
          "A parallelogram is a four-sided shape whose opposite sides are parallel. Cut a right triangle off one end along a height and slide it to the other end: the pieces form a rectangle with the same base and height. So a parallelogram's area is base × height, like a rectangle's.",
          "Turn a copy of a triangle halfway around and place it against the original along one side, as in the figure. The two copies fill a parallelogram with the triangle's base and height, without gaps or overlaps. Each triangle is half of it: area = 1/2 × base × height. For base 8 cm and height 5 cm, the parallelogram is 8 × 5 = 40 square centimeters and the triangle is 40 ÷ 2 = 20 square centimeters.",
        ],
        illustration: "av-triangle-half",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Half of a parallelogram",
        paragraphs: [
          "Two congruent copies of a triangle can form a parallelogram with the same base and perpendicular height. Its area is base times height, so the triangle's area is half that product, regardless of where the height meets the base line.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A triangle has a base of 14 centimeters. The dashed height from the opposite vertex to the base is 12 centimeters, and the slanted sides are 13 centimeters and 15 centimeters. What is its area, in square centimeters?",
      steps: [
        "The height must be perpendicular to the base, so use the dashed height, 12 cm. The slanted sides are not used.",
        "Two copies of the triangle make a parallelogram with base 14 and height 12: 14 × 12 = 168.",
        "The triangle is half of it: 168 ÷ 2 = 84.",
      ],
      answer: "84",
      answerUnit: "square centimeters",
    },
    pitfalls: [
      "Do not multiply a slanted side by the base; the height is the perpendicular distance.",
      "Remember the 1/2: base × height alone is the area of the whole parallelogram.",
      "In an obtuse triangle, the height may land outside the triangle; it is still the distance to the line of the base.",
    ],
    parentGuide:
      "Cut a rectangle of paper along one diagonal. Show that the two triangles match exactly, so each is half the rectangle. Then cut a slanted triangle and a copy, and fit them into a parallelogram.",
  },
  {
    id: "polygon-area-decompose",
    title: "Area by splitting into rectangles and triangles",
    summary:
      "Find a polygon's area by adding the areas of pieces that cover it without gaps.",
    templateIds: ["polygon-area-decompose"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the area of a parallelogram by rearranging it into a rectangle.",
      "Find the area of a trapezoid or pentagon by splitting it into triangles and rectangles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut a hard shape into familiar pieces",
        paragraphs: [
          "A slanted or many-sided shape may be hard to cover with squares directly. A trapezoid has one pair of parallel sides. Cut such a shape into rectangles or triangles whose areas you can find; each triangle's area is half its base times its perpendicular height. The pieces together cover exactly the original region.",
        ],
      },
      areaMeaning,
      {
        title: "Parallelograms and trapezoids",
        paragraphs: [
          "A parallelogram has two pairs of parallel sides. Cut along a height, a segment perpendicular to the base, and move the triangle from one end to the other: the result is a rectangle with the same base and height. A parallelogram with base 9 cm and height 4 cm has area 9 × 4 = 36 square centimeters.",
          "A trapezoid has exactly one pair of parallel sides, called its bases; the height is the perpendicular distance between them. A diagonal, a segment joining opposite corners, splits it into two triangles. Both triangles have the trapezoid's height, and their bases are the two parallel sides. For parallel sides 10 and 6 and height 4: 1/2 × 10 × 4 + 1/2 × 6 × 4 = 20 + 12 = 32.",
        ],
        illustration: "av-polygon-split",
      },
      {
        title: "Shapes made of familiar pieces",
        paragraphs: [
          "Many polygons, shapes with straight sides, can be split along a line you draw into a rectangle and a triangle. A pentagon shaped like a house is a rectangle with a triangle on top. A rectangle 8 m wide and 5 m tall has area 8 × 5 = 40; a roof triangle with base 8 m and height 3 m has area 1/2 × 8 × 3 = 12; the pentagon's area is 40 + 12 = 52 square meters.",
          "When a figure gives the total height instead of the triangle's height, subtract: total height 8 m minus wall height 5 m leaves a triangle height of 8 − 5 = 3 m. Check that the pieces together cover the shape exactly once.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Area adds across pieces",
        paragraphs: [
          "If a region is partitioned into finitely many pieces without gaps or overlaps, its area is the sum of their areas. Rearranging those pieces without stretching them preserves the total area.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A trapezoid has parallel sides of 14 meters and 8 meters, and the distance between them is 5 meters. What is its area, in square meters?",
      steps: [
        "A diagonal splits the trapezoid into two triangles, each 5 m tall.",
        "The triangle on the 14 m side: 1/2 × 14 × 5 = 35. The triangle on the 8 m side: 1/2 × 8 × 5 = 20.",
        "Add the parts: 35 + 20 = 55.",
      ],
      answer: "55",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Use the perpendicular height, not a slanted side, for every triangle and parallelogram.",
      "A trapezoid's two triangles have different bases but the same height.",
      "If a figure gives a total height, subtract the rectangle's part to get the triangle's height.",
    ],
    parentGuide:
      "Draw a trapezoid on grid paper, cut it out and cut along a diagonal. Count the squares in each triangle and compare with 1/2 × base × height for each.",
  },
  {
    id: "net-surface-area",
    title: "Surface area from a net",
    summary: "A solid's surface area is the total area of its outside faces.",
    templateIds: ["net-surface-area"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Identify the faces of a rectangular prism, triangular prism or square pyramid in its net.",
      "Find surface area by adding the areas of all the faces.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Unfold every outside face",
        paragraphs: [
          "Imagine opening a solid along its edges until its flat faces lie side by side. That pattern is a net. The surface area is the area of all its outside faces, counted once. A square pyramid has one square base and four triangular faces, each half its base times its perpendicular height.",
        ],
      },
      {
        title: "Faces and nets",
        paragraphs: [
          "This lesson uses the areas of rectangles and triangles: a rectangle's area is length × width, and a triangle's is 1/2 × base × height. A solid's faces are the flat surfaces that bound it. A net is the flat pattern you get by cutting along some edges and unfolding the faces; folding the net along its dashed lines rebuilds the solid.",
          "Surface area is the total area of all the faces, measured in square units. Unfolding moves faces without stretching them, so the area of the net equals the surface area of the solid.",
        ],
        illustration: "av-prism-net",
      },
      {
        title: "Prisms and pyramids",
        paragraphs: [
          "A rectangular prism has six rectangular faces in three matching pairs: top and bottom, front and back, and the two ends. For a box 5 cm long, 3 cm wide and 2 cm tall, the pairs are 5 × 3 = 15, 5 × 2 = 10 and 3 × 2 = 6, so the surface area is 2 × 15 + 2 × 10 + 2 × 6 = 30 + 20 + 12 = 62 square centimeters.",
          "A triangular prism has two triangular ends and three rectangles; each rectangle is as long as the prism and as wide as one side of the triangle. A square pyramid has a square base and four matching triangles that meet at the top. The height of each triangle, measured on the face from the middle of a base edge to the top, is called the slant height.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Every face contributes once",
        paragraphs: [
          "A net unfolds a solid's surface without changing the area of any face. Its total area is the sum of the areas of all distinct faces; shared edges contribute no area.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square pyramid has a base 6 inches on each side. Each triangular face has a base of 6 inches and a height of 5 inches. What is its surface area, in square inches?",
      steps: [
        "The base is a square: 6 × 6 = 36.",
        "Each triangle: 1/2 × 6 × 5 = 15. Four triangles: 4 × 15 = 60.",
        "Add all five faces: 36 + 60 = 96.",
      ],
      answer: "96",
      answerUnit: "square inches",
    },
    pitfalls: [
      "Count every face: a rectangular prism has 6, a triangular prism 5 and a square pyramid 5.",
      "Use 1/2 × base × height for triangles; leaving out the 1/2 doubles them.",
      "For a pyramid, use the height of the triangular face, not the height of the pyramid itself.",
    ],
    parentGuide:
      "Unfold an empty cereal box along its seams. Measure each rectangle, find its area and add. Match each face to its partner on the opposite side of the box.",
  },
  {
    id: "unit-fraction-cube-packing",
    title: "Packing a prism with fraction cubes",
    summary:
      "Count equal small cubes to measure volume when box edges are fractions of a unit.",
    templateIds: ["unit-fraction-cube-packing"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the cubes with a unit-fraction edge that fill a rectangular prism.",
      "Show that the cube count times one cube's volume equals length × width × height.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fill a box with tiny equal cubes",
        paragraphs: [
          "A rectangular prism is a box. A cube whose edge is one half of a foot is much smaller than a one-foot cube. It takes two along each direction, or eight in all, to fill one cubic foot. Counting small cubes measures the prism's volume, the space it holds.",
        ],
      },
      volumeMeaning,
      {
        title: "Small cubes with fraction edges",
        paragraphs: [
          "A unit fraction has numerator 1, such as 1/2. A cube with edges of 1/2 cm fits 2 times along each edge of a 1 cm cube, so 2 × 2 × 2 = 8 of them fill it, as the figure shows. One small cube is 1/8 of a cubic centimeter: 1/2 × 1/2 × 1/2 = 1/8.",
          "To count small cubes along an edge, divide the edge by the small edge: along 2 1/2 cm, 5/2 ÷ 1/2 = 5 cubes fit. A prism 2 1/2 cm by 1 1/2 cm by 1 cm holds 5 × 3 × 2 = 30 half-centimeter cubes, so its volume is 30 × 1/8 = 30/8 = 15/4 cubic centimeters.",
        ],
        illustration: "av-cube-packing",
      },
      {
        title: "Why length × width × height still works",
        paragraphs: [
          "Multiplying the edges directly gives the same result: 5/2 × 3/2 × 1 = 15/4. The cube count multiplies the numerators, 5 × 3 × 2, and each small cube contributes 1/8 = 1/(2 × 2 × 2), which divides by the denominators. So the formula volume = length × width × height holds for fraction edges as well as whole ones.",
          "Edges of thirds or quarters work the same way: a cube with edge 1/3 has volume 1/3 × 1/3 × 1/3 = 1/27, and 27 of them fill a unit cube.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Small cubes measure volume",
        paragraphs: [
          "For positive whole $n$, a cube of edge $1/n$ unit has volume $1/n^3$ cubic unit, and $n^3$ such cubes fill a unit cube. Counting equal small cubes therefore agrees with multiplying a prism's three edge lengths.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangular prism is $1\\tfrac{1}{2}$ feet long, 1 foot wide and 2 feet tall. It is packed with cubes that have edges of $\\tfrac{1}{2}$ foot. How many cubes fill it, and what is its volume, in cubic feet?",
      steps: [
        "Along each edge: 3/2 ÷ 1/2 = 3 cubes, 1 ÷ 1/2 = 2 cubes and 2 ÷ 1/2 = 4 cubes.",
        "The prism holds 3 × 2 × 4 = 24 cubes.",
        "Each cube is 1/2 × 1/2 × 1/2 = 1/8 cubic foot, so the volume is 24 × 1/8 = 3.",
        "Check: 3/2 × 1 × 2 = 3.",
      ],
      answer: "3",
      answerUnit: "cubic feet",
    },
    pitfalls: [
      "A cube with edge 1/2 is not half a unit cube; it is 1/8 of it, because all three edges are halved.",
      "Count cubes along an edge by dividing by the small edge, not by multiplying.",
      "The cube count and the volume are different answers: the volume is the count times one cube's volume.",
    ],
    parentGuide:
      "Use sugar cubes or building blocks as half-unit cubes. Build a 1-unit cube from 8 of them, then build a box 3 blocks by 2 by 2 and find its volume both by counting and by multiplying the edges.",
  },
  {
    id: "fraction-edge-volume",
    title: "Volume with fraction edges",
    summary:
      "Multiplying a box's three edge lengths gives its volume even when the lengths are fractions.",
    templateIds: ["fraction-edge-volume"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the volume of a rectangular prism whose edges are fractions or mixed numbers.",
      "Find a missing edge from the volume and the other two edges.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The layers can be fractional",
        paragraphs: [
          "A box that is one half unit wide can still be filled with smaller cubes. Count the cubes across, along, and upward in a shared small unit; multiplying the three edge lengths gives its volume, the space it holds. A mixed number such as $2\\tfrac{1}{2}$ is two wholes and one half.",
        ],
      },
      volumeMeaning,
      {
        title: "Multiplying fraction edges",
        paragraphs: [
          "A mixed number such as 2 1/4 means 2 + 1/4. Write it as a fraction first: 2 1/4 = 9/4. To multiply fractions, multiply the numerators and multiply the denominators, then simplify by dividing the top and bottom by a common factor.",
          "For a box 2 1/4 ft long, 2/3 ft wide and 2 ft tall: 9/4 × 2/3 × 2 = 36/12 = 3 cubic feet. The figure shows why this matches packing with small cubes: the formula counts the small cubes and scales by the volume of one.",
        ],
        illustration: "av-cube-packing",
      },
      {
        title: "Finding a missing edge",
        paragraphs: [
          "If the volume and two edges are known, the third edge is the volume divided by the product of the other two, because volume = (length × width) × height. Dividing by a fraction is multiplying by its reciprocal, the fraction turned upside down: ÷ 3/2 is × 2/3.",
          "A box with volume 6 cubic meters, length 2 m and width 3/2 m has height 6 ÷ (2 × 3/2) = 6 ÷ 3 = 2 m. Check by multiplying back: 2 × 3/2 × 2 = 6.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Volume with fractional edges",
        paragraphs: [
          "For a right rectangular prism with positive edge lengths $l,w,h$ in the same unit, volume is $lwh$ cubic units. If volume and two edge lengths are known, the third equals volume divided by the product of the two known lengths.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A box is $2\\tfrac{1}{2}$ feet long, $1\\tfrac{1}{3}$ feet wide and $\\tfrac{3}{4}$ foot tall. What is its volume, in cubic feet?",
      steps: [
        "Write the mixed numbers as fractions: 2 1/2 = 5/2 and 1 1/3 = 4/3.",
        "Multiply: 5/2 × 4/3 × 3/4 = 60/24.",
        "Simplify: 60/24 = 5/2, which is 2 1/2.",
      ],
      answer: "5/2",
      answerUnit: "cubic feet",
    },
    pitfalls: [
      "Convert mixed numbers to fractions before multiplying; 2 1/2 × 4 is not 2 × 4 + 1/2.",
      "To find a missing edge, divide the volume by the product of the other two edges, not by their sum.",
      "Check a missing edge by multiplying all three edges back to the volume.",
    ],
    parentGuide:
      "Measure a small box to the nearest quarter inch. Find its volume with fractions, then check with a calculator using decimals.",
  },
  {
    id: "composite-area",
    title: "Area of composite figures",
    summary:
      "Split a figure into simple pieces or subtract a missing piece from a larger whole.",
    templateIds: ["composite-area"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Recover unlabeled side lengths of figures whose corners are right angles.",
      "Find the area of a composite figure by adding parts or subtracting a missing piece.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a complicated outline manageable",
        paragraphs: [
          "An L-shaped floor can be covered by two rectangles. Find each rectangle's area and add them, or surround the floor with a larger rectangle and subtract the missing corner. Both ways count the same covered space.",
        ],
      },
      areaMeaning,
      {
        title: "Missing sides",
        paragraphs: [
          "A composite figure is built from simpler shapes. When every corner is a right angle, all sides run left–right or up–down. Walking around the figure, the steps to the right must add up to the steps to the left, and the steps up must add up to the steps down, because you return to the start.",
          "In an L-shaped figure with a bottom of 10 m and a top of 6 m, the inner horizontal edge is 10 − 6 = 4 m. A left side of 9 m and a right side of 4 m leave an inner vertical edge of 9 − 4 = 5 m.",
        ],
      },
      {
        title: "Split or subtract",
        paragraphs: [
          "Cut the figure into rectangles with one straight line and add their areas; or complete it to a large rectangle and subtract the missing piece. The L-shape above split horizontally is 10 × 4 = 40 plus 6 × 5 = 30, giving 70. Completing it gives 10 × 9 = 90 minus the missing corner 4 × 5 = 20, which is also 70. The two methods agree, as the figure shows.",
          "A rectangle with a corner cut off by a straight line is the rectangle minus a right triangle. The triangle's legs, the two sides that meet at its right angle, are the differences between opposite sides; its area is 1/2 × leg × leg.",
        ],
        illustration: "av-composite-split",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Add or subtract regions",
        paragraphs: [
          "A flat region's area is the sum of nonoverlapping pieces that cover it completely. Equivalently, subtract the area of a removed piece from the area of a containing whole, provided neither count includes gaps or overlaps.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "An L-shaped figure has all right angles. Its bottom is 10 meters, its left side is 9 meters, its top is 6 meters and its right side is 4 meters. What is its area, in square meters?",
      steps: [
        "Unlabeled edges: the inner horizontal edge is 10 − 6 = 4, and the inner vertical edge is 9 − 4 = 5.",
        "Split with a horizontal cut: lower rectangle 10 × 4 = 40 and upper rectangle 6 × 5 = 30.",
        "Add: 40 + 30 = 70. Check by subtracting: 10 × 9 − 4 × 5 = 90 − 20 = 70.",
      ],
      answer: "70",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Do not multiply two labels that belong to different parts of the figure; each rectangle needs its own length and width.",
      "When splitting, make sure no region is counted twice and none is left out.",
      "An unlabeled side comes from the opposite sides: the long side equals the sum of the short sides facing it.",
    ],
    parentGuide:
      "Draw an L-shape on grid paper. Find its area by splitting it two different ways and by subtracting from a rectangle; all three must agree.",
  },
  {
    id: "composite-face-prism-volume",
    title: "Volume of a composite prism",
    summary:
      "A right prism's volume is the area of its front face times its depth.",
    templateIds: ["composite-face-prism-volume"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the area of an L- or T-shaped face by splitting it into rectangles.",
      "Find the volume of a right prism as face area × depth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Repeat the same face through the depth",
        paragraphs: [
          "Imagine a solid made by pushing a flat L-shaped face straight backward. Every slice parallel to that face has the same area. The depth tells how many layers of that face fill the solid.",
        ],
      },
      volumeMeaning,
      {
        title: "Layers of the front face",
        paragraphs: [
          "A right prism has two matching parallel faces, here called the front and back, joined by rectangles at right angles to them. Its depth is the distance from front to back. An L-shaped block is a right prism whose front face is an L.",
          "Slice the prism into layers 1 unit deep. Each layer is a copy of the front face, 1 unit thick, so it holds as many unit cubes as the face has unit squares. With a face of 26 square units and a depth of 4, there are 4 layers of 26 cubes: 26 × 4 = 104 cubic units. So volume = area of the front face × depth.",
        ],
        illustration: "av-prism-layers",
      },
      {
        title: "Two ways to the same volume",
        paragraphs: [
          "An L-shaped prism is also two rectangular prisms joined together. Splitting the front face into rectangles 8 × 2 and 3 × 4 splits the solid into boxes 8 × 2 × 4 = 64 and 3 × 4 × 4 = 48, total 64 + 48 = 112. Finding the face area first, 16 + 12 = 28, then 28 × 4 = 112, gives the same result.",
          "First find any unlabeled edges of the face from the opposite edges, as for any figure whose corners are right angles.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Prism layers",
        paragraphs: [
          "A right prism has congruent parallel bases. Its volume is the area of one base times the perpendicular distance between the bases; the base may be a composite polygon.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right prism is 5 centimeters deep. Its front face is L-shaped with all right angles: the bottom is 9 centimeters, the left side is 6 centimeters, the top is 4 centimeters and the right side is 2 centimeters. What is its volume, in cubic centimeters?",
      steps: [
        "Unlabeled edges: inner horizontal 9 − 4 = 5 and inner vertical 6 − 2 = 4.",
        "Face area: lower rectangle 9 × 2 = 18 plus upper rectangle 4 × 4 = 16, so 18 + 16 = 34.",
        "Volume: 34 × 5 = 170.",
      ],
      answer: "170",
      answerUnit: "cubic centimeters",
    },
    pitfalls: [
      "Do not multiply the largest length, width and depth: that is the volume of the surrounding box, not of the L.",
      "Find the face's area completely before multiplying by the depth.",
      "Volume is in cubic units; the face area is in square units.",
    ],
    parentGuide:
      "Build an L-shaped block from interlocking cubes, one layer at a time. Count the cubes in one layer, then multiply by the number of layers.",
  },
  {
    id: "composite-face-prism-surface-area",
    title: "Surface area of a composite prism",
    summary:
      "A right prism's surface area includes both ends and every side face.",
    templateIds: ["composite-face-prism-surface-area"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the perimeter and area of an L- or T-shaped face.",
      "Find a right prism's surface area as 2 × face area + perimeter × depth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the outside, not the inside",
        paragraphs: [
          "A right prism has a front face, a matching back face, and side faces joining their edges straight across. Its surface area is all outside faces added together. Unroll the side faces into a strip: its width follows the front face's perimeter, the distance around its boundary, and its height is the prism's depth.",
        ],
      },
      {
        title: "The faces of a right prism",
        paragraphs: [
          "This lesson uses rectangle areas and perimeter, the distance around a shape. A right prism has a front face and a matching back face, joined by rectangles at right angles to them. Its depth is the distance from front to back. Surface area is the total area of all the faces.",
          "There is one side rectangle for each edge of the front face. Each is as wide as that edge and as long as the depth. An L-shaped face has 6 edges, so an L-shaped prism has 6 side faces plus front and back: 8 faces in all.",
        ],
      },
      {
        title: "Unroll the sides",
        paragraphs: [
          "Lay the side rectangles end to end, as in the figure. They form one long rectangle whose length is the sum of the face's edges, its perimeter, and whose width is the depth. So the side faces together have area perimeter × depth, and the surface area is 2 × face area + perimeter × depth.",
          "For the L-shaped face in the figure, with area 28, perimeter 28 and depth 4: 2 × 28 + 28 × 4 = 56 + 112 = 168 square units. Find every edge of the face first, including unlabeled ones, or the perimeter will be short.",
        ],
        illustration: "av-prism-unrolled",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Prism faces and the side strip",
        paragraphs: [
          "For a right prism with base area $B$, base perimeter $P$, and positive depth $h$, the two bases contribute $2B$ and the side faces together contribute $Ph$. Thus surface area is $2B+Ph$, counting each exposed face once.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right prism is 3 meters deep. Its front face is L-shaped with all right angles: the bottom is 8 meters, the left side is 6 meters, the top is 3 meters and the right side is 2 meters. What is its surface area, in square meters?",
      steps: [
        "Unlabeled edges: inner horizontal 8 − 3 = 5 and inner vertical 6 − 2 = 4.",
        "Face area: 8 × 2 = 16 plus 3 × 4 = 12, so 16 + 12 = 28. Front and back: 2 × 28 = 56.",
        "Perimeter: 8 + 2 + 5 + 4 + 3 + 6 = 28. Side faces: 28 × 3 = 84.",
        "Surface area: 56 + 84 = 140.",
      ],
      answer: "140",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Include the inner edges of the L in the perimeter; each one has its own side face.",
      "Count the front face twice: once for the front and once for the back.",
      "Surface area is in square units; do not multiply face area by depth, which gives volume.",
    ],
    parentGuide:
      "Wrap a strip of paper around the sides of an L-shaped block. Unroll it and measure: its length is the perimeter of the L and its width is the block's depth.",
  },
  {
    id: "cylinder-volume",
    title: "Volume of a cylinder",
    summary: "A cylinder's volume is its circular base area times its height.",
    templateIds: ["cylinder-volume"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why a cylinder's volume is its base area times its height.",
      "Find a cylinder's volume exactly in terms of $\\pi$ or with 3.14, and find a missing height from the volume.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Stack matching circles",
        paragraphs: [
          "A cylinder, like a can, has the same circular cross-section from bottom to top. Imagine stacking very thin copies of its circular base. The base area tells how much space is in a layer and the height tells how many layers fill the can. A circle's radius is half its diameter; its area is $\\pi$ (pi) times radius times radius. In $a\\pi$, $a$ asks for the number multiplying $\\pi$.",
        ],
      },
      circleFacts,
      {
        title: "A stack of circles",
        paragraphs: [
          "A cylinder has two matching circular bases joined by a curved surface; its height is the perpendicular distance between the bases. Like a prism, it can be sliced into layers 1 unit thick, and every layer is a copy of the base. So volume = base area × height, and for a circular base that is $V = \\pi r^2 h$.",
          "A cylinder with radius 3 cm and height 5 cm has base area $\\pi \\times 3^2 = 9\\pi$ square centimeters and volume $9\\pi \\times 5 = 45\\pi$ cubic centimeters. Using 3.14 for $\\pi$: 3.14 × 45 = 141.3 cubic centimeters.",
        ],
        illustration: "av-cylinder-stack",
      },
      {
        title: "Diameter and missing height",
        paragraphs: [
          "If a problem gives the diameter, halve it first: a diameter of 8 m means $r = 4$ m and base area $\\pi \\times 4^2 = 16\\pi$. Using 8 instead of 4 makes the base area four times too large.",
          "To find a missing height, divide the volume by the base area: a cylinder with volume $80\\pi$ and radius 4 has height $80\\pi \\div 16\\pi = 5$. The $\\pi$ cancels because both numbers are multiples of $\\pi$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Circular layers",
        paragraphs: [
          "For a right circular cylinder with radius $r>0$ and height $h>0$, each cross-section parallel to its base has area $\\pi r^2$. Stacking those equal layers gives volume $\\pi r^2h$ cubic units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cylinder has a diameter of 10 centimeters and a height of 6 centimeters. Its volume is $a\\pi$ cubic centimeters. What is $a$?",
      steps: [
        "The radius is half the diameter: 10 ÷ 2 = 5.",
        "Base area: $\\pi \\times 5^2 = 25\\pi$ square centimeters.",
        "Volume: $25\\pi \\times 6 = 150\\pi$ cubic centimeters, so $a = 150$.",
      ],
      answer: "150",
    },
    pitfalls: [
      "Square the radius, not the diameter.",
      "$r^2$ means $r \\times r$, not $2 \\times r$.",
      "An exact answer keeps $\\pi$; only multiply by 3.14 when the problem says to.",
    ],
    parentGuide:
      "Stack coins into a column. Each coin is a thin circle; the stack's volume is one coin's face area times the height of the stack. Compare two stacks of the same height but different coin sizes.",
  },
  {
    id: "cone-sphere-volume",
    title: "Volume of cones and spheres",
    summary:
      "A cone and a sphere can be measured by comparing them with matching cylinders.",
    templateIds: ["cone-sphere-volume"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the volume of a cone as one third of the matching cylinder.",
      "Find the volume of a sphere or hemisphere from its radius, exactly or with 3.14 for $\\pi$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare solids that fit together",
        paragraphs: [
          "A cone with the same circular base and height as a cylinder fills one third of that cylinder. A sphere is a round solid whose radius runs from its center to its surface. Its volume is four thirds of $\\pi$ (pi) times radius cubed, meaning radius multiplied by itself three times. In $a\\pi$, $a$ asks for the number multiplying $\\pi$.",
        ],
      },
      circleFacts,
      {
        title: "Cones",
        paragraphs: [
          "A cone has a circular base and a curved surface that narrows to a single point, its apex. Its height is the perpendicular distance from the apex to the base. A cone fills exactly 1/3 of the cylinder with the same base and height, a fact you can check by pouring: three cones of sand fill the cylinder.",
          "So a cone's volume is $V = \\tfrac{1}{3} \\times \\pi r^2 h$. For radius 3 and height 4: the cylinder holds $\\pi \\times 3^2 \\times 4 = 36\\pi$, and the cone holds $\\tfrac{1}{3} \\times 36\\pi = 12\\pi$.",
        ],
        illustration: "av-cone-sphere-cylinder",
      },
      {
        title: "Spheres and hemispheres",
        paragraphs: [
          "A sphere is the set of points at distance $r$ from a center, like a ball. The smallest cylinder that contains it has radius $r$ and height $2r$, so it holds $\\pi r^2 \\times 2r = 2\\pi r^3$. The sphere fills 2/3 of that cylinder, so $V = \\tfrac{2}{3} \\times 2\\pi r^3 = \\tfrac{4}{3}\\pi r^3$. Archimedes proved this more than two thousand years ago.",
          "A hemisphere is half a sphere: $V = \\tfrac{1}{2} \\times \\tfrac{4}{3}\\pi r^3 = \\tfrac{2}{3}\\pi r^3$. For $r = 3$: the sphere is $\\tfrac{4}{3} \\times 27\\pi = 36\\pi$ and the hemisphere is $18\\pi$. Cube the radius, $r^3 = r \\times r \\times r$, before multiplying by 4/3.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Cone and sphere volumes",
        paragraphs: [
          "A cone has one third the volume of a cylinder with the same base area and perpendicular height: $V=\\frac13\\pi r^2h$. A sphere of radius $r$ has volume $\\frac43\\pi r^3$; both formulas require a positive radius, and cone height is perpendicular to its base.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A sphere has a radius of 6 centimeters. Its volume is $a\\pi$ cubic centimeters. What is $a$?",
      steps: [
        "Cube the radius: 6 × 6 × 6 = 216.",
        "Volume: $\\tfrac{4}{3} \\times 216\\pi = 288\\pi$ cubic centimeters.",
        "Check: the containing cylinder holds $\\pi \\times 6^2 \\times 12 = 432\\pi$, and $\\tfrac{2}{3} \\times 432\\pi = 288\\pi$. So $a = 288$.",
      ],
      answer: "288",
    },
    pitfalls: [
      "Do not forget the one third for a cone: $\\pi r^2 h$ is the whole cylinder.",
      "A sphere uses r³, not r²; halve a diameter before cubing.",
      "A hemisphere is half a sphere: $\\tfrac{2}{3}\\pi r^3$.",
    ],
    parentGuide:
      "Fill a paper cone with rice and pour it into a cylinder of the same base and height; count how many cones fill it. Compare a ball's size to a can that just holds it.",
  },
];

export const areaVolumeMethods: Record<string, ProblemMethod> = {
  "triangle-area-base-height": {
    goal: "Find a triangle's area from a base and the height to that base.",
    terms: [
      [
        "height",
        "The perpendicular distance from the base to the opposite vertex.",
      ],
      ["perpendicular", "Meeting at a right angle."],
    ],
    method: [
      "Choose the base and the height perpendicular to it; ignore slanted sides.",
      "Multiply base × height: the area of the parallelogram two copies make.",
      "Halve it.",
    ],
    watch: "Do not use a slanted side as the height.",
  },
  "polygon-area-decompose": {
    goal: "Find the area of a parallelogram, trapezoid or pentagon by splitting it.",
    terms: [
      [
        "trapezoid",
        "A four-sided shape with exactly one pair of parallel sides.",
      ],
      ["decompose", "Split into pieces that do not overlap."],
    ],
    method: [
      "Split the shape into rectangles and triangles, or rearrange it into a rectangle.",
      "Find each piece's area with its own base and perpendicular height.",
      "Add the pieces.",
    ],
    watch: "Every triangle needs its perpendicular height, not a slanted side.",
  },
  "net-surface-area": {
    goal: "Find a solid's surface area by adding the areas of the faces in its net.",
    terms: [
      ["net", "A flat pattern of faces that folds into the solid."],
      ["surface area", "The total area of all the faces."],
    ],
    method: [
      "Name every face in the net and its shape.",
      "Find each face's area: rectangles l × w, triangles 1/2 × b × h.",
      "Add all the faces.",
    ],
    watch: "Count every face once; matching faces each count.",
  },
  "unit-fraction-cube-packing": {
    goal: "Count fraction-edge cubes that fill a prism and find its volume.",
    terms: [
      ["unit fraction", "A fraction with numerator 1, such as 1/2."],
      ["volume", "The space a solid fills, in cubic units."],
    ],
    method: [
      "Divide each edge by the cube's edge to count cubes along it.",
      "Multiply the three counts.",
      "For volume, multiply the count by one cube's volume.",
    ],
    watch: "A cube with edge 1/2 has volume 1/8, not 1/2.",
  },
  "fraction-edge-volume": {
    goal: "Find a prism's volume or a missing edge when edges are fractions.",
    terms: [
      ["mixed number", "A whole number plus a fraction, such as 2 1/2 = 5/2."],
      [
        "reciprocal",
        "The fraction turned upside down; dividing by a fraction multiplies by it.",
      ],
    ],
    method: [
      "Write mixed numbers as fractions.",
      "For volume, multiply length × width × height.",
      "For a missing edge, divide the volume by the product of the other two edges.",
    ],
    watch: "Multiply numerators and denominators; simplify at the end.",
  },
  "composite-area": {
    goal: "Find the area of a figure made of rectangles and triangles.",
    terms: [["composite figure", "A figure built from simpler shapes."]],
    method: [
      "Find unlabeled sides from the opposite sides.",
      "Split into rectangles, or subtract a missing piece from a rectangle.",
      "Add the parts.",
    ],
    watch: "Each rectangle needs its own length and width from the figure.",
  },
  "composite-face-prism-volume": {
    goal: "Find the volume of a right prism with an L- or T-shaped face.",
    terms: [
      [
        "right prism",
        "A solid whose matching front and back faces are joined by rectangles.",
      ],
    ],
    method: [
      "Find the unlabeled edges of the face.",
      "Find the face's area by splitting it into rectangles.",
      "Multiply the face area by the depth.",
    ],
    watch:
      "Do not multiply the outer length, height and depth: that is the surrounding box.",
  },
  "composite-face-prism-surface-area": {
    goal: "Find the surface area of a right prism with an L- or T-shaped face.",
    terms: [["perimeter", "The total length of a shape's edges."]],
    method: [
      "Find every edge of the face, including unlabeled ones.",
      "Front and back: 2 × face area.",
      "Side faces: perimeter × depth. Add.",
    ],
    watch: "Include the inner edges of the face in the perimeter.",
  },
  "cylinder-volume": {
    goal: "Find a cylinder's volume, or its height, from its radius or diameter.",
    terms: [
      ["radius", "Center to circle; half the diameter."],
      ["base area", "The area of a circle of radius $r$: $\\pi r^2$."],
    ],
    method: [
      "Halve a diameter to get the radius.",
      "Base area: $\\pi \\times r^2$.",
      "Volume = base area × height; for a height, divide the volume by the base area.",
    ],
    watch: "Square the radius, not the diameter.",
  },
  "cone-sphere-volume": {
    goal: "Find the volume of a cone, sphere or hemisphere.",
    terms: [
      ["cone", "1/3 of the cylinder with the same base and height."],
      [
        "sphere",
        "$\\tfrac{4}{3}\\pi r^3$: 2/3 of the cylinder that just contains it.",
      ],
    ],
    method: [
      "Halve a diameter to get the radius.",
      "Cone: $\\tfrac{1}{3} \\times \\pi r^2 \\times h$. Sphere: $\\tfrac{4}{3} \\times \\pi r^3$. Hemisphere: half a sphere.",
      "Keep $\\pi$ for an exact answer, or multiply by 3.14 when told.",
    ],
    watch: "Cube the radius for a sphere; do not forget the 1/3 for a cone.",
  },
};

export const areaVolumePrinciples: Record<string, string> = {
  "triangle-area-base-height":
    "Two copies of a triangle form a parallelogram with the same base and height, so the triangle's area is 1/2 × base × height.",
  "polygon-area-decompose":
    "Area does not change when a shape is cut into pieces and rearranged without gaps or overlaps.",
  "net-surface-area":
    "Unfolding a solid into its net keeps every face's area, so the surface area is the sum of the net's face areas.",
  "unit-fraction-cube-packing":
    "A cube with edge 1/n has volume 1/n³, and n³ of them fill a unit cube, so counting them gives the same volume as length × width × height.",
  "fraction-edge-volume":
    "Volume = length × width × height holds for fraction edges, so a missing edge is the volume divided by the product of the other two.",
  "composite-area":
    "The area of a figure is the sum of the areas of non-overlapping pieces that cover it, or a whole minus the piece removed.",
  "composite-face-prism-volume":
    "A right prism is a stack of copies of its front face, so its volume is the face's area times its depth.",
  "composite-face-prism-surface-area":
    "A right prism's side faces unroll into one rectangle as long as the face's perimeter, so its surface area is 2 × face area + perimeter × depth.",
  "cylinder-volume":
    "A cylinder is a stack of copies of its circular base, so its volume is $\\pi r^2 \\times h$.",
  "cone-sphere-volume":
    "A cone holds 1/3 of the cylinder with the same base and height; a sphere holds 2/3 of the cylinder that just contains it, giving $\\tfrac{4}{3}\\pi r^3$.",
};
