import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

const areaMeaning: Lesson["sections"][number] = {
  title: "Area counts unit squares",
  paragraphs: [
    "This lesson uses multiplying and dividing by 2. Area is the amount of flat surface a shape covers. It is measured in square units, small squares 1 unit long on each side. The abbreviation cm means centimeters, a unit of length, and a square centimeter is a square 1 cm long on each side. A rectangle 5 cm long and 3 cm wide holds 3 rows of 5 of these squares. So its area is 5 × 3 = 15 square centimeters.",
    "Cut a shape into pieces and move the pieces around. The total area stays the same, as long as no piece overlaps another and no gap is left. Every area method in this lesson rests on that fact. Split a shape, or rearrange it, into rectangles and triangles whose areas you can find.",
  ],
};
const baseAndHeight: Lesson["sections"][number] = {
  title: "Base and height",
  paragraphs: [
    "Perpendicular means meeting at a right angle, a square corner like the corner of a page. Figures mark a right angle with a small square. Any side of a triangle or a parallelogram can be chosen as the base. The height that goes with it is the distance from the base to the farthest point of the shape: the corner not on the base, or the facing side of a parallelogram. It is measured along a line perpendicular to the base.",
    "The height is usually not a side. It is often drawn as a dashed line, inside the shape or outside it. An angle is the opening between two sides at a corner. An obtuse triangle has one angle wider than a right angle. Its height can fall outside the triangle. Then the base is extended with a dashed line, and the height meets that longer line at a right angle. A slanted side is always longer than the height, so using it gives too large an area.",
  ],
};
const volumeMeaning: Lesson["sections"][number] = {
  title: "Volume counts unit cubes",
  paragraphs: [
    "A solid is a shape that takes up space. Its faces are its flat outside surfaces, and an edge is a line where two faces meet. Volume is the amount of space a solid fills. A cube is a box whose edges all have the same length, and a unit cube is 1 unit long on each edge. Volume is measured in cubic units: a cubic centimeter is the space inside a cube 1 cm (one centimeter) long on each edge. A rectangular prism is a box shape whose six faces are rectangles. Its length, width and height are the lengths of three edges that meet at one corner.",
    "A prism 4 cm long, 3 cm wide and 2 cm tall holds layers of these unit cubes. Each layer has 4 × 3 = 12 cubes, and there are 2 layers. So its volume is 4 × 3 × 2 = 24 cubic centimeters. In general, volume = length × width × height. Area is the flat surface a shape covers, counted in unit squares: squares 1 unit long on each side. The bottom face has area 4 × 3 = 12 square centimeters, the same as the number of cubes in one layer. So volume is also the area of the bottom face times the height.",
  ],
};
const circleFacts: Lesson["sections"][number] = {
  title: "Radius, diameter and circle area",
  paragraphs: [
    "The radius $r$ of a circle is the distance from its center to the circle. The diameter is the distance across the circle through the center, so the diameter is $2 \\times r$. The number $\\pi$ (pi) is about 3.14. For every circle, the circumference (the distance around) divided by the diameter is $\\pi$.",
    "A circle's area is $\\pi \\times r \\times r$, written $\\pi r^2$. A circle of radius 3 cm has area $\\pi \\times 3^2 = 9\\pi$ square centimeters, counted in squares 1 cm long on each side. An exact answer keeps $\\pi$ as a symbol: $9\\pi$. When a problem says to use 3.14 for $\\pi$, multiply: 3.14 × 9 = 28.26. That is an approximate value, close but not exact.",
  ],
};

