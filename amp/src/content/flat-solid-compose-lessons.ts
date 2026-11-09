import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * Lessons, methods and principles for flat or solid (K.G.A.3) and composite
 * shapes (1.G.A.2). The pictures stand in for shapes a child can hold, and
 * the composite items choose or name; building a composite by hand is not
 * assessed here.
 */

const shapeSenses = {
  square: "square-shape",
  squares: "square-shape",
  face: "face-solid",
  faces: "face-solid",
  side: "side",
  sides: "side",
};

export const flatSolidComposeMethods: Record<string, ProblemMethod> = {
  "flat-or-solid-name": {
    goal: "Say whether a drawn shape is flat or solid, then choose its name.",
    intuition:
      "A flat shape lies on the page, like a drawing. You see only its front, and you could trace all of it with your finger. A solid shape takes up room, like a block, a can or a ball. You see its front and some of its sides, and it could stand on a table. A face is one flat part of a solid's outside. A cube has square faces, but a cube is not a square.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: [
      "solid-shape",
      "face-solid",
      "square-shape",
      "cube",
      "circle",
      "sphere",
      "cylinder",
      "cone",
    ],
    method: [
      "Ask: could it lie flat on the page, or could it stand on a table and take up room? That tells flat or solid.",
      "Name it: count a flat shape's sides and corners, or look at a solid's faces and curved sides.",
    ],
    watch:
      "A cube is not a square, and a ball is not a circle. Look for sides you can see before you choose a flat name.",
  },
  "pick-flat-or-solid": {
    goal: "Choose every flat shape, or every solid shape, in a lettered row of shapes.",
    intuition:
      "A flat shape shows only its front, like a drawing on the page. A solid shape takes up room, so you can see its sides too, and hidden edges are drawn dashed. Shapes that look alike, such as a square and a cube, belong to different groups.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: ["solid-shape", "square-shape", "cube", "side"],
    method: [
      "Say the word the question asks for: flat or solid.",
      "Go along the row from A. For each shape ask: can you see its sides, or only its front? Choose each one that matches.",
    ],
    watch:
      "Color and size do not tell flat from solid. A big colored shape can be flat, and a small shape with sides showing is solid.",
  },
  "count-flat-or-solid": {
    goal: "Count how many shapes in a row are solid, or how many are flat.",
    intuition:
      "A flat shape shows only its front. A solid shape takes up room, so you see its sides too. To count one kind, look at every shape and say which kind it is.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: ["solid-shape", "side"],
    method: [
      "Point to each shape in turn and say flat or solid.",
      "Count only the shapes of the kind the question names. The last number you say is the answer.",
    ],
    watch:
      "Count only the kind the question names, not every shape in the row.",
  },
  "composite-shape-name": {
    goal: "Name the new shape that pieces make when they are put together with their sides touching.",
    intuition:
      "When pieces fit with their sides touching, with no gaps and no overlaps, they make a new shape. The lines inside are seams, the places where two pieces meet. The new shape is named by its outside edge only. Two triangles can make a square. Two cubes, solids with 6 square faces, can make a longer block called a rectangular prism.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: [
      "square-shape",
      "rectangle",
      "triangle",
      "trapezoid",
      "circle",
      "cube",
      "cylinder",
      "corner",
    ],
    method: [
      "Trace only the outside edge. The seams inside do not count.",
      "Count the sides and corners of that edge, or look at the faces of the whole solid, and name the new shape.",
    ],
    watch:
      "Name the new shape by its own outside edge, not after its pieces, and do not add up the pieces' sides.",
  },
  "composite-which-pieces": {
    goal: "Choose the set of flat pieces that can be put together to make a shape on a grid.",
    intuition:
      "Pieces make a shape when they cover all of it, with their sides touching, no gaps and no overlaps. You may turn a piece or slide it. The grid squares help you compare sizes: a piece with sides 2 grid units long is twice as long as one with sides of 1 grid unit.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: ["square-shape", "triangle", "rectangle", "trapezoid", "circle"],
    method: [
      "Compare each set's pieces with the grid squares: are they the right size for the shape?",
      "Picture turning and sliding the pieces into the shape. They must cover all of it, using every piece, with no gaps and no overlaps.",
    ],
    watch:
      "Check the size and the number of pieces, not only their kind. Pieces of the right kind can be too big, too small, or one short.",
  },
  "composite-which-solids": {
    goal: "Choose the solids that were put together to build a bigger solid.",
    intuition:
      "A solid takes up room, like a block or a can. Solids can be stacked or set side by side to build a new shape. The lines where they meet are seams. Each piece between seams is one solid, and it keeps its own name.",
    senses: shapeSenses,
    noLink: ["part"],
    terms: ["solid-shape", "face-solid", "cube", "cylinder", "cone", "prism"],
    method: [
      "Find the seams. Each piece between seams is one solid.",
      "Name each piece by its faces: square faces all the same size make a cube, round ends with a curved side make a cylinder, and a round bottom with a point makes a cone.",
    ],
    watch:
      "Name every piece, the bottom one too. A cube and a longer block, a rectangular prism, are different choices.",
  },
};

