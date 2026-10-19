import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const shapeLessons: Lesson[] = [
  {
    id: "naming-shapes",
    title: "Naming flat and solid shapes",
    summary:
      "A shape's name comes from its sides and corners, or its faces, never from its size or the way it is turned.",
    templateIds: ["name-flat-shape", "find-named-shape", "name-solid-shape"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name circles, triangles, squares, rectangles and hexagons in any size or orientation.",
      "Name cubes, cones, cylinders and spheres, and tell a flat shape from a solid one.",
    ],
    sections: [
      {
        title: "Flat shapes",
        paragraphs: [
          "A triangle has 3 straight sides and 3 corners. A rectangle has 4 straight sides and 4 square corners; a square is a rectangle whose 4 sides are all the same length. A hexagon has 6 straight sides. A circle has one curved edge and no corners.",
          "Turning a shape or making it bigger does not change its name. A square standing on a corner is still a square.",
        ],
        illustration: "flat-shape-names",
      },
      {
        title: "Solid shapes",
        paragraphs: [
          "A flat shape lies on paper. A solid shape takes up space and can be picked up. Its flat surfaces are faces.",
          "A cube has 6 square faces. A cylinder has two circle faces joined by a curved surface. A cone has one circle face and a point. A sphere is round every way, like a ball.",
        ],
        illustration: "solid-shape-names",
      },
    ],
    workedExample: {
      prompt:
        "A shape has 4 straight sides of the same length and 4 square corners. It stands on one corner. What is it?",
      steps: [
        "4 straight sides and 4 square corners make a rectangle.",
        "All 4 sides are the same length, so it is a square.",
        "Standing on a corner does not change the name.",
      ],
      answer: "a square",
    },
    pitfalls: [
      "A square turned on its corner is not a new shape; it is still a square.",
      "A circle is flat; a sphere is solid. A square is flat; a cube is solid.",
    ],
    parentGuide:
      "Hunt for shapes at home: a door is a rectangle, a can is a cylinder, a ball is a sphere. Turn a square cracker on its corner and ask whether it is still a square.",
  },
  {
    id: "composing-shapes",
    title: "Putting shapes together",
    summary:
      "Small shapes fitted edge to edge make a new, larger shape; name it by its outside edge.",
    templateIds: ["compose-shape-name", "complete-the-shape"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the larger shape that smaller shapes make together.",
      "Choose the piece that completes a shape, turning it if needed.",
    ],
    sections: [
      {
        title: "Trace the outside",
        paragraphs: [
          "When shapes are joined with no gaps and no overlaps, the lines inside are only seams. The new shape is the outside edge: count its sides and corners.",
          "Two triangles can make a square, a rectangle or a larger triangle. Six triangles can make a hexagon.",
        ],
        illustration: "compose-outline",
      },
      {
        title: "Fill a gap",
        paragraphs: [
          "The piece that fills a gap has the same number of sides, the same side lengths and the same corners as the empty space.",
          "A piece can be turned to fit. A piece of the right kind but the wrong size does not fit.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Six triangles meet at a point in the middle. What shape is the outside edge?",
      steps: [
        "Each triangle gives one side to the outside edge.",
        "Around the outside there are 6 straight sides and 6 corners.",
        "The six triangles make a hexagon.",
      ],
      answer: "a hexagon",
    },
    pitfalls: [
      "Name the whole shape, not the pieces: two triangles can make a square.",
      "A piece that is the right kind but the wrong size leaves a gap or sticks out.",
    ],
    parentGuide:
      "Cut a square of paper along its diagonal and ask what the two pieces are, then what they make together again. Try making a larger triangle or a rectangle from the same pieces.",
  },
  {
    id: "shape-attributes",
    title: "What makes a shape a triangle",
    summary:
      "Sides and corners define a shape; size, direction and how stretched it is do not.",
    templateIds: ["count-sides-corners", "defining-attribute"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the sides and corners (vertices) of a closed straight-sided shape.",
      "Tell defining attributes from attributes that can change.",
    ],
    sections: [
      {
        title: "Count once around",
        paragraphs: [
          "Start at one corner and go around the shape, counting each straight side, until you are back at the start. Each side ends at a corner, so a closed shape has as many corners as sides.",
          "A corner is also called a vertex. The plural is vertices.",
        ],
        illustration: "count-around",
      },
      {
        title: "What can change, and what cannot",
        paragraphs: [
          "Every triangle has exactly 3 straight sides and 3 corners. That is what makes it a triangle.",
          "A triangle can be big or small, point any way, and be tall or wide. Its sides do not have to be the same length. None of these change what it is.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One triangle is small and points down. Another is large and points up. Which of these is true of both: they have 3 sides, or they point up?",
      steps: [
        "The first one points down, so pointing up is not true of both.",
        "Both have exactly 3 straight sides and 3 corners.",
        "Having 3 sides is true of every triangle.",
      ],
      answer: "They have 3 sides.",
    },
    pitfalls: [
      "Count a corner only where the edge turns, and stop when you are back at the start.",
      "A triangle does not need a flat bottom or equal sides to be a triangle.",
    ],
    parentGuide:
      "Make triangles from straws or sticks: long, short, thin, turned upside down. Ask each time whether it is still a triangle, and why.",
  },
];

const terms = {
  flat: [
    ["side", "A straight edge of a flat shape."],
    ["corner", "Where two sides meet. Also called a vertex."],
  ],
  solid: [
    ["solid shape", "A shape that takes up space, like a block or a ball."],
    ["face", "A flat surface of a solid shape."],
  ],
  compose: [
    ["seam", "A line inside where two pieces meet."],
    ["outside edge", "The boundary of the whole joined shape."],
  ],
} satisfies Record<string, [string, string][]>;
export const shapeMethods: Record<string, ProblemMethod> = {
  "name-flat-shape": {
    goal: "Given one flat shape, name it.",
    terms: terms.flat,
    method: [
      "Is the edge curved with no corners? It is a circle.",
      "Otherwise count the straight sides: 3 is a triangle, 6 is a hexagon.",
      "For 4 sides with square corners: equal sides make a square, otherwise a rectangle.",
    ],
    watch: "Ignore size and direction: a tilted square is still a square.",
  },
  "find-named-shape": {
    goal: "Given a shape name, choose the one shape of that kind.",
    terms: terms.flat,
    method: [
      "Say what the named shape must have, such as 6 straight sides.",
      "Check each shape for exactly that.",
      "Choose the one that has it, whatever its size or direction.",
    ],
    watch:
      "Near misses matter: a 5-sided shape is not a hexagon, and an oval is not a circle.",
  },
  "name-solid-shape": {
    goal: "Given a solid shape, name it.",
    terms: terms.solid,
    method: [
      "No flat faces at all: a sphere.",
      "One circle face and a point: a cone. Two circle faces and a curved side: a cylinder.",
      "Six square faces: a cube.",
    ],
    watch: "A cube's face is a square, but the cube itself is solid.",
  },
  "compose-shape-name": {
    goal: "Given pieces fitted together, name the whole shape.",
    terms: terms.compose,
    method: [
      "Ignore the seams inside.",
      "Trace the outside edge and count its sides and corners.",
      "Name the shape the outside edge makes.",
    ],
    watch: "Name the whole, not the pieces.",
  },
  "complete-the-shape": {
    goal: "Given a shape with a gap, choose the piece that fills it.",
    terms: terms.compose,
    method: [
      "Look at the gap: count its sides and compare their lengths.",
      "Find the piece with the same sides and corners, turned if needed.",
      "Check it is the same size as the gap.",
    ],
  },
  "count-sides-corners": {
    goal: "Given a closed straight-sided shape, count its sides or corners.",
    terms: terms.flat,
    method: [
      "Start at one corner.",
      "Count each side as you go around.",
      "Stop when you are back at the start; there are as many corners as sides.",
    ],
    watch: "Count each side once: mark where you started.",
  },
  "defining-attribute": {
    goal: "Given several shapes of one kind, choose what is true of every shape of that kind.",
    terms: terms.flat,
    method: [
      "Test each sentence on every shape shown.",
      "Drop a sentence as soon as one shape breaks it.",
      "The sentence left is about sides and corners: that is what defines the shape.",
    ],
    watch:
      "Size, direction and stretching can change without changing the shape's name.",
  },
};
export const shapePrinciples: Record<string, string> = {
  "name-flat-shape":
    "A flat shape is named by its sides and corners, not by its size or direction.",
  "find-named-shape":
    "Every shape of a kind has that kind's sides and corners, however it is drawn.",
  "name-solid-shape":
    "A solid shape is named by its faces: flat or curved, and how many.",
  "compose-shape-name":
    "Shapes joined edge to edge make a new shape whose name comes from its outside edge.",
  "complete-the-shape":
    "A piece fits a gap when its sides and corners match the gap's; turning it does not change it.",
  "count-sides-corners":
    "Going once around a closed shape meets every side once, and each side ends at a corner.",
  "defining-attribute":
    "Defining attributes, such as the number of sides, belong to every shape of a kind; size and direction do not.",
};
