import type { MethodTerm } from "../glossary/types";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const volumeCoordinateLessons: Lesson[] = [
  {
    id: "volume-unit-cubes",
    title: "Volume: count cubes by layers",
    summary:
      "Volume is how much space a solid takes up. A unit cube is a cube whose edges are each 1 unit long. To find a volume, count the unit cubes that fill the solid, with no gaps and no overlaps. A rectangular prism is a box shape with 6 rectangle faces. You can count its cubes quickly, one layer at a time.",
    templateIds: ["unit-cube-volume", "cube-layer-count"],
    senses: {
      cube: "cube",
      face: "face-solid",
      edge: "edge",
      solid: "solid-shape",
      unit: "unit",
      square: "square-shape",
    },
    noLink: ["side"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain volume as a count of unit cubes with no gaps or overlaps.",
      "Find the volume of a prism built from cubes by counting one layer and multiplying by the number of layers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fill the space with cubes",
        paragraphs: [
          "Picture an empty box. Fill it with small cubes, each 1 unit long, 1 unit wide and 1 unit high. Pack them with no gaps and no overlaps. The number of cubes that fit is the box's volume.",
          "Each unit cube counts as 1 cubic unit. So we write a volume in cubic units, such as 24 cubic units.",
        ],
      },
      {
        title: "What volume measures",
        paragraphs: [
          "Look at the picture. It shows a prism 4 cubes long, 3 cubes wide and 2 cubes high. It is lifted apart into its two layers.",
          "A drawing of a prism shows only three faces: the top, the front and one side. Cubes in the middle and at the back are hidden. So counting the squares you can see gives the wrong number. Count by layers instead.",
        ],
        illustration: "volume-layers",
      },
      {
        title: "Count by layers",
        paragraphs: [
          "A layer is one flat level of cubes covering the bottom of the prism. Every layer of a rectangular prism matches the top face. The top face shows rows of cubes, so rows times cubes in each row gives one layer.",
          "In the picture, one layer has 4 × 3 = 12 cubes. There are 2 layers, so the volume is 12 × 2 = 24 cubic units. You could slice the same prism into upright layers instead. The count comes out the same.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Volume as a count of cubes",
        paragraphs: [
          "Volume is the number of unit cubes that fill a solid with no gaps and no overlaps. Suppose each layer holds $a$ cubes and there are $h$ layers. Then the volume is $a \\times h$ cubic units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A prism is built from unit cubes. It is 5 cubes long, 2 cubes wide and 3 cubes high. What is its volume?",
      steps: [
        "Find one layer first. The bottom layer is 5 cubes long and 2 cubes wide: 5 × 2 = 10 cubes.",
        "The prism is 3 cubes high, so it has 3 layers just like that one: 3 × 10 = 30 cubes.",
        "Each cube is 1 cubic unit, so the volume is 30 cubic units.",
      ],
      answer: "30",
      answerUnit: "cubic units",
    },
    pitfalls: [
      "Count hidden cubes too. A picture shows only the outside of the prism.",
      "Count each cube once. A corner cube shows three faces, but it is still one cube.",
    ],
    parentGuide:
      "Build a small box shape from blocks or sugar cubes. Before counting, ask how many are in the bottom layer. Then ask how many layers there are. Check by taking it apart.",
  },
  {
    id: "rectangular-prism-volume",
    title: "Volume of a rectangular prism",
    summary:
      "A rectangular prism is a box shape with 6 rectangle faces. A unit cube is a cube with edges 1 unit long. Its volume is how much space it takes up, counted in unit cubes. One flat layer of cubes covers the bottom. The volume is the cubes in one layer times the number of layers.",
    templateIds: [
      "prism-volume-edges",
      "prism-missing-edge",
      "composite-prism-volume",
    ],
    senses: {
      cube: "cube",
      face: "face-solid",
      edge: "edge",
      base: "base-shape",
      solid: "solid-shape",
      product: "product-multiply",
      unit: "unit",
      square: "square-shape",
      side: "side",
    },
    noLink: ["part", "parts", "whole"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use $V = l \\times w \\times h$, and $V = B \\times h$ with $B$ the base area, to find a volume.",
      "Find a missing edge from a volume, and add the volumes of joined prisms.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count one layer, then all layers",
        paragraphs: [
          "Picture a box filled with centimeter cubes, cubes 1 centimeter long on each edge. The bottom layer has 4 rows of 3 cubes, so it holds 4 × 3 = 12 cubes. The box is 5 layers high, so it holds 5 copies of that layer. That is 12 × 5 = 60 cubes. Multiplying counts them all without listing every cube.",
          "The base is the face the box stands on. A unit square is a square with sides 1 unit long. Area is how much flat space a shape covers, counted in unit squares. The area of the base is called the base area. Here it is 4 × 3 = 12 square centimeters, the same number as the cubes in one layer.",
          "The height is how tall the box is, from the base to the top. Each centimeter of height adds one more layer of cubes.",
        ],
      },
      {
        title: "From cubes to a formula",
        paragraphs: [
          "Let $l$ stand for the length, $w$ for the width and $h$ for the height, all in centimeters. One layer of centimeter cubes on the base holds $l \\times w$ cubes. That number is also the base area, which we call $B$, in square centimeters.",
          "A height of $h$ centimeters stacks $h$ layers. So the volume $V$ is $V = l \\times w \\times h = B \\times h$ cubic centimeters.",
          "Any face can be the base. Multiply the three edges in any order. The product, the answer you get by multiplying, is always the same.",
        ],
      },
      {
        title: "Work backward, and add parts",
        paragraphs: [
          "Suppose you know the volume and two edges. Multiply the two known edges. Then divide the volume by that product to find the missing edge. For a volume of 30 with edges 5 and 2, 5 × 2 = 10 and 30 ÷ 10 = 3. The missing edge is 3.",
          "Volumes add. Look at the picture: a stepped solid pulls apart into two prisms that do not overlap. Their volumes are 30 and 16 cubic centimeters. So the solid's volume is 30 + 16 = 46 cubic centimeters. Split the solid, find each volume, then add.",
        ],
        illustration: "prism-composite",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Volume of a rectangular prism",
        paragraphs: [
          "A rectangular prism with edge lengths $l$, $w$ and $h$, all in one length unit, has a base of area $l \\times w$ square units. Its volume is $l \\times w \\times h$ cubic units. Multiplying counts the unit cubes along the length, across the width and up through the layers.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A box is 6 cm long, 4 cm wide and 3 cm high. What is its volume?",
      steps: [
        "Find the base area: $6 \\times 4 = 24$ square centimeters. So one layer of centimeter cubes on the base holds 24 cubes.",
        "The height is 3 cm, so 3 layers stack up: $24 \\times 3 = 72$ cubes.",
        "Each cube is 1 cubic centimeter, so the volume is 72 cubic centimeters.",
      ],
      answer: "72",
      answerUnit: "cubic centimeters",
    },
    pitfalls: [
      "Multiply all three edges. Adding them gives a length, and multiplying only two gives an area, not a volume.",
      "For a joined solid, find each prism's volume and add. Do not multiply the outside edges of the whole solid.",
    ],
    parentGuide:
      "Find a cereal box and estimate its length, width and height in centimeters. Ask how many centimeter cubes would cover the bottom. Then ask how many layers would fill it.",
  },
  {
    id: "first-quadrant-coordinates",
    title: "Points on a coordinate grid",
    summary:
      "A coordinate grid is a flat grid with two number lines that cross at 0. An ordered pair is two numbers, such as (2, 5), that name one point on the grid. The first number tells how far to go across. The second tells how far to go up.",
    templateIds: [
      "first-quadrant-locate",
      "first-quadrant-coordinates",
      "coordinate-move",
    ],
    senses: { unit: "unit", square: "square-shape" },
    noLink: ["change", "changes", "part"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Plot and read points from ordered pairs in the first quadrant, the upper-right part of a coordinate grid.",
      "Find the new coordinates after a move right and up.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use two moves to locate a point",
        paragraphs: [
          "Start at the corner where the two number lines cross. Both lines read 0 there. Each number in an ordered pair is called a coordinate.",
          "Write a point as (across, up). The first coordinate says how many units to go right. The second coordinate says how many units to go up from there. Those two moves land on exactly one point.",
        ],
      },
      {
        title: "Across first, then up",
        paragraphs: [
          "The two number lines meet at 0 at a right angle, a square corner. The number line going across is called the $x$-axis. The one going up is called the $y$-axis. The point where they meet, 0 on both, is called the origin.",
          "In the pair $(x, y)$, $x$ is the first coordinate and $y$ is the second. Look at the picture. To reach (2, 5), go 2 across from 0, then 5 up. Going 5 across and 2 up reaches a different point, (5, 2).",
        ],
        illustration: "ordered-pair-path",
      },
      {
        title: "Moving on the grid",
        paragraphs: [
          "Moving right adds to the first coordinate. Moving up adds to the second. A move right never changes the second coordinate. A move up never changes the first.",
          "Count the grid lines from 0, not the squares between them. A point on the $x$-axis has second coordinate 0. A point on the $y$-axis has first coordinate 0.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Ordered pairs locate points",
        paragraphs: [
          "The first quadrant is the part of the grid where both coordinates are 0 or more. It is the upper-right part. There, an ordered pair $(x, y)$ means $x$ units across from the $y$-axis and $y$ units up from the $x$-axis. Swapping the two numbers names a different point, unless they are equal.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Start at (2, 3). Move 4 units right and 1 unit up. Where do you stop?",
      steps: [
        "Moving right changes only how far across you are, the first coordinate: 2 + 4 = 6.",
        "Moving up changes only how far up you are, the second coordinate: 3 + 1 = 4.",
        "You stop at (6, 4).",
      ],
      answer: "(6, 4)",
    },
    pitfalls: [
      "Write the across number first. (3, 1) is not (1, 3).",
      "Start counting at the origin, which is 0, not at 1.",
    ],
    parentGuide:
      "Play a hiding game on graph paper. Name a pair such as (4, 2), and have your child move a finger 4 across, then 2 up. Then swap the numbers and compare the two spots.",
  },
];

const terms = {
  cube: [
    "unit-cube",
    [
      "volume",
      "A layer is one flat level of cubes covering the bottom. Volume is cubes per layer times layers.",
    ],
  ],
  prism: ["base-area", "volume"],
  grid: ["ordered-pair", "origin"],
} satisfies Record<string, MethodTerm[]>;
const cubeSenses = {
  cube: "cube",
  face: "face-solid",
  edge: "edge",
  solid: "solid-shape",
  square: "square-shape",
  unit: "unit",
  product: "product-multiply",
};
const prismSenses = {
  cube: "cube",
  square: "square-shape",
  face: "face-solid",
  edge: "edge",
  base: "base-shape",
  solid: "solid-shape",
  unit: "unit",
  product: "product-multiply",
};
export const volumeCoordinateMethods: Record<string, ProblemMethod> = {
  "unit-cube-volume": {
    goal: "Find the volume of a prism built from unit cubes, in cubic units.",
    intuition:
      "Volume is how much space a solid takes up. A unit cube is a cube with edges 1 unit long. It counts as 1 cubic unit. Volume is the number of unit cubes that fill a solid. A rectangular prism is a box shape. Its cubes sit in equal flat layers, so count one layer and multiply.",
    senses: cubeSenses,
    noLink: ["side"],
    terms: terms.cube,
    method: [
      "Count the cubes along the length and the width of the top. Multiply them to get one layer.",
      "Count the layers up the side.",
      "Multiply the cubes in one layer by the number of layers.",
    ],
    watch: "Hidden cubes count too. Use layers, not the squares you can see.",
  },
  "cube-layer-count": {
    goal: "Find how many unit cubes make one layer of a prism built from cubes.",
    intuition:
      "A unit cube is a cube with edges 1 unit long. A rectangular prism is a box shape. One built from unit cubes is a stack of equal flat layers. A layer is one flat level of cubes. Every layer matches the top face, so the top shows how one layer is arranged.",
    senses: cubeSenses,
    terms: terms.cube,
    method: [
      "Count the cubes along one edge of the top face.",
      "Count the cubes along the other edge.",
      "Multiply the two counts. Every layer has that many cubes, including the bottom one.",
    ],
    watch:
      "Multiply the two edge counts. Counting only the cubes you can see misses the hidden ones.",
  },
  "prism-volume-edges": {
    goal: "Find the volume of a rectangular prism from its length, width and height.",
    intuition:
      "Volume is how much space a solid takes up. A unit cube is a cube with edges 1 unit long. Volume is counted in unit cubes. A rectangular prism is a box shape. Its base is the face it stands on. Area is how much flat space a shape covers. The base area is the number of square centimeters the base covers: length times width. The height is how tall the prism is.",
    senses: prismSenses,
    terms: terms.prism,
    method: [
      "Multiply length by width to get the base area. That is the number of centimeter cubes in one layer.",
      "Multiply the base area by the height, which is the number of layers.",
      "Write the unit as cubic centimeters.",
    ],
    watch: "Multiply all three edges. Do not add them.",
  },
  "prism-missing-edge": {
    goal: "Find the third edge of a rectangular prism from its volume and the other two edges.",
    intuition:
      "Volume is how much space a solid takes up, counted in cubes. A rectangular prism is a box shape. Its height is how tall it is. Its volume is length times width times height. So the three edges multiply to make the volume. When one edge is missing, divide to undo multiplying.",
    senses: prismSenses,
    noLink: ["third"],
    terms: terms.prism,
    method: [
      "Multiply the two known edges.",
      "Divide the volume by that product, the answer from the first step.",
      "Check that the three edges multiply to make the volume.",
    ],
    watch:
      "Divide the volume by the product of both known edges, not by just one edge.",
  },
  "composite-prism-volume": {
    goal: "Find the total volume of a solid made of two rectangular prisms.",
    intuition:
      "Volume is how much space a solid takes up, counted in cubes. A rectangular prism is a box shape. Its height is how tall it is. Its volume is length times width times height. A solid made of two prisms that do not overlap holds both prisms' space. So its volume is the two volumes added together.",
    senses: prismSenses,
    noLink: ["part", "parts", "whole"],
    terms: terms.prism,
    method: [
      "Find the length, width and height of each prism.",
      "Find each prism's volume by multiplying its three edges.",
      "Add the two volumes.",
    ],
    watch:
      "Both prisms share the same depth. Use each prism's own length and height.",
  },
  "first-quadrant-locate": {
    goal: "Choose the point plotted at a given ordered pair.",
    intuition:
      "A coordinate grid is a flat grid with two number lines that cross at 0. That crossing point is called the origin. An ordered pair is two numbers, such as (5, 2), that name one point. The first number says how far to go across from the origin. The second says how far to go up.",
    senses: { unit: "unit" },
    terms: terms.grid,
    method: [
      "Start at the origin. Go across by the first number.",
      "Then go up by the second number.",
      "Name the point you land on.",
    ],
    watch: "(3, 1) and (1, 3) are different points. Across comes first.",
  },
  "first-quadrant-coordinates": {
    goal: "Choose the ordered pair for a plotted point.",
    intuition:
      "A coordinate grid is a flat grid with two number lines that cross at 0. The line going across is called the $x$-axis. The line going up is called the $y$-axis. An ordered pair is two numbers that name a point: across first, then up. Each number in it is called a coordinate.",
    senses: { unit: "unit" },
    terms: terms.grid,
    method: [
      "Go straight down from the point to the $x$-axis. That number comes first.",
      "Go straight left from the point to the $y$-axis. That number comes second.",
      "Write the pair as (first, second).",
    ],
    watch:
      "Write the across number first. (3, 5) and (5, 3) are different points.",
  },
  "coordinate-move": {
    goal: "Find where you stop after moving right and up from a starting point.",
    intuition:
      "An ordered pair is two numbers, such as (3, 1), that name a point on a grid. Each number in it is called a coordinate. The first coordinate says how far across the point is. The second says how far up it is. Moving right adds to the first coordinate. Moving up adds to the second.",
    senses: { unit: "unit" },
    noLink: ["change", "changes"],
    terms: terms.grid,
    method: [
      "Read the starting point's coordinates.",
      "Add the move right to the first coordinate.",
      "Add the move up to the second coordinate.",
    ],
    watch:
      "A move right changes only the first number. A move up changes only the second.",
  },
};
export const volumeCoordinatePrinciples: Record<string, string> = {
  "unit-cube-volume":
    "Volume counts the unit cubes that fill a solid. A rectangular prism is equal layers stacked up, so its volume is the cubes in one layer times the number of layers.",
  "cube-layer-count":
    "Every layer of a rectangular prism matches its top face. So one layer holds the number of rows times the cubes in each row.",
  "prism-volume-edges":
    "The volume of a rectangular prism is length × width × height. That is the base area times the height.",
  "prism-missing-edge":
    "Volume is the product of the three edges. So a missing edge is the volume divided by the product of the other two.",
  "composite-prism-volume":
    "Volumes add. Pieces that do not overlap have a total volume equal to the sum of their volumes.",
  "first-quadrant-locate":
    "An ordered pair $(x, y)$ means go $x$ across from the origin, then $y$ up.",
  "first-quadrant-coordinates":
    "A point's first coordinate is how far across it is from the $y$-axis. Its second coordinate is how far up it is from the $x$-axis.",
  "coordinate-move":
    "Moving right changes only the first coordinate. Moving up changes only the second.",
};