export const flatSolidComposePrinciples: Record<string, string> = {
  "flat-or-solid-name":
    "A flat shape (two-dimensional) lies in the page: you see only its front. A solid shape (three-dimensional) takes up room: you see its front and some of its sides. A solid's faces can be flat shapes, but the solid is not that flat shape: a cube has square faces and is not a square.",
  "pick-flat-or-solid":
    "Every shape is flat or solid, never both. A flat shape shows only its front; a solid shows its sides too. Size, color and which way a shape is turned do not change which group it is in.",
  "count-flat-or-solid":
    "To count one kind of shape, decide flat or solid for every shape once, and count only the ones of the kind asked for.",
  "composite-shape-name":
    "Pieces put together with their sides touching, with no gaps and no overlaps, make a new shape. The new shape is named by its own outside edge (or, for solids, its own faces); the seams between the pieces are not sides of the new shape.",
  "composite-which-pieces":
    "A set of pieces makes a shape when every piece is used and together they cover the shape exactly, with no gaps and no overlaps. Pieces may be turned or flipped and slid. The wrong size, the wrong kind or one piece too few cannot cover it.",
  "composite-which-solids":
    "A composite solid is built from simpler solids. Each piece between seams keeps its own name: a cube, a rectangular prism, a cylinder or a cone.",
};

export const flatSolidComposeLessons: Lesson[] = [
  chainLesson({
    id: "flat-solid-compose-flat-or-solid-lesson",
    title: "Flat shapes and solid shapes",
    summary:
      "A flat shape lies on the page and shows only its front. A solid shape takes up room and shows its sides too. A cube has square faces, but it is not a square.",
    senses: shapeSenses,
    noLink: ["part"],
    templateIds: [
      "flat-or-solid-name",
      "pick-flat-or-solid",
      "count-flat-or-solid",
    ],
    objectives: [
      "Tell whether a drawn shape is flat or solid, even when a solid looks like a flat shape.",
      "Choose or count all the flat shapes, or all the solid shapes, in a row.",
    ],
    openingTitle: "Could it lie on the page?",
    opening: [
      "A flat shape lies on the page, like a drawing. You see only its front. You could trace all of it with your finger. Circles, triangles, squares, rectangles and hexagons are flat.",
      "A solid shape takes up room, like a block, a can or a ball. It could stand on a table. In a picture you see its front and some of its sides. Edges at the back are drawn dashed. Cubes, cylinders, cones and spheres are solid.",
      "Some pairs look alike. A cube has square faces, but a cube is not a square. A face is one flat part of a solid's outside. A ball looks round like a circle, but a circle is flat and a ball is not.",
    ],
    example: {
      prompt:
        "A row shows a square, a cube, a circle and a sphere. How many of these shapes are solid?",
      steps: [
        "The square shows only its front, so it is flat.",
        "The cube shows its top and its sides, so it is solid: 1.",
        "The circle is flat. The sphere is a ball that takes up room, so it is solid: 2.",
      ],
      answer: "2",
    },
    methodTitle: "Flat or solid, then the name",
    method: [
      "Ask: could it lie flat on the page, or could it stand on a table and take up room?",
      "Then name it. Count a flat shape's sides and corners. Look at a solid's faces and curved sides.",
    ],
    formalTitle: "Two kinds of shapes",
    formal: [
      "A flat shape is two-dimensional: it lies in a plane, so it has length and width but no depth.",
      "A solid shape is three-dimensional: it takes up space. Its faces can be flat shapes, but the solid is a different shape from any of its faces.",
    ],
    pitfalls: [
      "Calling a cube a square, or a sphere a circle, because one face or one view looks like it.",
      "Deciding by color or size: a big colored shape can be flat, and a small one can be solid.",
    ],
    parentGuide:
      "Hold up a block and a paper square. Ask which one could lie flat on the page and which one takes up room, then ask your learner to find more of each around the house.",
  }),
  chainLesson({
    id: "flat-solid-compose-composite-lesson",
    title: "Putting shapes together",
    summary:
      "Pieces put together with their sides touching make a new shape. Name the new shape by its outside edge. Choose the pieces that make a shape, and name the solids a bigger solid is built from.",
    senses: shapeSenses,
    noLink: ["part"],
    templateIds: [
      "composite-shape-name",
      "composite-which-pieces",
      "composite-which-solids",
    ],
    objectives: [
      "Name the new flat shape or solid that pieces make together.",
      "Choose the pieces that make a shape, and name the solids used to build a bigger solid.",
    ],
    openingTitle: "Sides touching, no gaps",
    opening: [
      "Cut a paper square from one corner to the far corner. You get two triangles. Slide them back together so their long sides touch. You made the square again. The line between them is a seam, the place where two pieces meet.",
      "A new shape is named by its outside edge only. Trace around the outside and count the sides and corners. The seams inside are not sides of the new shape.",
      "Solids join the same way. Two cubes stacked make a taller block. A cube is a solid with 6 square faces. The taller block is not a cube, because its faces are not all squares. It is a rectangular prism, a box shape.",
    ],
    example: {
      prompt:
        "Two half-circles are put together along their straight sides. What shape do they make?",
      steps: [
        "Each half-circle has one straight side and one curved edge.",
        "Put together along the straight sides, the straight sides become one seam inside.",
        "The outside edge is curved all the way around with no corners, so the new shape is a circle.",
      ],
      answer: "A circle",
    },
    methodTitle: "Trace the outside, then name it",
    method: [
      "Trace only the outside edge and count its sides and corners. For solids, look at the faces of the whole shape.",
      "To choose pieces, check their size against the grid and picture them covering the whole shape.",
      "To name the solids used, find the seams and name each piece by its faces.",
    ],
    formalTitle: "Composing shapes",
    formal: [
      "Shapes compose a new shape when they meet edge to edge, or face to face for solids, with no gaps and no overlaps. The new shape can be used as one piece to make a bigger shape.",
      "The flat pieces here are squares, rectangles, triangles, trapezoids, half-circles and quarter-circles. The solids are cubes, rectangular prisms, cylinders and cones.",
    ],
    pitfalls: [
      "Naming the new shape after one of its pieces, such as calling two triangles a triangle.",
      "Adding the pieces' sides together, which counts the seams as sides.",
    ],
    parentGuide:
      "Cut paper squares into triangles and ask your learner what shapes two or four triangles make. Stack two blocks and ask whether the new block is still a cube.",
  }),
];