export const areaVolumeLessons: Lesson[] = [
  {
    id: "triangle-area-base-height",
    title: "Area of a triangle",
    summary:
      "Area is the amount of flat surface a shape covers. A triangle is a flat shape with three straight sides. Pick one side and call it the base. The height is the distance from the base to the corner across from it, measured straight across at a square corner to the base. Two copies of a triangle fit together into a parallelogram, a four-sided shape whose facing sides are parallel (they point the same way and never meet). The parallelogram's area is base times height, so the triangle's area is half of that.",
    templateIds: ["triangle-area-base-height"],
    senses: {
      unit: "unit",
      side: "side",
      square: "square-shape",
      vertex: "vertex",
      product: "product-multiply",
    },
    noLink: ["base", "change", "whole", "opposite", "rule"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why a triangle's area is half of its base times its height.",
      "Choose the height that meets the base at a square corner and ignore slanted sides, even when the height falls outside the triangle.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Two matching triangles make a larger shape",
        paragraphs: [
          "Area is the amount of flat surface a shape covers. It is counted in square units: small squares 1 unit long on each side. The abbreviation cm means centimeters, and a square centimeter is a small square 1 cm long on each side. A rectangle, a four-sided shape with four square corners, 5 cm long and 3 cm wide holds 3 rows of 5 of these squares. So its area is 5 × 3 = 15 square centimeters.",
          "A triangle is a flat shape with three straight sides. Each corner, where two sides meet, is called a vertex. Pick any side and call it the base. The height is the distance from the base to the vertex across from it. It is measured along a line that meets the base at a right angle, a square corner like the corner of a page. Figures often draw the height as a dashed line. A slanted side is not the height.",
          "Make a copy of the triangle and turn it halfway around. Fit the copy against the original along one of the two sides that is not the base. Together they make a parallelogram, a four-sided shape whose facing sides are parallel: they point the same way and never meet. The parallelogram has the same base and height as the triangle.",
          "Cut a triangle off one end of the parallelogram and slide it to the other end. That makes a rectangle with the same base and height, so the parallelogram's area is base × height too. The triangle is exactly half of the parallelogram. So the triangle's area is half of base × height.",
        ],
      },
      areaMeaning,
      baseAndHeight,
      {
        title: "Why a triangle is half a parallelogram",
        paragraphs: [
          "A parallelogram is a four-sided shape whose facing sides are parallel. Cut a right triangle, a triangle with one square corner, off one end along a height. Slide it to the other end. The pieces now form a rectangle with the same base and height. A very slanted parallelogram may need several such cuts, but the result is the same. So a parallelogram's area is base × height, like a rectangle's.",
          "Now take any triangle and a copy of it. Turn the copy halfway around and place it against the original along one side, as in the figure. The two copies fill a parallelogram with the triangle's base and height, with no gaps and no overlaps. Each triangle is half of it, so its area is $\\tfrac{1}{2}$ × base × height. For base 8 cm and height 5 cm, the parallelogram is 8 × 5 = 40 square centimeters. The triangle is 40 ÷ 2 = 20 square centimeters.",
        ],
        illustration: "av-triangle-half",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Half of a parallelogram",
        paragraphs: [
          "Two congruent copies of a triangle (exact copies, the same size and shape) form a parallelogram with the same base $b$ and perpendicular height $h$. The parallelogram's area is $bh$, meaning $b \\times h$. So $A$, the triangle's area, is $A = \\tfrac{1}{2}bh$. This holds wherever the height meets the line of the base, inside the triangle or outside it.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A triangle has a base of 14 centimeters. The dashed height, drawn from the top vertex to the base, is 12 centimeters, and the slanted sides are 13 centimeters and 15 centimeters. What is its area, in square centimeters?",
      steps: [
        "The height must meet the base at a right angle. The dashed height, 12 cm, does. The slanted sides, 13 cm and 15 cm, do not, so they are not used.",
        "Two copies of the triangle make a parallelogram with the same base, 14 cm, and the same height, 12 cm. Its area is base × height: 14 × 12 = 168 square centimeters.",
        "The triangle is half of that parallelogram, so divide by 2: 168 ÷ 2 = 84 square centimeters.",
        "Check with the rule $\\tfrac{1}{2}$ × base × height. Half of 14 is 7, and 7 × 12 = 84, the same answer.",
      ],
      answer: "84",
      answerUnit: "square centimeters",
    },
    pitfalls: [
      "Do not multiply a slanted side by the base. The height is the distance measured at a right angle to the base.",
      "Remember to halve. Base × height is the area of the whole parallelogram, which is two triangles.",
      "In an obtuse triangle (one angle wider than a square corner), the height can fall outside the triangle. It still measures the distance to the line of the base.",
    ],
    parentGuide:
      "Cut a paper rectangle along one diagonal, the line from one corner to the far corner. Show that the two triangles match exactly, so each is half the rectangle. Then cut out a slanted triangle and a copy, and fit them together into a parallelogram, a four-sided shape whose facing sides are parallel.",
  },
  {
    id: "polygon-area-decompose",
    title: "Area by splitting into rectangles and triangles",
    summary:
      "A polygon is a flat shape with straight sides, such as a triangle (3 sides) or a pentagon (5 sides). Its area is the flat surface it covers, counted in unit squares: squares 1 unit long on each side. To find it, cut the polygon into rectangles (four sides, four square corners) and triangles. The pieces must cover the shape with no gaps and no overlaps. Find each piece's area and add them.",
    templateIds: ["polygon-area-decompose"],
    senses: {
      unit: "unit",
      side: "side",
      square: "square-shape",
      vertex: "vertex",
    },
    noLink: [
      "base",
      "bases",
      "change",
      "opposite",
      "leaves",
      "part",
      "parts",
      "whole",
      "changes",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a parallelogram's area by cutting off one piece and moving it to make a rectangle.",
      "Find the area of a trapezoid or a pentagon by splitting it into triangles and rectangles.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Cut a hard shape into familiar pieces",
        paragraphs: [
          "Area is the amount of flat surface a shape covers. It is counted in square units: small squares 1 unit long on each side, such as square meters. A rectangle 12 m (meters) wide and 8 m tall holds 8 rows of 12 such squares. So its area is 12 × 8 = 96 square meters.",
          "A triangle can sit on any of its sides. The side it sits on is called the base. Its height is the distance from the base to the top corner, measured at a right angle (a square corner) to the base. A slanted side is not the height. Two copies of a triangle make a four-sided shape with area base × height, so a triangle's area is half of base × height.",
          "A trapezoid is a four-sided shape with exactly one pair of parallel sides, sides that point the same way and never meet. A shape like that is hard to cover with squares directly. So cut it into rectangles and triangles instead. Cutting and moving pieces never changes the total area. The pieces' areas add up to the area of the shape.",
          "One useful cut is a diagonal: a straight line joining two corners that are not next to each other. A diagonal splits a trapezoid into two triangles.",
        ],
      },
      areaMeaning,
      {
        title: "Parallelograms and trapezoids",
        paragraphs: [
          "A parallelogram is a four-sided shape with two pairs of parallel sides, sides that point the same way and never meet. Cut along a height, a line perpendicular to the base (meeting it at a right angle). Move the cut-off triangle from one end to the other. The result is a rectangle with the same base and height. A very slanted parallelogram may need several such cuts, but the result is the same. So a parallelogram with base 9 cm and height 4 cm has area 9 × 4 = 36 square centimeters.",
          "A trapezoid has exactly one pair of parallel sides, called its bases. Its height is the distance between them, measured at a right angle. A diagonal splits it into two triangles. Both triangles have the trapezoid's height, and their bases are the two parallel sides. For parallel sides 10 and 6 and height 4, the area is $\\tfrac{1}{2} \\times 10 \\times 4 + \\tfrac{1}{2} \\times 6 \\times 4 = 20 + 12 = 32$.",
        ],
        illustration: "av-polygon-split",
      },
      {
        title: "Shapes made of familiar pieces",
        paragraphs: [
          "Many polygons can be split into a rectangle and a triangle by drawing one line. A pentagon, a five-sided shape, shaped like a house is a rectangle with a triangle on top. The rectangle is 8 m wide and 5 m tall, so its area is 8 × 5 = 40. The roof triangle sits on the 8 m top of the rectangle, so its base is 8 m. Its height, from that base up to the peak, is 3 m. So its area is $\\tfrac{1}{2} \\times 8 \\times 3 = 12$. The pentagon's area is 40 + 12 = 52 square meters.",
          "Sometimes a figure gives the total height of the house instead of the triangle's height. The total height runs from the floor to the peak. The wall takes up the bottom 5 m of it, so the roof's height is what is left: 8 − 5 = 3 m. Finally, check that the pieces cover the shape exactly once.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Area adds across pieces",
        paragraphs: [
          "Cut a flat region into pieces with no gaps and no overlaps. Its area is the sum (total) of the pieces' areas. Moving or turning the pieces, without stretching them, keeps the total area the same.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A trapezoid has parallel sides of 14 meters and 8 meters, and the distance between them is 5 meters. What is its area, in square meters?",
      steps: [
        "Draw a diagonal, a line from one corner to a corner that is not next to it. It splits the trapezoid into two triangles.",
        "One triangle has the 14 m side as its base, and the other has the 8 m side. Each triangle reaches across to the other parallel side, so each has height 5 m, the distance between the parallel sides.",
        "The triangle on the 14 m side has area $\\tfrac{1}{2} \\times 14 \\times 5 = 35$. The triangle on the 8 m side has area $\\tfrac{1}{2} \\times 8 \\times 5 = 20$.",
        "The two triangles cover the trapezoid exactly once, so add: 35 + 20 = 55 square meters.",
      ],
      answer: "55",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Use the height measured at a right angle to the base, not a slanted side, for every triangle and parallelogram.",
      "The two triangles in a trapezoid have different bases but the same height.",
      "If a figure gives a total height, subtract the rectangle's height to get the triangle's height.",
    ],
    parentGuide:
      "Draw a trapezoid on grid paper, cut it out and cut along a diagonal. Count the squares in each triangle. Compare each count with $\\tfrac{1}{2}$ × base × height for that triangle.",
  },
  {
    id: "net-surface-area",
    title: "Surface area from a net",
    summary:
      "A solid is a shape that takes up space, like a box. Its faces are its flat outside surfaces. Area is the amount of flat surface a shape covers. Surface area is the total area of all the faces. A net is the flat pattern you get when you unfold a solid. Find the area of each face in the net, then add them all.",
    templateIds: ["net-surface-area"],
    senses: {
      center: "center",
      unit: "unit",
      face: "face-solid",
      edge: "edge",
      solid: "solid-shape",
      net: "net-solid",
      base: "base-shape",
      square: "square-shape",
      side: "side",
    },
    noLink: ["opposite side", "rules", "change"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the faces of a rectangular prism, a triangular prism or a square pyramid in its net.",
      "Find surface area by adding the areas of all the faces.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Unfold every outside face",
        paragraphs: [
          "A solid is a shape that takes up space, like a box or a tent. Its faces are its flat outside surfaces. An edge is a line where two faces meet. Imagine cutting a cardboard box along some edges and laying it flat. The flat pattern is called a net. Folding the net back up rebuilds the box.",
          "Surface area is the total area of all the faces. It is counted in square units: small squares 1 unit long on each side, such as square inches. Unfolding does not stretch any face. So the area of the net equals the surface area of the solid. Find the area of each face once, then add.",
          "You need two area rules. A rectangle's area is length × width. A triangle can sit on any side, and that side is called its base. Its height is the distance from the base to the far corner, measured at a right angle (a square corner). A triangle's area is half of base × height.",
          "A square pyramid is a solid with a square at the bottom, called its base. Four triangles rise from the four sides of the base and meet at a point on top. So it has five faces.",
        ],
      },
      {
        title: "Faces and nets",
        paragraphs: [
          "A net shows every face of a solid laid flat. Folding the net along its dashed lines rebuilds the solid. The figure shows the net of a rectangular prism, a box shape whose six faces are all rectangles.",
          "Surface area is measured in square units, such as square centimeters. A square centimeter is a square 1 cm (one centimeter) long on each side. Unfolding moves faces without stretching them, so the area of the net equals the surface area of the solid.",
        ],
        illustration: "av-prism-net",
      },
      {
        title: "Prisms and pyramids",
        paragraphs: [
          "A rectangular prism has six rectangle faces in three matching pairs: top and bottom, front and back, and the two ends. Take a box 5 cm long, 3 cm wide and 2 cm tall. Its pairs have areas 5 × 3 = 15, 5 × 2 = 10 and 3 × 2 = 6 square centimeters. Each area counts twice, once for each face in the pair. So the surface area is 2 × 15 + 2 × 10 + 2 × 6 = 30 + 20 + 12 = 62 square centimeters.",
          "A triangular prism has two triangle ends and three rectangles. Each rectangle is as long as the prism and as wide as one side of the triangle. A square pyramid has a square base and four triangles that meet at the top. In these lessons the top point is directly above the middle of the base, so the four triangles match. Each triangle's height runs along the face, from the middle of a bottom edge up to the top point. It is called the slant height. It is longer than the pyramid's height measured straight up from the base.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Every face contributes once",
        paragraphs: [
          "Unfolding a solid into a net does not change the area of any face. The surface area is the sum (total) of the areas of all the faces, each counted once. The edges where faces meet add no area.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A square pyramid has a base 6 inches on each side. Each triangular face has a base of 6 inches and a height of 5 inches. What is its surface area, in square inches?",
      steps: [
        "The base is a square 6 inches on each side. Its area is 6 × 6 = 36 square inches.",
        "Each triangular face has base 6 and height 5. Its area is $\\tfrac{1}{2} \\times 6 \\times 5 = 15$ square inches.",
        "There are four matching triangles, so together they cover 4 × 15 = 60 square inches.",
        "Add all five faces, each counted once: 36 + 60 = 96 square inches.",
      ],
      answer: "96",
      answerUnit: "square inches",
    },
    pitfalls: [
      "Count every face: a rectangular prism has 6, a triangular prism has 5 and a square pyramid has 5.",
      "Use $\\tfrac{1}{2}$ × base × height for triangles. Leaving out the $\\tfrac{1}{2}$ doubles each triangle.",
      "For a pyramid, use the height of each triangle face (the slant height), not the height of the pyramid straight up.",
    ],
    parentGuide:
      "Unfold an empty cereal box along its seams. Measure each rectangle, find its area and add. Match each face to its partner on the far side of the box.",
  },
  {
    id: "unit-fraction-cube-packing",
    title: "Packing a prism with fraction cubes",
    summary:
      "A solid is a shape that takes up space, and its volume is the amount of space it takes up. A rectangular prism is a box shape. A cube is a box whose edges, the lines where its flat faces meet, are all the same length. Small cubes with edges of $\\tfrac{1}{2}$ unit can fill a box exactly. Count them, then multiply by the volume of one small cube. The result equals the three edge lengths multiplied together.",
    templateIds: ["unit-fraction-cube-packing"],
    senses: {
      side: "side",
      square: "square-shape",
      cube: "cube",
      edge: "edge",
      unit: "unit",
      solid: "solid-shape",
      face: "face-solid",
      third: "third",
      quarter: "fourth",
    },
    noLink: ["whole"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the small cubes, each with an edge that is a unit fraction such as $\\tfrac{1}{2}$, that fill a rectangular prism.",
      "Show that the cube count times one cube's volume equals length × width × height.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fill a box with tiny equal cubes",
        paragraphs: [
          "A rectangular prism is a box shape. Its six faces (flat outside surfaces) are rectangles. Its length, width and height are measured along its edges, the lines where two faces meet. A cube is a box whose edges all have the same length, like a sugar cube. Volume is the amount of space a solid holds. It is counted in cubic units: the space inside a cube 1 unit long on each edge, called a unit cube. A cubic foot is the space inside a cube 1 foot long on each edge.",
          "A unit fraction is a fraction with 1 on top, such as $\\tfrac{1}{2}$ or $\\tfrac{1}{3}$. A cube with edges of $\\tfrac{1}{2}$ foot is much smaller than a one-foot cube. Two of them fit along each edge of the big cube. So 2 × 2 × 2 = 8 of them fill one cubic foot, and each is $\\tfrac{1}{8}$ of a cubic foot.",
          "To count how many small cubes fit along an edge, divide the edge length by the small edge. Along 3 feet, $3 \\div \\tfrac{1}{2} = 6$ small cubes fit, because each foot holds 2. The cubes form rows along the length. Rows lie next to each other across the width to make one layer, and layers stack up to the height. So multiply the three counts to get the number of cubes in the box. A mixed number is a number such as $1\\tfrac{1}{2}$, which means 1 + $\\tfrac{1}{2}$, or $\\tfrac{3}{2}$.",
        ],
      },
      volumeMeaning,
      {
        title: "Small cubes with fraction edges",
        paragraphs: [
          "A cube with edges of $\\tfrac{1}{2}$ cm fits 2 times along each edge of a 1 cm cube. So 2 × 2 × 2 = 8 of them fill it, as the figure shows. One small cube is $\\tfrac{1}{8}$ of a cubic centimeter, because $\\tfrac{1}{2} \\times \\tfrac{1}{2} \\times \\tfrac{1}{2} = \\tfrac{1}{8}$.",
          "To count small cubes along an edge, divide the edge by the small edge. Along $2\\tfrac{1}{2}$ cm, which is $\\tfrac{5}{2}$ cm, $\\tfrac{5}{2} \\div \\tfrac{1}{2} = 5$ cubes fit. Along $1\\tfrac{1}{2}$ cm, 3 fit, and along 1 cm, 2 fit. A prism $2\\tfrac{1}{2}$ cm by $1\\tfrac{1}{2}$ cm by 1 cm holds 5 × 3 × 2 = 30 half-centimeter cubes. So its volume is $30 \\times \\tfrac{1}{8} = \\tfrac{30}{8} = \\tfrac{15}{4}$ cubic centimeters.",
        ],
        illustration: "av-cube-packing",
      },
      {
        title: "Why length times width times height still works",
        paragraphs: [
          "Multiplying the edges directly gives the same result: $\\tfrac{5}{2} \\times \\tfrac{3}{2} \\times 1 = \\tfrac{15}{4}$. Here is why. Write each edge in halves: $\\tfrac{5}{2}$, $\\tfrac{3}{2}$ and $\\tfrac{2}{2}$. The cube count, 5 × 3 × 2 = 30, multiplies the numerators (the top numbers). Each small cube is $\\tfrac{1}{8}$, and 8 = 2 × 2 × 2 multiplies the denominators (the bottom numbers). So the count times $\\tfrac{1}{8}$ is the same as multiplying the three fractions.",
          "Edges of thirds or quarters work the same way. A cube with edge $\\tfrac{1}{3}$ unit has volume $\\tfrac{1}{3} \\times \\tfrac{1}{3} \\times \\tfrac{1}{3} = \\tfrac{1}{27}$ cubic unit, and 27 of them fill a unit cube.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Small cubes measure volume",
        paragraphs: [
          "Let $n$ be any of the numbers 1, 2, 3 and so on. A cube with edge $\\tfrac{1}{n}$ unit has volume $\\tfrac{1}{n^3}$ cubic unit, where $n^3$ ($n$ cubed) means $n \\times n \\times n$. Exactly $n^3$ such cubes fill a unit cube. So counting equal small cubes gives the same volume as multiplying a prism's three edge lengths.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A rectangular prism is $1\\tfrac{1}{2}$ feet long, 1 foot wide and 2 feet tall. It is packed with cubes that have edges of $\\tfrac{1}{2}$ foot. Use the cubes to find the prism's volume, in cubic feet.",
      steps: [
        "Write the mixed number as a fraction, which makes it easier to divide: $1\\tfrac{1}{2} = \\tfrac{3}{2}$.",
        "Divide each edge by the small edge, $\\tfrac{1}{2}$ foot, to count the cubes along it. Length: $\\tfrac{3}{2} \\div \\tfrac{1}{2} = 3$. Width: $1 \\div \\tfrac{1}{2} = 2$. Height: $2 \\div \\tfrac{1}{2} = 4$.",
        "The cubes stand in 4 layers of 3 × 2 = 6 cubes each. That makes 3 × 2 × 4 = 24 cubes.",
        "Each small cube has volume $\\tfrac{1}{2} \\times \\tfrac{1}{2} \\times \\tfrac{1}{2} = \\tfrac{1}{8}$ cubic foot. So the prism's volume is $24 \\times \\tfrac{1}{8} = 3$ cubic feet.",
        "Check by multiplying the edges: $\\tfrac{3}{2} \\times 1 \\times 2 = 3$ cubic feet. Both ways agree.",
      ],
      answer: "3",
      answerUnit: "cubic feet",
    },
    pitfalls: [
      "A cube with edge $\\tfrac{1}{2}$ is not half a unit cube. It is $\\tfrac{1}{8}$ of it, because all three edges are halved.",
      "To count cubes along an edge, divide the edge by the small edge. Do not multiply.",
      "The cube count and the volume are different answers. The volume is the count times one cube's volume.",
    ],
    parentGuide:
      "Use sugar cubes or building blocks as half-unit cubes. Build a 1-unit cube from 8 of them. Then build a box 3 blocks by 2 by 2, and find its volume both by counting and by multiplying the edges.",
  },
  {
    id: "fraction-edge-volume",
    title: "Volume with fraction edges",
    summary:
      "Volume is the amount of space a box holds. To find it, multiply the box's three edge lengths: how long, how wide and how tall it is. This works even when the lengths are fractions, such as $\\tfrac{3}{4}$ foot. If you know the volume and two of the lengths, divide to find the third.",
    templateIds: ["fraction-edge-volume"],
    senses: {
      side: "side",
      square: "square-shape",
      edge: "edge",
      cube: "cube",
      unit: "unit",
      solid: "solid-shape",
      face: "face-solid",
      product: "product-multiply",
      third: "third",
      quarter: "fourth",
    },
    noLink: ["scales", "whole", "wholes", "rule", "change", "mean"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the volume of a rectangular prism (a box shape) whose edges are fractions or mixed numbers.",
      "Find a missing edge length from the volume and the other two edges.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "The layers can be fractional",
        paragraphs: [
          "A rectangular prism is a box shape. Its faces are its flat outside surfaces, and its edges are the lines where two faces meet. Its length, width and height are measured along three edges. Volume is the amount of space it holds. It is counted in cubic units: the space inside a cube (a box with all edges equal) 1 unit long on each edge, such as a cubic foot.",
          "Volume = length × width × height. A box 3 feet long, 2 feet wide and 1 foot tall holds 3 × 2 × 1 = 6 cubic feet. The rule still works when lengths are fractions. Small cubes with fraction edges fill such a box exactly, and the lesson below shows that multiplying the lengths gives the same total.",
          "A mixed number such as $2\\tfrac{1}{2}$ is a whole number and a fraction together. It means 2 + $\\tfrac{1}{2}$. To multiply, first write it as a fraction. Two wholes are $\\tfrac{4}{2}$, so $2\\tfrac{1}{2} = \\tfrac{4}{2} + \\tfrac{1}{2} = \\tfrac{5}{2}$. To multiply fractions, multiply the top numbers (numerators) and multiply the bottom numbers (denominators).",
          "To simplify a fraction means to write it with smaller numbers without changing its value. Divide its top and bottom by the same number. Dividing both by 12, the largest number that divides 60 and 24 exactly, turns $\\tfrac{60}{24}$ into $\\tfrac{5}{2}$.",
        ],
      },
      volumeMeaning,
      {
        title: "Multiplying fraction edges",
        paragraphs: [
          "A mixed number such as $2\\tfrac{1}{4}$ means 2 + $\\tfrac{1}{4}$. Write it as a fraction first: $2\\tfrac{1}{4} = \\tfrac{9}{4}$, because 2 wholes are $\\tfrac{8}{4}$. To multiply fractions, multiply the numerators (top numbers) and multiply the denominators (bottom numbers). Then simplify by dividing the top and bottom by a common factor, a number that divides both exactly.",
          "Take a box $2\\tfrac{1}{4}$ feet long, $\\tfrac{2}{3}$ foot wide and 2 feet tall. Its volume is $\\tfrac{9}{4} \\times \\tfrac{2}{3} \\times 2 = \\tfrac{36}{12} = 3$ cubic feet. The figure shows why this matches packing with small cubes. Multiplying counts the small cubes and multiplies by the volume of one.",
        ],
        illustration: "av-cube-packing",
      },
      {
        title: "Finding a missing edge",
        paragraphs: [
          "Suppose you know the volume and two edges. Volume = (length × width) × height, where the parentheses mean multiply length by width first. Multiply the other two edges; the answer is called the product. The volume is the height times that product. Dividing undoes multiplying, so the height is the volume divided by the product. To divide by a fraction, multiply by its reciprocal, the fraction turned upside down. This works because a fraction times its reciprocal is 1: $\\tfrac{3}{2} \\times \\tfrac{2}{3} = 1$.",
          "A box has volume 6 cubic meters, length 2 m (meters) and width $\\tfrac{3}{2}$ m. The known edges multiply to $2 \\times \\tfrac{3}{2} = 3$. So the height is 6 ÷ 3 = 2 m. Check by multiplying back: $2 \\times \\tfrac{3}{2} \\times 2 = 6$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Volume with fractional edges",
        paragraphs: [
          "Let a rectangular prism have length $l$, width $w$ and height $h$ in the same unit, all greater than 0. Its volume is $V = lwh$ cubic units, where $lwh$ means $l \\times w \\times h$. If the volume and two edges are known, the third edge is the volume divided by the product of the two known edges.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A box is $2\\tfrac{1}{2}$ feet long, $1\\tfrac{1}{3}$ feet wide and $\\tfrac{3}{4}$ foot tall. What is its volume, in cubic feet?",
      steps: [
        "Write the mixed numbers as fractions so they can be multiplied: $2\\tfrac{1}{2} = \\tfrac{5}{2}$ and $1\\tfrac{1}{3} = \\tfrac{4}{3}$.",
        "Volume = length × width × height. Multiply the numerators and the denominators: $\\tfrac{5}{2} \\times \\tfrac{4}{3} \\times \\tfrac{3}{4} = \\tfrac{5 \\times 4 \\times 3}{2 \\times 3 \\times 4} = \\tfrac{60}{24}$.",
        "Simplify by dividing the top and bottom by 12, the largest number that divides both: $\\tfrac{60}{24} = \\tfrac{5}{2}$. That is $2\\tfrac{1}{2}$ cubic feet.",
      ],
      answer: "5/2",
      answerUnit: "cubic feet",
    },
    pitfalls: [
      "Write mixed numbers as fractions before multiplying: $2\\tfrac{1}{2} \\times 4 = \\tfrac{5}{2} \\times 4 = 10$, not $8\\tfrac{1}{2}$.",
      "To find a missing edge, divide the volume by the product of the other two edges, not by their sum (total).",
      "Check a missing edge by multiplying all three edges back to the volume.",
    ],
    parentGuide:
      "Measure a small box to the nearest quarter inch. Find its volume with fractions, then check with a calculator using decimals.",
  },
  {
    id: "composite-area",
    title: "Area of composite figures",
    summary:
      "A composite figure is a shape built from simpler shapes, such as rectangles (four sides, four square corners) and triangles (three sides). Its area is the flat surface it covers. To find it, split the figure into those pieces and add their areas. Or draw a larger rectangle around it and subtract the missing piece. Both ways give the same area.",
    templateIds: ["composite-area"],
    senses: {
      unit: "unit",
      side: "side",
      "left side": "side",
      "right side": "side",
      square: "square-shape",
      difference: "difference-subtract",
      edge: "edge",
    },
    noLink: ["change", "opposite", "part", "parts", "whole"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find unlabeled side lengths in a figure whose corners are all right angles (square corners).",
      "Find a composite figure's area by adding its pieces or by subtracting a missing piece.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Make a complicated outline manageable",
        paragraphs: [
          "Area is the amount of flat surface a shape covers. It is counted in square units: small squares 1 unit long on each side. A rectangle 10 m (meters) long and 4 m wide holds 4 rows of 10 square meters. So it covers 10 × 4 = 40 square meters.",
          "An L-shaped floor is made of two rectangles. A shape built from simpler shapes like this is called a composite figure. Find each rectangle's area and add. Or surround the floor with one big rectangle and subtract the empty corner. Both ways measure the same floor, so they agree.",
          "Some sides may have no label. In these figures every side runs straight across or straight up and down. Walk once around the outline. The total distance you go right equals the total distance you go left, because you end where you started. The same holds for up and down. So an unlabeled side is a full length minus the other parts along the same direction. In an L-shape, the bottom equals the top plus the inner side running across.",
        ],
      },
      areaMeaning,
      {
        title: "Missing sides",
        paragraphs: [
          "Look at a composite figure whose sides all run left and right or up and down. Walking around the figure, the steps to the right add up to the steps to the left. The steps up add up to the steps down. This is true because you return to the start.",
          "Take an L-shaped figure with a bottom of 10 m and a top of 6 m. The inner side running across is 10 − 6 = 4 m. A left side of 9 m and a right side of 4 m leave an inner side running up and down of 9 − 4 = 5 m.",
        ],
      },
      {
        title: "Split or subtract",
        paragraphs: [
          "One way: cut the figure into rectangles with one straight line and add their areas. Another way: complete it to a large rectangle and subtract the missing piece. The L-shape above, cut straight across, is 10 × 4 = 40 plus 6 × 5 = 30, which gives 70. Completing it gives 10 × 9 = 90 minus the missing corner 4 × 5 = 20, which is also 70. The two methods agree, as the figure shows.",
          "Some figures are a rectangle with one corner cut off by a slanted straight line. That figure is the rectangle minus a right triangle, a triangle with one square corner. The triangle's legs are its two sides that meet at the square corner. Each leg is a difference, the result of a subtraction: a full side of the rectangle minus the part of that side that is left. The triangle is half of a rectangle with those legs as its sides, cut along a diagonal. So its area is half of one leg times the other. Legs of 8 and 3 give half of 8 × 3 = 24, which is 12.",
        ],
        illustration: "av-composite-split",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Add or subtract regions",
        paragraphs: [
          "The area of a flat region is the sum of the areas of pieces that cover it completely without overlapping. Equivalently, it is the area of a larger shape that contains it minus the area of the piece removed. Neither count may include gaps or overlaps.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "An L-shaped figure has sides that run only straight across or straight up and down. Its bottom is 10 meters and its left side is 9 meters. Its top is 6 meters and its right side is 4 meters. The missing corner is at the top right. What is its area, in square meters?",
      steps: [
        "Find the two unlabeled sides. Across: the bottom, 10 m, equals the top, 6 m, plus the inner side running across. So that side is 10 − 6 = 4 m. Up and down: the left side, 9 m, equals the right side, 4 m, plus the inner side running up and down. So that side is 9 − 4 = 5 m.",
        "Cut the figure with one line straight across, level with the top of the right side. The lower rectangle is 10 m by 4 m, so its area is 10 × 4 = 40. The upper rectangle is 6 m wide and 5 m tall, so its area is 6 × 5 = 30.",
        "The two rectangles cover the figure exactly once, so add: 40 + 30 = 70 square meters.",
        "Check by subtracting. The surrounding rectangle is 10 × 9 = 90, and the missing corner is 4 × 5 = 20. Then 90 − 20 = 70, the same area.",
      ],
      answer: "70",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Do not multiply two labels that belong to different parts of the figure. Each rectangle needs its own length and width.",
      "When splitting, make sure no region is counted twice and none is left out.",
      "Find an unlabeled side from the other sides running the same direction: a full length equals the sum (total) of the shorter parts along it.",
    ],
    parentGuide:
      "Draw an L-shape on grid paper. Find its area by splitting it two different ways and by subtracting from a rectangle. All three answers must agree.",
  },
  {
    id: "composite-face-prism-volume",
    title: "Volume of a composite prism",
    summary:
      "A solid is a shape that takes up space, and its faces are its flat outside surfaces. A right prism is a solid whose front face and back face match, joined by rectangles that run straight back. Area is the amount of flat surface a shape covers. The prism's volume, the space it fills, is the area of the front face times its depth, the distance from front to back. The front face can be L-shaped or T-shaped, so first find its area by splitting it into rectangles.",
    templateIds: ["composite-face-prism-volume"],
    senses: {
      face: "face-solid",
      solid: "solid-shape",
      cube: "cube",
      edge: "edge",
      unit: "unit",
      side: "side",
      "left side": "side",
      "right side": "side",
      base: "base-shape",
      square: "square-shape",
    },
    noLink: ["opposite", "whole", "parts"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the area of an L-shaped or T-shaped face by splitting it into rectangles.",
      "Find the volume of a right prism as front-face area × depth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Repeat the same face through the depth",
        paragraphs: [
          "A solid is a shape that takes up space, like a block. Its faces are its flat outside surfaces, and its edges are the lines where faces meet. A cube is a box whose edges all have the same length. Volume is the amount of space a solid fills. It is counted in cubic units: the space inside a cube 1 unit long on each edge, called a unit cube. A cubic centimeter is the space inside a cube 1 cm (one centimeter) long on each edge.",
          "Picture a flat L shape pushed straight back to make a block, like dough pushed through a shaped cutter. The block is a right prism. Its front face and back face match. Every slice cut straight across, facing the same way as the front, is the same L-shape. The depth is how far the block goes back.",
          "The face's area is counted in unit squares, squares 1 unit long on each side. Cut the block into layers 1 cm deep. Put one unit cube on each unit square of the front face, and one layer is full. So each layer holds as many cubes as the face area, and there is one layer for each centimeter of depth. Volume = area of the front face × depth.",
          "To find the face's area, split it into rectangles (four sides, four square corners) and add their areas. Every side runs straight across or straight up and down. Walk once around the outline. The total distance you go right equals the total distance you go left, because you end where you started. The same holds for up and down. So an unlabeled side is a full length minus the other parts along the same direction. For an L with a bottom of 9 and a top of 4, the inner side running across is 9 − 4 = 5.",
        ],
      },
      volumeMeaning,
      {
        title: "Layers of the front face",
        paragraphs: [
          "A right prism has two matching faces that are parallel, here called the front and the back. Rectangles join them, meeting them at square corners. Its depth is the distance from front to back. An L-shaped block is a right prism whose front face is an L.",
          "Slice the prism into layers 1 unit deep. Each layer is a copy of the front face, 1 unit thick. It holds as many unit cubes as the face has unit squares. With a face of 26 square units and a depth of 4, there are 4 layers of 26 cubes: 26 × 4 = 104 cubic units. So volume = area of the front face × depth.",
        ],
        illustration: "av-prism-layers",
      },
      {
        title: "Two ways to the same volume",
        paragraphs: [
          "An L-shaped prism is also two box-shaped prisms joined together. Split the front face into rectangles 8 × 2 and 3 × 4, with a depth of 4. That splits the solid into two boxes. One holds 8 × 2 × 4 = 64 cubic units, and the other holds 3 × 4 × 4 = 48. The total is 64 + 48 = 112. Finding the face area first gives the same result: 16 + 12 = 28, then 28 × 4 = 112.",
          "Before splitting, find any unlabeled sides of the face. Every side runs straight across or straight up and down. So a missing side is a full length minus the other parts along that same direction.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Prism layers",
        paragraphs: [
          "A right prism has two congruent (same size and shape) parallel bases. Here the bases are the front and back faces, even though they stand upright. Its volume is the area of one base times the distance between the bases, measured at a right angle, a square corner. The base may be a composite polygon, a straight-sided shape built from simpler ones, such as an L-shape or a T-shape.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right prism is 5 centimeters deep. Its front face is L-shaped, with sides running only straight across or straight up and down. The bottom is 9 centimeters and the left side is 6 centimeters. The top is 4 centimeters and the right side is 2 centimeters. What is its volume, in cubic centimeters?",
      steps: [
        "Find the unlabeled sides of the face. The bottom, 9, equals the top, 4, plus the inner side running across, so that side is 9 − 4 = 5. The left side, 6, equals the right side, 2, plus the inner side running up and down, so that side is 6 − 2 = 4.",
        "Cut the face straight across, level with the top of the right side, into two rectangles. To find a rectangle's area, multiply how wide it is by how tall it is. The lower one is 9 by 2, with area 9 × 2 = 18. The upper one is 4 by 4, with area 4 × 4 = 16. They cover the face exactly once, so the face area is 18 + 16 = 34 square centimeters.",
        "Each layer 1 cm deep holds 34 unit cubes, and the prism is 5 cm deep. So the volume is 34 × 5 = 170 cubic centimeters.",
      ],
      answer: "170",
      answerUnit: "cubic centimeters",
    },
    pitfalls: [
      "Do not multiply the longest length, width and depth. That gives the volume of the box around the L, not of the L.",
      "Find the face's whole area before multiplying by the depth.",
      "Volume is in cubic units. The face area is in square units.",
    ],
    parentGuide:
      "Build an L-shaped block from interlocking cubes, one layer at a time. Count the cubes in one layer, then multiply by the number of layers.",
  },
  {
    id: "composite-face-prism-surface-area",
    title: "Surface area of a composite prism",
    summary:
      "A solid is a shape that takes up space, and its faces are its flat outside surfaces. A right prism is a solid whose front face and back face match, joined by rectangles that run straight back. Area is the amount of flat surface a shape covers. Surface area is the total area of all the faces: the front, the back, and one rectangle for each side of the front face. The side rectangles together cover the perimeter (the distance around the front face) times the depth (the distance from front to back).",
    templateIds: ["composite-face-prism-surface-area"],
    senses: {
      unit: "unit",
      face: "face-solid",
      solid: "solid-shape",
      edge: "edge",
      side: "side",
      "left side": "side",
      "right side": "side",
      base: "base-shape",
      square: "square-shape",
    },
    noLink: ["boundary", "parts"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find the perimeter (distance around) and the area of an L-shaped or T-shaped face.",
      "Find a right prism's surface area as 2 × face area + perimeter × depth.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count the outside, not the inside",
        paragraphs: [
          "A solid is a shape that takes up space. Its faces are its flat outside surfaces, and an edge is a line where two faces meet. Surface area is the total area of all the faces. It is counted in square units: small squares 1 unit long on each side, such as square meters.",
          "A right prism has a front face and a matching back face. Rectangles join them, running straight back from the front. Its depth is the distance from front to back. An L-shaped front face has 6 sides, so the prism has 6 side rectangles, plus the front and the back: 8 faces in all.",
          "Each side rectangle is as wide as one side of the front face and as long as the depth. Unroll all of them into one long strip. The strip's length is the perimeter of the front face, the total distance around it. Its width is the depth. So the side faces together cover perimeter × depth.",
          "Every side runs straight across or straight up and down. Walk once around the outline. The total distance you go right equals the total distance you go left, because you end where you started. The same holds for up and down. So an unlabeled side is a full length minus the other parts along the same direction. Find every side first, or the perimeter comes out short.",
        ],
      },
      {
        title: "The faces of a right prism",
        paragraphs: [
          "This lesson uses rectangle areas and perimeter, the distance around a shape. A right prism has a front face and a matching back face, joined by rectangles that meet them at square corners. Its depth is the distance from front to back. Surface area is the total area of all the faces.",
          "There is one side rectangle for each side of the front face. Each one is as wide as that side and as long as the depth. An L-shaped face has 6 sides, so an L-shaped prism has 6 side faces plus the front and the back: 8 faces in all.",
        ],
      },
      {
        title: "Unroll the sides",
        paragraphs: [
          "Lay the side rectangles end to end, as in the figure. They form one long rectangle. Its length is the sum of the face's sides, which is the perimeter. Its width is the depth. So the side faces together have area perimeter × depth. The surface area is 2 × face area + perimeter × depth.",
          "For the L-shaped face in the figure, the area is 28, the perimeter is 28 and the depth is 4. So the surface area is 2 × 28 + 28 × 4 = 56 + 112 = 168 square units. Find every side of the face first, including unlabeled ones, or the perimeter will be short.",
        ],
        illustration: "av-prism-unrolled",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Prism faces and the side strip",
        paragraphs: [
          "Call the front and back faces the bases of the prism. Let $B$ be the area of one base, $P$ its perimeter (the distance around it), and $h$ the depth, greater than 0. The two bases add $2B$. The side faces together add $P \\times h$, written $Ph$. So the surface area is $2B + Ph$, counting each outside face once.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A right prism is 3 meters deep. Its front face is L-shaped, with sides running only straight across or straight up and down. The bottom is 8 meters and the left side is 6 meters. The top is 3 meters and the right side is 2 meters. What is its surface area, in square meters?",
      steps: [
        "Find the unlabeled sides. The bottom, 8, equals the top, 3, plus the inner side running across, so that side is 8 − 3 = 5. The left side, 6, equals the right side, 2, plus the inner side running up and down, so that side is 6 − 2 = 4.",
        "Find the face area. Cut the face straight across, level with the top of the right side, into two rectangles. Their areas are 8 × 2 = 16 and 3 × 4 = 12, so the face covers 16 + 12 = 28 square meters. The front and back match, so together they cover 2 × 28 = 56.",
        "Add all six sides of the face to get the perimeter: 8 + 2 + 5 + 4 + 3 + 6 = 28 meters. The side rectangles are 3 m deep, so they cover 28 × 3 = 84 square meters.",
        "Add the front, the back and the side faces: 56 + 84 = 140 square meters.",
      ],
      answer: "140",
      answerUnit: "square meters",
    },
    pitfalls: [
      "Include the inner sides of the L in the perimeter. Each one has its own side face.",
      "Count the front face twice: once for the front and once for the back.",
      "Surface area is in square units. Do not multiply face area by depth: that gives volume, the space inside the prism.",
    ],
    parentGuide:
      "Wrap a strip of paper around the sides of an L-shaped block. Unroll it and measure. Its length is the perimeter of the L, and its width is the block's depth.",
  },
  {
    id: "cylinder-volume",
    title: "Volume of a cylinder",
    summary:
      "A solid is a shape that takes up space. A cylinder is a solid shaped like a can. Its two ends are matching circles, called its bases. Area is the amount of flat surface a shape covers. The cylinder's volume, the amount of space it fills, is the area of one base times the height, the distance between the bases. The radius of a circle is the distance from its middle point to the circle. A circle's area is the number $\\pi$ (pi), about 3.14, times the radius times the radius.",
    templateIds: ["cylinder-volume"],
    senses: {
      side: "side",
      cube: "cube",
      base: "base-shape",
      center: "center",
      squared: "square-number",
      unit: "unit",
      multiples: "multiple",
      face: "face-solid",
      solid: "solid-shape",
    },
    noLink: ["square", "terms", "edge", "rule", "squares"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain why a cylinder's volume is its base area times its height.",
      "Find a cylinder's volume exactly, using $\\pi$, or with 3.14, and find a missing height from the volume.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Stack matching circles",
        paragraphs: [
          "A cylinder is a solid shaped like a can. Its top and bottom are matching circles, called its bases. Its height is the distance between the bases, measured straight up. Picture the can as a stack of thin circles, all the same size. Volume is counted in cubic units, such as cubic centimeters: the space inside a cube 1 cm long on each edge. A layer 1 cm thick holds as many cubic centimeters as the base has square centimeters (squares 1 cm on each side). There is one such layer for each centimeter of height. The base area is the area of one base. So volume = base area × height.",
          "A circle's center is the middle point of the circle. Its radius is the distance from its center to the circle. Its diameter is the distance straight across through the center, so it is 2 times the radius. The number $\\pi$ (pi) is about 3.14. It is the same for every circle: the distance around a circle divided by its diameter.",
          "A circle's area is $\\pi \\times r \\times r$, written $\\pi r^2$. Here $r$ stands for the radius. Squared means multiplied by itself, so $r^2$ ($r$ squared) is $r \\times r$. A circle of radius 5 cm has area $\\pi \\times 5 \\times 5 = 25\\pi$ square centimeters. So a cylinder's volume is $\\pi r^2 h$, with $h$ for the height. Letters written next to each other are multiplied.",
          "An exact answer keeps $\\pi$ as a symbol, such as $45\\pi$. Some problems say the volume is $a\\pi$ and ask for $a$, the number multiplying $\\pi$. If the volume is $45\\pi$, then $a = 45$.",
        ],
      },
      circleFacts,
      {
        title: "A stack of circles",
        paragraphs: [
          "A cylinder has two matching circular bases joined by a curved surface. Its height is the distance between the bases, measured at a right angle (a square corner) to them. Slice it into layers 1 unit thick. Each layer holds the base area's worth of unit cubes, so volume = base area × height. For a circular base, $V = \\pi r^2 h$, where $V$ is the volume, $r$ the radius and $h$ the height. This works for any height, not only heights like 1, 2 or 3.",
          "A cylinder with radius 3 cm and height 5 cm has base area $\\pi \\times 3^2 = 9\\pi$ square centimeters. Its volume is $9\\pi \\times 5 = 45\\pi$ cubic centimeters. Using 3.14 for $\\pi$ gives about 3.14 × 45 = 141.3 cubic centimeters.",
        ],
        illustration: "av-cylinder-stack",
      },
      {
        title: "Diameter and missing height",
        paragraphs: [
          "If a problem gives the diameter, halve it first. A diameter of 8 m means $r = 4$ m, so the base area is $\\pi \\times 4^2 = 16\\pi$ square meters. Using 8 instead of 4 makes the base area four times too large, because $8^2 = 64$ is 4 times $4^2 = 16$.",
          "Volume = base area × height. So the height is the number that, times the base area, gives the volume. Dividing undoes multiplying, so divide the volume by the base area. A cylinder with volume $80\\pi$ and radius 4 has base area $16\\pi$, so its height is $80\\pi \\div 16\\pi = 5$. Here $80\\pi \\div 16\\pi$ is the same as 80 ÷ 16, because $\\pi \\div \\pi = 1$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Circular layers",
        paragraphs: [
          "Take a right circular cylinder, one whose height meets its circular bases at a right angle. Let its radius be $r$ and its height $h$, both greater than 0. Every slice cut straight across, facing the same way as the base, is a circle of area $\\pi r^2$. Stacking those equal layers gives volume $V = \\pi r^2 h$ cubic units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A cylinder has a diameter of 10 centimeters and a height of 6 centimeters. Its volume is $a\\pi$ cubic centimeters. What is $a$?",
      steps: [
        "The area rule needs the radius, which is half the diameter: 10 ÷ 2 = 5 cm.",
        "Find the base area. Multiply the radius by itself, then by $\\pi$: $\\pi \\times 5^2 = \\pi \\times 25 = 25\\pi$ square centimeters.",
        "Multiply by the height to stack 6 cm of layers: $25\\pi \\times 6 = 150\\pi$ cubic centimeters.",
        "The volume is $a\\pi$, and the number multiplying $\\pi$ is 150. So $a = 150$.",
      ],
      answer: "150",
    },
    pitfalls: [
      "Square the radius (multiply it by itself), not the diameter. Halve a diameter first.",
      "$r^2$ means $r \\times r$, not $2 \\times r$.",
      "An exact answer keeps $\\pi$. Multiply by 3.14 only when the problem says to.",
    ],
    parentGuide:
      "Stack coins into a column. Each coin is a thin circle, so the stack's volume is one coin's face area times the height of the stack. Compare two stacks of the same height but different coin sizes.",
  },
  {
    id: "cone-sphere-volume",
    title: "Volume of cones and spheres",
    summary:
      "A solid is a shape that takes up space, and its volume is how much space it fills. A cone is a solid with a circle at the bottom that narrows to a point, like a party hat. It holds exactly one third as much as a cylinder (a can shape) with the same circle and the same height. A sphere is a perfectly round solid, like a ball. It holds two thirds as much as the smallest cylinder that fits around it. These comparisons give the volume rules.",
    templateIds: ["cone-sphere-volume"],
    senses: {
      edge: "edge",
      unit: "unit",
      factor: "factor-number",
      side: "side",
      base: "base-shape",
      center: "center",
      third: "third",
      solid: "solid-shape",
      squared: "square-number",
    },
    noLink: [
      "cube",
      "square",
      "more than",
      "whole",
      "rule",
      "rules",
      "squares",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Find a cone's volume as one third of the matching cylinder's volume.",
      "Find the volume of a sphere or a hemisphere (half a sphere) from its radius, exactly or with 3.14 for $\\pi$.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Compare solids that fit together",
        paragraphs: [
          "Volume is counted in cubic units: the space inside a cube (a box with all edges equal) 1 unit long on each edge, such as cubic centimeters. Area is the amount of flat surface a shape covers, counted in square units: squares 1 unit long on each side. The number $\\pi$ (pi) is about 3.14. The radius is the distance from a circle's middle point to the circle. A circle's area is $\\pi$ times the radius times the radius. A circle of radius 3 has area $\\pi \\times 3 \\times 3 = 9\\pi$.",
          "A cylinder is a solid shaped like a can, with two matching circles as its ends, called bases. Its volume is the base area times the height. A cylinder with radius 3 and height 4 holds $9\\pi \\times 4 = 36\\pi$. In letters, with $r$ for the radius and $h$ for the height, that is $\\pi r^2 h$. Squared means multiplied by itself, so $r^2$ ($r$ squared) is $r \\times r$. Letters written next to each other are multiplied.",
          "A cone has a circle for its base and narrows to a point. Fill a cone with sand and pour it into a cylinder with the same base and height. Exactly three cones fill the cylinder. So the cone's volume is one third of the cylinder's: $\\tfrac{1}{3} \\times 36\\pi = 12\\pi$, or $\\tfrac{1}{3}\\pi r^2 h$ in letters.",
          "A sphere is a perfectly round solid, like a ball. Its center is the point in its exact middle. Its radius is the distance from its center to its surface, and its full width is 2 times the radius. It fills $\\tfrac{2}{3}$ of the cylinder that just fits around it. That gives the rule $\\tfrac{4}{3}\\pi r^3$, where $r^3$ ($r$ cubed) means $r \\times r \\times r$. A hemisphere is half a sphere, so its volume is half of that.",
          "An exact answer keeps $\\pi$ as a symbol instead of replacing it with 3.14. Some problems say the volume is $a\\pi$ and ask for $a$, the number multiplying $\\pi$. If the volume is $288\\pi$, then $a = 288$.",
        ],
      },
      circleFacts,
      {
        title: "Cones",
        paragraphs: [
          "A cone has a circular base and a curved surface that narrows to a single point, its apex. Its height is the distance from the apex straight down to the base, meeting the base at a right angle (a square corner). A cone fills exactly $\\tfrac{1}{3}$ of the cylinder with the same base and height. You can check this by pouring: three cones of sand fill the cylinder.",
          "So a cone's volume $V$ is $V = \\tfrac{1}{3} \\times \\pi r^2 h$. Take radius 3 and height 4. The cylinder holds $\\pi \\times 3^2 \\times 4 = 36\\pi$, and the cone holds $\\tfrac{1}{3} \\times 36\\pi = 12\\pi$.",
        ],
        illustration: "av-cone-sphere-cylinder",
      },
      {
        title: "Spheres and hemispheres",
        paragraphs: [
          "A sphere is a perfectly round solid: every point on its surface is the same distance $r$ from its center. The smallest cylinder that holds it has radius $r$ and height $2r$, the sphere's full width. That cylinder holds $\\pi r^2 \\times 2r = 2\\pi r^3$, because $r^2 \\times r = r \\times r \\times r = r^3$. The sphere fills $\\tfrac{2}{3}$ of it, so $V = \\tfrac{2}{3} \\times 2\\pi r^3 = \\tfrac{4}{3}\\pi r^3$. Archimedes, a mathematician of ancient Greece, proved this over two thousand years ago.",
          "A hemisphere is half a sphere: $V = \\tfrac{1}{2} \\times \\tfrac{4}{3}\\pi r^3 = \\tfrac{2}{3}\\pi r^3$. For $r = 3$, $r^3 = 3 \\times 3 \\times 3 = 27$. The sphere is $\\tfrac{4}{3} \\times 27\\pi = 36\\pi$, and the hemisphere is half of that, $18\\pi$. Cube the radius before multiplying by $\\tfrac{4}{3}$.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Cone and sphere volumes",
        paragraphs: [
          "A cone has one third the volume of a cylinder with the same base area and height: $V = \\tfrac{1}{3}\\pi r^2 h$. A sphere of radius $r$ has volume $V = \\tfrac{4}{3}\\pi r^3$. Both rules need a radius greater than 0, and a cone's height is measured at a right angle to its base.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A sphere has a radius of 6 centimeters. Its volume is $a\\pi$ cubic centimeters. What is $a$?",
      steps: [
        "Cube the radius: multiply three 6s together, $6^3 = 6 \\times 6 \\times 6 = 216$.",
        "Use the sphere rule, $\\tfrac{4}{3}\\pi r^3$: $\\tfrac{4}{3} \\times 216\\pi = 288\\pi$ cubic centimeters, because 216 ÷ 3 = 72 and 72 × 4 = 288.",
        "Check with the cylinder that just fits around the sphere. It has radius 6, and its height is the sphere's full width, 2 × 6 = 12. So it holds $\\pi \\times 6^2 \\times 12 = 432\\pi$. The sphere fills two thirds of it: $\\tfrac{2}{3} \\times 432\\pi = 288\\pi$. So $a = 288$.",
      ],
      answer: "288",
    },
    pitfalls: [
      "Do not forget the $\\tfrac{1}{3}$ for a cone: $\\pi r^2 h$ is the whole cylinder.",
      "A sphere uses $r^3$, not $r^2$. Halve a diameter before cubing.",
      "A hemisphere is half a sphere: $\\tfrac{2}{3}\\pi r^3$.",
    ],
    parentGuide:
      "Fill a paper cone with rice and pour it into a cylinder with the same base and height. Count how many cones fill it. Then compare a ball with a can that just holds it.",
  },
];

export const areaVolumeMethods: Record<string, ProblemMethod> = {
  "triangle-area-base-height": {
    goal: "Find a triangle's area from a base and the height that meets that base at a right angle.",
    senses: {
      unit: "unit",
      side: "side",
      square: "square-shape",
      vertex: "vertex",
      product: "product-multiply",
    },
    noLink: ["base", "opposite", "whole"],
    intuition:
      "Area is the amount of flat surface a shape covers. It is counted in square units: squares 1 unit long on each side, such as square inches. A triangle has three straight sides, and each corner is called a vertex. Pick one side as the base. The height is the distance from the base to the vertex across from it. Perpendicular means meeting at a right angle, a square corner. The height runs along a segment, a straight piece of line, perpendicular to the base. It is often dashed. A slanted side is not the height. Turn a copy of the triangle halfway around and join it along a side that is not the base. Parallel means pointing the same way and never meeting. The two make a parallelogram, a four-sided shape whose facing sides are parallel. It has the same base and height as the triangle. Its area is base × height, so the triangle is half of that.",
    terms: ["height", "perpendicular"],
    method: [
      "Find the base and the height that meets it at a right angle. Ignore the slanted sides.",
      "Multiply base × height. This is the area of the parallelogram two copies make.",
      "Divide by 2, because the triangle is half of that parallelogram.",
    ],
    watch:
      "Use the height that meets the base at a right angle, never a slanted side.",
  },
  "polygon-area-decompose": {
    goal: "Find the area of a parallelogram, trapezoid or pentagon by splitting it into rectangles and triangles.",
    senses: {
      unit: "unit",
      side: "side",
      square: "square-shape",
      vertex: "vertex",
    },
    noLink: ["base", "bases", "opposite", "part", "parts", "whole", "change"],
    intuition:
      "Area is the amount of flat surface a shape covers, counted in square units: squares 1 unit long on each side, such as square feet. A pentagon has five straight sides, and each corner is a vertex. A trapezoid has four sides, with exactly one pair of parallel sides (sides that point the same way and never meet). Cut the shape into rectangles (four square corners) and triangles with no gaps or overlaps. A horizontal line, one running straight across, often makes the cut. Add the pieces' areas, because together they cover the shape exactly once. A rectangle's area is width × height. A triangle's base is the side it sits on, and its height is measured from the base to the far corner at a right angle (a square corner). Its area is half of base × height.",
    terms: ["trapezoid", "decompose"],
    method: [
      "Split the shape into rectangles and triangles, or move one piece to make a rectangle.",
      "Find each piece's base and height. A triangle on top of a rectangle has the total height minus the rectangle's height.",
      "Find each piece's area, then add the pieces.",
    ],
    watch:
      "Give every triangle its height at a right angle to its base, not a slanted side.",
  },
  "net-surface-area": {
    goal: "Find a solid's surface area by adding the areas of all the faces in its net.",
    senses: {
      unit: "unit",
      face: "face-solid",
      edge: "edge",
      solid: "solid-shape",
      net: "net-solid",
      base: "base-shape",
      square: "square-shape",
      side: "side",
    },
    noLink: ["opposite side", "opposite"],
    intuition:
      "A solid is a shape that takes up space, like a box. Its faces are its flat outside surfaces. A net is the flat pattern you get by unfolding all the faces. Area is the amount of flat surface a shape covers, counted in square units: squares 1 unit long on each side, such as square feet. A rectangle has four sides and four square corners. A prism is a solid with two matching ends joined by rectangles. A pyramid has one face at the bottom, its base, and triangles that meet at a point. Surface area is the total area of all the faces, each counted once. A rectangle's area is length × width. A triangle's area is half of base × height: its base is one side, and its height is measured from that side at a right angle, a square corner.",
    terms: ["net-solid", "surface-area"],
    method: [
      "Name every face in the net and its shape.",
      "Find each face's area: length × width for a rectangle, $\\tfrac{1}{2}$ × base × height for a triangle.",
      "Add the areas of all the faces, each one once.",
    ],
    watch:
      "Count every face once, and count matching faces separately: a triangular prism has two triangle ends.",
  },
  "unit-fraction-cube-packing": {
    goal: "Count the fraction-edge cubes that fill a box shape and find its volume.",
    senses: {
      cube: "cube",
      edge: "edge",
      unit: "unit",
      solid: "solid-shape",
      face: "face-solid",
    },
    noLink: ["whole"],
    intuition:
      "A rectangular prism is a box shape. Its faces are its flat outside surfaces, and its edges are the lines where two faces meet. Volume is the space a solid holds. A cube is a box whose edges all have the same length. A cube with edges of $\\tfrac{1}{2}$ inch fits 2 times along each inch. A mixed number is a number such as $2\\tfrac{1}{2}$, which means 2 + $\\tfrac{1}{2}$. To count the cubes along an edge, divide the edge by the small edge: $2\\tfrac{1}{2} \\div \\tfrac{1}{2} = 5$. The cubes form rows, rows make a layer, and layers stack up. So multiply the three counts to get the total.",
    terms: ["unit-fraction", "volume"],
    method: [
      "Divide each edge by the small cube's edge to count the cubes along it.",
      "Multiply the three counts to get the number of cubes.",
      "For the volume, multiply the count by one cube's volume. A cube with $\\tfrac{1}{2}$-inch edges holds $\\tfrac{1}{2} \\times \\tfrac{1}{2} \\times \\tfrac{1}{2} = \\tfrac{1}{8}$ cubic inch.",
    ],
    watch:
      "A cube with edge $\\tfrac{1}{2}$ has volume $\\tfrac{1}{8}$, not $\\tfrac{1}{2}$, because all three edges are halved.",
  },
  "fraction-edge-volume": {
    goal: "Find a box's volume, or a missing edge, when the edge lengths are fractions.",
    senses: {
      edge: "edge",
      cube: "cube",
      unit: "unit",
      solid: "solid-shape",
      face: "face-solid",
      product: "product-multiply",
    },
    noLink: ["whole", "wholes"],
    intuition:
      "A rectangular prism is a box shape, and its edges are the lines where two flat faces meet. Volume is the space it holds, counted in cubic units: the space inside a cube 1 unit long on each edge, such as a cubic centimeter. Volume = length × width × height. A mixed number such as $2\\tfrac{1}{2}$ means 2 + $\\tfrac{1}{2}$. Since 2 is $\\tfrac{4}{2}$, $2\\tfrac{1}{2} = \\tfrac{5}{2}$. To multiply fractions, multiply the top numbers (numerators) and the bottom numbers (denominators). To find a missing edge, multiply the other two edges; the answer is called the product. Divide the volume by that product. Dividing by a fraction is the same as multiplying by its reciprocal, the fraction turned upside down.",
    terms: [
      "mixed-number",
      [
        "reciprocal",
        "Dividing by a fraction is the same as multiplying by its reciprocal.",
      ],
    ],
    method: [
      "Write each mixed number as a fraction.",
      "For volume, multiply length × width × height.",
      "For a missing edge, multiply the two known edges, then divide the volume by that product.",
      "Check by multiplying all three edges back to the volume.",
    ],
    watch:
      "Divide the volume by the product of the known edges, not by their sum (total), then multiply back to check.",
  },
  "composite-area": {
    goal: "Find the area of a figure made of rectangles and triangles.",
    senses: {
      unit: "unit",
      side: "side",
      "left side": "side",
      "right side": "side",
      square: "square-shape",
      difference: "difference-subtract",
      edge: "edge",
    },
    noLink: ["opposite", "part", "parts", "whole", "base", "stem"],
    intuition:
      "A composite figure is a shape built from simpler shapes, such as rectangles (four sides, four square corners). Its area is the flat surface it covers, counted in square units: squares 1 unit long on each side, such as square inches. Split the figure into rectangles and add their areas. Or surround it with one big rectangle and subtract the missing piece. One straight cut across a rectangle's corner removes a right triangle, a triangle with one square corner. Its legs are the two sides at that square corner. Each leg is a full side of the rectangle minus the part of that side that is left. The triangle is half of a rectangle with those legs, so its area is half of leg × leg.",
    terms: ["composite-figure"],
    method: [
      "Find each missing length: a full side minus the other parts along that same side.",
      "Split the figure into rectangles, or subtract a missing piece from a surrounding rectangle.",
      "Find each piece's area, then add or subtract.",
    ],
    watch:
      "Give each rectangle its own length and width; never multiply labels from different parts.",
  },
  "composite-face-prism-volume": {
    goal: "Find the volume of a right prism with an L- or T-shaped face.",
    senses: {
      face: "face-solid",
      solid: "solid-shape",
      cube: "cube",
      edge: "edge",
      unit: "unit",
      side: "side",
      "left side": "side",
      "right side": "side",
      square: "square-shape",
    },
    noLink: ["stem", "opposite", "whole", "parts"],
    intuition:
      "A solid is a shape that takes up space, and its faces are its flat outside surfaces. A right prism is a solid whose front and back faces match, joined by rectangles running straight back. Its depth is the distance from front to back. The sides of the front face are edges of the prism, lines where two faces meet. Volume is the amount of space it fills. It is counted in unit cubes: cubes 1 unit long on each edge, such as cubic centimeters (cm means centimeters). Area is the amount of flat surface a shape covers, counted in unit squares: squares 1 unit long on each side. A layer 1 unit deep holds one unit cube on each unit square, so volume = face area × depth. A T-shaped face is a wide bar on top of a narrower stem. Every side runs straight across or straight up and down. So an unlabeled side is a full length minus the other parts along the same direction.",
    terms: [
      [
        "prism",
        "In a right prism, the side faces are rectangles standing straight up from the base.",
      ],
    ],
    method: [
      "Find the unlabeled sides of the front face.",
      "Split the face into rectangles and add their areas.",
      "Multiply the face area by the depth.",
    ],
    watch:
      "Do not multiply the outer length, height and depth: that is the box around the shape.",
  },
  "composite-face-prism-surface-area": {
    goal: "Find the surface area of a right prism with an L- or T-shaped face.",
    senses: {
      unit: "unit",
      face: "face-solid",
      solid: "solid-shape",
      edge: "edge",
      side: "side",
      "left side": "side",
      "right side": "side",
      square: "square-shape",
    },
    noLink: ["stem", "boundary", "parts"],
    intuition:
      "A solid is a shape that takes up space, and its faces are its flat outside surfaces. A right prism's front and back faces match, joined by rectangles running straight back. Its depth is the distance from front to back. The sides of the front face are edges, lines where two faces meet. Surface area is the total area of all the faces, counted in square units: squares 1 unit long on each side, such as square meters. There is one side rectangle for each side of the front face. Together they cover the perimeter (the distance around the front face) times the depth. Every side runs straight across (horizontal) or straight up and down (vertical). So an unlabeled side is a full length minus the other parts along the same direction.",
    terms: ["perimeter"],
    method: [
      "Find every side of the front face, including unlabeled ones.",
      "Front and back together: 2 × face area.",
      "Side faces: perimeter × depth. Add everything.",
    ],
    watch: "Include the inner sides of the face in the perimeter.",
  },
  "cylinder-volume": {
    goal: "Find a cylinder's volume, or its height, from its radius or diameter.",
    senses: {
      cube: "cube",
      unit: "unit",
      side: "side",
      base: "base-shape",
      center: "center",
      squared: "square-number",
      solid: "solid-shape",
      product: "product-multiply",
    },
    noLink: ["square", "edge", "squares"],
    intuition:
      "A solid is a shape that takes up space. A cylinder is a solid shaped like a can, with matching circles at its ends, called bases. Its height $h$ is the distance between them. Volume is the amount of space it fills, counted in cubic units: the space inside a cube 1 unit long on each edge, such as a cubic meter. Area is the amount of flat surface a shape covers, counted in squares 1 unit on each side. The radius $r$ goes from a circle's middle point to the circle. A circle's center is the middle point of the circle. The diameter goes across through the center and is twice the radius. The number $\\pi$ (pi) is about 3.14. Squared means multiplied by itself. A circle's area is $\\pi r^2$, where $r^2$ ($r$ squared) is $r \\times r$: radius 7 gives $49\\pi$. The base area is the area of one base, and volume = base area × height. If the volume is $a\\pi$, then $a$ is the number multiplying $\\pi$.",
    terms: [
      "radius",
      [
        "base-area",
        "For a cylinder the base is a circle, so the base area is $\\pi r^2$.",
      ],
    ],
    method: [
      "Halve a diameter to get the radius.",
      "Find the base area: $\\pi \\times r^2$.",
      "Volume = base area × height. For a missing height, divide the volume by the base area, because dividing undoes multiplying.",
    ],
    watch: "Square the radius (multiply it by itself), not the diameter.",
  },
  "cone-sphere-volume": {
    goal: "Find the volume of a cone, sphere or hemisphere.",
    senses: {
      unit: "unit",
      side: "side",
      base: "base-shape",
      center: "center",
      third: "third",
      solid: "solid-shape",
      squared: "square-number",
    },
    noLink: ["cube", "square", "edge", "squares"],
    intuition:
      "A solid is a shape that takes up space. Volume is how much space it fills, in cubic units: the space inside a cube 1 unit long on each edge. A cylinder is a solid shaped like a can, with matching circles at its ends, called bases. The radius $r$ goes from a circle's middle point to the circle. A circle's center is the middle point of the circle. The diameter goes across through the center and is twice as long. The number $\\pi$ (pi) is about 3.14. Area is the amount of flat surface a shape covers. Squared means multiplied by itself: $r^2$ is $r \\times r$. A circle's area is $\\pi r^2$. The base area is the area of one base, and a cylinder of height $h$ holds base area × height, $\\pi r^2 h$. A cone, a solid with a circular base that narrows to a point, holds one third of the cylinder with the same base and height. A cone's height is measured straight down from its point to its base, not along its slanted side. A sphere, a perfectly round solid like a ball, has radius $r$ from its center to its surface. It holds $\\tfrac{4}{3}\\pi r^3$, where $r^3$ ($r$ cubed) is $r \\times r \\times r$. A hemisphere is half a sphere. An exact answer keeps $\\pi$. If the volume is $a\\pi$, then $a$ is the number multiplying $\\pi$. The sign $\\approx$ means “is about”.",
    terms: [
      [
        "cone",
        "Its volume is $\\tfrac{1}{3}$ of the cylinder with the same base and height: $V = \\tfrac{1}{3}\\pi r^2 h$.",
      ],
      [
        "sphere",
        "Its volume is $\\tfrac{4}{3}\\pi r^3$, which is $\\tfrac{2}{3}$ of the cylinder that just holds it.",
      ],
    ],
    method: [
      "Halve a diameter to get the radius.",
      "Cone: $\\tfrac{1}{3} \\times \\pi r^2 \\times h$. Sphere: $\\tfrac{4}{3} \\times \\pi r^3$. Hemisphere: half a sphere, $\\tfrac{2}{3}\\pi r^3$.",
      "Keep $\\pi$ for an exact answer, or multiply by 3.14 when told.",
    ],
    watch:
      "Cube the radius ($r \\times r \\times r$) for a sphere, and do not forget the $\\tfrac{1}{3}$ for a cone.",
  },
};

export const areaVolumePrinciples: Record<string, string> = {
  "triangle-area-base-height":
    "Two copies of a triangle form a parallelogram with the same base and height, so the triangle's area is $\\tfrac{1}{2}$ × base × height.",
  "polygon-area-decompose":
    "Area does not change when a shape is cut into pieces and rearranged without gaps or overlaps. So a shape's area is the sum (total) of its pieces' areas.",
  "net-surface-area":
    "Unfolding a solid into its net keeps every face's area. So the surface area is the sum (total) of the net's face areas.",
  "unit-fraction-cube-packing":
    "For any of the numbers $n$ = 1, 2, 3 and so on, a cube with edge $\\tfrac{1}{n}$ unit has volume $\\tfrac{1}{n^3}$ cubic unit, where $n^3 = n \\times n \\times n$. Exactly $n^3$ of them fill a unit cube, a cube 1 unit long on each edge. So counting them gives the same volume as length × width × height.",
  "fraction-edge-volume":
    "Volume = length × width × height holds for fraction edges. So a missing edge is the volume divided by the product of the other two edges.",
  "composite-area":
    "The area of a figure is the sum (total) of the areas of pieces that cover it without overlapping. It is also a larger whole minus the piece removed.",
  "composite-face-prism-volume":
    "A right prism is a stack of copies of its front face, so its volume is the face's area times its depth.",
  "composite-face-prism-surface-area":
    "A right prism's side faces unroll into one rectangle as long as the face's perimeter. So its surface area is 2 × face area + perimeter × depth.",
  "cylinder-volume":
    "A cylinder is a stack of copies of its circular base. So its volume $V$ is $\\pi r^2 \\times h$, with radius $r$ and height $h$.",
  "cone-sphere-volume":
    "A cone holds $\\tfrac{1}{3}$ of the cylinder with the same base and height: $V = \\tfrac{1}{3}\\pi r^2 h$, where $V$ is the volume. A sphere holds $\\tfrac{2}{3}$ of the cylinder that just contains it, which gives $\\tfrac{4}{3}\\pi r^3$.",
};
