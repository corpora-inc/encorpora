import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const shapeLessons: Lesson[] = [
  {
    id: "naming-shapes",
    title: "Naming flat and solid shapes",
    summary:
      "Every shape has a name. A flat shape is a shape you can draw on paper. A side is one straight part of a flat shape's outline. A corner is where two sides meet. To name a flat shape, count its sides and corners. Turning a shape or making it bigger does not change its name.",
    templateIds: ["name-flat-shape", "find-named-shape", "name-solid-shape"],
    senses: {
      side: "side",
      square: "square-shape",
      face: "face-solid",
      solid: "solid-shape",
      cube: "cube",
    },
    noLink: ["change", "part"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name circles, triangles, squares, rectangles and hexagons of any size, turned any way.",
      "Name cubes, cones, cylinders and spheres, and tell a flat shape from a solid one.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Turn it and keep its name",
        paragraphs: [
          "A square is a flat shape with 4 sides that are all equally long. Its corners are square corners, like the corners of a sheet of paper.",
          "Now turn the square so it stands on one corner. It looks like a diamond, but nothing about it changed. It still has 4 equally long sides. It still has 4 square corners. So it is still a square.",
          "A shape's name comes from its sides and corners. Which way it is turned does not matter.",
        ],
      },
      {
        title: "Flat shapes",
        paragraphs: [
          "Look at the picture. Each shape has its name under it.",
          "A triangle has 3 straight sides and 3 corners. A rectangle has 4 straight sides and 4 square corners. A square is a rectangle whose 4 sides are all equally long. A hexagon has 6 straight sides and 6 corners.",
          "A circle is a perfectly round flat shape. Every spot on its outline is just as far from the middle. It has no straight sides and no corners. An oval is round too, but it is stretched, so it is not a circle.",
          "In the picture, one square stands on a corner. It is still a square. A bigger or smaller triangle is still a triangle.",
        ],
        illustration: "flat-shape-names",
      },
      {
        title: "Solid shapes",
        paragraphs: [
          "A solid shape is a shape that is not flat. It takes up space, like a block, a can or a ball. You cannot draw all of it flat on paper.",
          "A face is one flat part of a solid shape's outside. You could set a box down on any of its faces. Some solid shapes also have a curved surface. A curved surface is a part that bends, like the outside of a can.",
          "A cube is a solid shape like a toy block. It has 6 square faces, all the same size. A cylinder is a solid shape like a can. It has 2 flat circle faces with a curved surface wrapped around them. A cone is a solid shape like a party hat. It has 1 flat circle face, a curved surface and a pointed tip. A sphere is a solid shape like a ball. It is perfectly round all over, with no flat faces.",
        ],
        illustration: "solid-shape-names",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "What a shape's name depends on",
        paragraphs: [
          "A flat shape is named by its sides and corners. Count how many there are. Check whether the sides are equally long and whether the corners are square.",
          "A solid shape is named by its faces and curved surfaces. Look at what shape they are and how many. A cone's pointed tip is a clue too. Turning a shape keeps all of these the same. So does making it bigger or smaller without stretching it. So the shape keeps its name.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A shape has 4 straight sides that are all equally long. It has 4 square corners. It stands on one corner. What is it?",
      steps: [
        "Count first: 4 straight sides and 4 square corners. A shape like that is called a rectangle.",
        "All 4 sides are equally long. A rectangle with 4 equally long sides is a square.",
        "Standing on a corner only turns the shape. Turning does not change its sides or its corners, so it is still a square.",
      ],
      answer: "a square",
    },
    pitfalls: [
      "A square turned onto one corner is still a square. Only its direction changed.",
      "Flat or solid? A circle is flat and a sphere is solid. A square is flat and a cube is solid.",
    ],
    parentGuide:
      "Go on a shape hunt at home. A door is a rectangle, a can is a cylinder and a ball is a sphere. Turn a square cracker onto one corner and ask: is it still a square? Why?",
  },
  {
    id: "composing-shapes",
    title: "Putting shapes together",
    summary:
      "You can join small shapes to make a bigger shape. Fit them together with no gaps and no overlaps. An overlap is where one piece covers part of another. The new shape's name comes from its outline, the border all the way around the outside. A side is one straight part of that outline. A corner is where two sides meet.",
    templateIds: ["compose-shape-name", "complete-the-shape"],
    senses: { side: "side", square: "square-shape" },
    noLink: ["part", "whole", "leaves", "third"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Name the bigger shape that smaller shapes make together.",
      "Choose the piece that fills a gap in a shape, turning it if needed.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Look at the new outline",
        paragraphs: [
          "A square is a flat shape with 4 equally long sides and 4 square corners. A paper napkin is a square. A triangle is a flat shape with 3 straight sides and 3 corners. Cut a square of paper from one corner to the far corner. You get two matching triangles. Slide them back together until their longest sides touch.",
          "The sides that touch are now inside the new shape. They make a seam, the place where two pieces meet. Trace only around the outside with your finger. You trace 4 equally long sides and 4 square corners. You made the square again.",
        ],
      },
      {
        title: "Trace the outside",
        paragraphs: [
          "When pieces fit with no gaps and no overlaps, the marks inside are only seams. The new shape is everything inside its outline. Count the outline's sides and corners to name it.",
          "Look at the picture. Two triangles make a square. Six triangles make a hexagon, a flat shape with 6 straight sides and 6 corners.",
          "Turned another way, the same two triangles make a bigger triangle instead. The pieces decide what shapes you can make. A rectangle has 4 straight sides and 4 square corners. Two triangles cut from a long rectangle can make that rectangle again.",
        ],
        illustration: "compose-outline",
      },
      {
        title: "Fill a gap",
        paragraphs: [
          "Sometimes a shape has a gap, an empty space where a piece is missing. The piece that fills it must match the gap. It needs the same number of sides and the same corners. Its sides must be just as long as the gap's sides.",
          "You may turn a piece to make it fit. A piece of the right kind but the wrong size leaves a gap or sticks out.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "The outline of a joined shape",
        paragraphs: [
          "Pieces can join with no gaps and no overlaps. Then the sides they share are inside the new shape. They do not belong to its outline. The outline alone gives the new shape's sides and corners, so it gives the shape's name.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Six matching triangles, each with 3 equally long sides, fit around one spot in the middle with no gaps. What shape is the outline?",
      steps: [
        "Each triangle has one corner at the middle spot. The 2 sides next to that corner touch the neighboring triangles, so they are seams inside.",
        "Each triangle's third side is on the outside. Count around the outside: 6 straight sides, with a corner where each pair of neighbors meets.",
        "A flat shape with 6 straight sides and 6 corners is called a hexagon. So the six triangles make a hexagon.",
      ],
      answer: "a hexagon",
    },
    pitfalls: [
      "Name the whole new shape, not the pieces. Two triangles can make a square.",
      "A piece of the right kind but the wrong size leaves a gap or sticks out.",
    ],
    parentGuide:
      "Fold a square of paper from one corner to the far corner, then cut along the fold. Ask what the two pieces are, and what they make together. Then try making a bigger triangle from the same two pieces.",
  },
  {
    id: "shape-attributes",
    title: "What makes a shape a triangle",
    summary:
      "A side is one straight part of a flat shape's outline. A corner is where two sides meet. A triangle is a flat shape with 3 sides and 3 corners. A triangle can be big or small, tall or wide, or turned any way. It is still a triangle, because it still has 3 sides and 3 corners.",
    templateIds: ["count-sides-corners", "defining-attribute"],
    senses: { side: "side", vertex: "vertex" },
    noLink: ["change", "part", "more than"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Count the sides and corners (vertices) of a closed shape with straight sides.",
      "Tell defining attributes, which every shape of a kind has, from features that can change.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Ask what has to stay the same",
        paragraphs: [
          "Think of three triangles. One is tall and thin. One is short and wide. One is upside down. They look different. Count each one's sides: 3, 3 and 3. Count the corners: 3, 3 and 3.",
          "A defining attribute is a feature every shape of one kind must have. Having 3 straight sides is a defining attribute of a triangle. Size and direction are not. They can change, and the shape is still a triangle.",
        ],
      },
      {
        title: "Count once around",
        paragraphs: [
          "Look at the picture. Start at the dot and go around the shape. Count each straight side as you pass it. Stop when you are back at the dot.",
          "A closed shape is a shape whose outline has no gaps or openings. Each side ends at a corner, so a closed shape has as many corners as sides. The shape in the picture has 5 sides, so it has 5 corners.",
          "Another name for a corner is a vertex. When there is more than one, we say vertices.",
        ],
        illustration: "count-around",
      },
      {
        title: "What can change, and what cannot",
        paragraphs: [
          "Every triangle has exactly 3 straight sides and 3 corners. Those are its defining attributes.",
          "A triangle can be big or small. It can be turned any way, and it can be tall or wide. Its sides do not have to be equally long. None of these change what it is.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Defining and changeable attributes",
        paragraphs: [
          "A triangle is a closed flat shape with exactly 3 straight sides. They meet at 3 corners, called vertices. Its size, its direction and how long each side is can all be different. Its defining attributes stay the same.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "One triangle is small, with its tip at the bottom. Another is large, with its tip at the top. Which is true of both: they have 3 sides, or they have a tip at the top?",
      steps: [
        "The first triangle has its tip at the bottom. So having a tip at the top is not true of both.",
        "Count the sides of each one. Both have exactly 3 straight sides and 3 corners.",
        "Every triangle has 3 sides. That is a defining attribute, so it is true of both.",
      ],
      answer: "They have 3 sides.",
    },
    pitfalls: [
      "Count a corner only where the outline turns. Stop when you are back at the start.",
      "A triangle does not need a flat bottom or equally long sides to be a triangle.",
    ],
    parentGuide:
      "Make triangles from straws or sticks: long, short, thin and upside down. Each time, ask whether it is still a triangle, and why.",
  },
];

const terms = {
  flat: ["side", "corner"],
  solid: ["solid-shape", "face-solid"],
  compose: [
    ["decompose", "A seam is a line inside the shape where two pieces meet."],
    ["decompose", "The outside edge is the outline of the whole joined shape."],
  ],
} satisfies Record<string, MethodTerm[]>;
export const shapeMethods: Record<string, ProblemMethod> = {
  "name-flat-shape": {
    goal: "Name a flat shape by counting its sides and corners.",
    intuition:
      "A flat shape is a shape you can draw on paper. A side is one straight part of its outline. A corner is the point where two sides meet. A circle is a perfectly round shape with no sides. A square has 4 equally long sides and 4 square corners, like the corners of a page. Turning a shape does not change its name.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["change", "edge", "part"],
    terms: terms.flat,
    method: [
      "Is the outline perfectly round, with no corners? Then it is a circle.",
      "If not, count the straight sides. With 3 sides, it is a triangle. With 6 sides, it is a hexagon.",
      "With 4 sides and 4 square corners, it is a square if all 4 sides are equally long. If they are not, it is a rectangle.",
    ],
    watch:
      "Size and direction do not matter. A tilted square is still a square.",
  },
  "find-named-shape": {
    goal: "Given a shape's name, choose the one shape of that kind.",
    intuition:
      "A side is one straight part of a flat shape's outline. A corner is the point where two sides meet. Each shape name means a set number of sides and corners. A hexagon is a shape with 6 sides and 6 corners. A circle is a perfectly round shape with no sides and no corners.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["edge", "part"],
    terms: terms.flat,
    method: [
      "Say what the named shape must have, such as 6 straight sides for a hexagon.",
      "Check each shape for exactly that number of sides and corners.",
      "Choose the one that has it. Its size and direction do not matter.",
    ],
    watch:
      "Count carefully. A shape with 5 sides is not a hexagon, and an oval, a stretched circle, is not a circle.",
  },
  "name-solid-shape": {
    goal: "Name a solid shape by looking at its faces and surfaces.",
    intuition:
      "A solid shape is a shape that is not flat, like a block or a ball. A face is one flat part of its outside. A curved surface is a part that bends, like the outside of a can. A circle is a perfectly round flat shape. A corner is where two sides meet. A square is a flat shape with 4 equally long sides and 4 square corners.",
    senses: {
      solid: "solid-shape",
      face: "face-solid",
      cube: "cube",
      square: "square-shape",
      edge: "edge",
    },
    noLink: ["side", "part", "sides"],
    terms: terms.solid,
    method: [
      "Is it perfectly round all over, with no flat faces? It is a sphere.",
      "Does it have 1 flat circle face, a curved surface and a pointed tip? It is a cone.",
      "Does it have 2 flat circle faces with a curved surface between them? It is a cylinder.",
      "Does it have 6 square faces, all the same size? It is a cube.",
    ],
    watch: "A cube's faces are flat squares, but the cube itself is solid.",
  },
  "compose-shape-name": {
    goal: "Name the whole shape that fitted pieces make together.",
    intuition:
      "Pieces that fit with no gaps and no overlaps make one new shape. An overlap is where one piece covers another. A seam is a place inside where two pieces touch. The outline is the border around the outside. A side is one straight part of the outline. A corner is where two sides meet. A triangle is a shape with 3 sides and 3 corners.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["edge", "whole", "part"],
    terms: terms.compose,
    method: [
      "Skip the seams inside. They are not part of the outline.",
      "Trace the outline and count its sides and corners.",
      "Name the shape the outline makes, such as a hexagon for 6 sides.",
    ],
    watch: "Name the whole shape, not the pieces inside it.",
  },
  "complete-the-shape": {
    goal: "Choose the piece that fills the gap in a shape.",
    intuition:
      "A gap is the empty space where a piece is missing. A side is one straight part of the gap's border. A corner is where two sides meet. A square is a shape with 4 equally long sides and 4 square corners. The right piece has the same sides and corners as the gap, and the same size. You may turn it to make it fit.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["edge", "part"],
    terms: terms.compose,
    method: [
      "Look at the gap. Count its sides and see which are long and which are short.",
      "Find the piece with the same sides and corners. It may be turned.",
      "Check that it is the same size as the gap.",
    ],
    watch:
      "A piece of the right kind that is bigger, smaller or stretched will not fit.",
  },
  "count-sides-corners": {
    goal: "Count the sides or corners of a closed shape with straight sides.",
    intuition:
      "A side is one straight part of a flat shape's outline. A corner is the point where two sides meet. Another name for a corner is a vertex. A closed shape is a shape whose outline has no gaps. In a closed shape, each side ends at a corner. So there are as many corners as sides.",
    senses: { side: "side", vertex: "vertex" },
    noLink: ["part"],
    terms: terms.flat,
    method: [
      "Start at one corner and remember it.",
      "Go around the shape, counting each side as you pass it.",
      "Stop when you are back at the start. There are as many corners as sides.",
    ],
    watch: "Count each side once. Mark where you started.",
  },
  "defining-attribute": {
    goal: "Choose the sentence that is true of every shape of one kind.",
    intuition:
      "A side is one straight part of a flat shape's outline. A corner is the point where two sides meet. A defining attribute is a feature every shape of one kind must have. A triangle is a shape with 3 sides and 3 corners, whatever its size or direction.",
    senses: { side: "side", square: "square-shape" },
    noLink: ["change", "part"],
    terms: terms.flat,
    method: [
      "Test each sentence on every shape shown.",
      "Cross out a sentence as soon as one shape breaks it.",
      "The sentence left is about sides and corners. That is the defining attribute.",
    ],
    watch:
      "Size, direction and stretching can change, and the shape keeps its name.",
  },
};
export const shapePrinciples: Record<string, string> = {
  "name-flat-shape":
    "A flat shape is named by its sides and corners, not by its size or the way it is turned.",
  "find-named-shape":
    "Every shape of one kind has the same number of sides and corners, however it is drawn.",
  "name-solid-shape":
    "A solid shape is named by its flat faces and curved surfaces: what shape they are and how many.",
  "compose-shape-name":
    "Shapes joined with no gaps make a new shape. Its name comes from its outline.",
  "complete-the-shape":
    "A piece fits a gap when its sides and corners match the gap's. Turning the piece does not change it.",
  "count-sides-corners":
    "Going once around a closed shape passes every side once, and each side ends at a corner.",
  "defining-attribute":
    "Every shape of one kind has its defining attributes, such as its number of sides. Size and direction can be different.",
};