export const flatSolidComposeFacetMappings: FacetMapping[] = [
  {
    templateId: "flat-or-solid-name",
    facetId: "name-shapes.solid-names",
    extent: "partial",
    rationale:
      "Says whether one drawn shape is flat or solid, then names it among choices that include its look-alike (cube and square, sphere and circle, cone and triangle, cylinder and circle or rectangle). Drawings stand in for objects the child can hold.",
  },
  {
    templateId: "pick-flat-or-solid",
    facetId: "name-shapes.solid-names",
    extent: "partial",
    rationale:
      "Chooses every flat or every solid shape in a lettered row of 4 to 6 distinct shapes, with fill, size and turn varied so they do not predict the answer. The number to choose is shown, so a row never has exactly one to choose.",
  },
  {
    templateId: "count-flat-or-solid",
    facetId: "name-shapes.solid-names",
    extent: "partial",
    rationale:
      "Counts the flat or the solid shapes in a row of 4 to 6, including rows built from look-alike pairs. It does not ask for names.",
  },
  {
    templateId: "composite-shape-name",
    facetId: "composite-shapes.core",
    extent: "partial",
    rationale:
      "Names the flat shape that squares, rectangles, triangles, trapezoids, half-circles and quarter-circles make with their sides touching, and the solid that two equal cubes, cylinders or rectangular prisms make. It names a composite; building one is not assessed.",
  },
  {
    templateId: "composite-which-pieces",
    facetId: "composite-shapes.core",
    extent: "partial",
    rationale:
      "Chooses the one set of pieces that covers a shape on a grid exactly; the other sets have the wrong size, the wrong kinds or one piece too few. Choosing stands in for placing the pieces.",
  },
  {
    templateId: "composite-which-solids",
    facetId: "composite-shapes.core",
    extent: "partial",
    rationale:
      "Chooses the cubes, rectangular prisms, cylinders and cones used to build a composite solid whose seams show. Composing new shapes from a composite is shown in the lesson but not assessed.",
  },
];
