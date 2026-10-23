import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

export const volumeCoordinateLessons: Lesson[] = [
  {
    id: "volume-unit-cubes",
    title: "Volume: count cubes by layers",
    summary:
      "A rectangular prism is a box. Count the unit cubes that fill it without gaps: cubes one unit long on each edge measure its volume in cubic units.",
    templateIds: ["unit-cube-volume", "cube-layer-count"],
    includeGeneratedRepresentation: false,
    objectives: [
      "Explain volume as a count of unit cubes with no gaps or overlaps.",
      "Find the volume of a cube-built prism by counting one layer and multiplying by the layers.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Fill the space with cubes",
        paragraphs: [
          "A solid box takes up space. A rectangular prism is a box with six rectangular faces. Imagine filling it with unit cubes, each one unit long, wide and high. Counting the cubes tells how much space the prism holds, which is its volume.",
        ],
      },
      {
        title: "What volume measures",
        paragraphs: [
          "A unit cube has edges 1 unit long; its volume is 1 cubic unit. The volume of a solid is how many unit cubes fill it, with no gaps and no overlaps.",
          "A drawing of a prism shows only three faces. Cubes in the middle and at the back are hidden, so counting the squares you can see gives the wrong number. Count by the prism's structure instead.",
        ],
        illustration: "volume-layers",
      },
      {
        title: "Count by layers",
        paragraphs: [
          "A rectangular prism is a stack of identical flat layers. The top face shows one layer: its rows times the cubes in each row.",
          "Multiply the cubes in one layer by the number of layers. The prism above has 4 × 3 = 12 cubes in a layer and 2 layers, so its volume is 24 cubic units. Stacking the layers sideways or upright gives the same count.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Unit-cube volume",
        paragraphs: [
          "Volume counts how many nonoverlapping unit cubes fill a solid without gaps. If equal layers each contain $a$ cubes and there are $h$ layers, the volume is $a\\times h$ cubic units.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A prism is built from unit cubes. It is 5 cubes long, 2 cubes wide and 3 cubes high. What is its volume?",
      steps: [
        "One layer is 5 cubes long and 2 cubes wide: 5 × 2 = 10 cubes.",
        "There are 3 identical layers: 3 × 10 = 30 cubes.",
        "Each cube is 1 cubic unit, so the volume is 30 cubic units.",
      ],
      answer: "30",
      answerUnit: "cubic units",
    },
    pitfalls: [
      "Count hidden cubes too: a picture shows only the outside.",
      "Count each cube once, even though a corner cube shows three faces.",
    ],
    parentGuide:
      "Build a small box from blocks or sugar cubes. Ask how many are in the bottom layer before counting, then how many layers there are, then check by taking it apart.",
  },
  {
    id: "rectangular-prism-volume",
    title: "Volume of a rectangular prism",
    summary:
      "A rectangular prism is a box. Its volume in cubic units is the count of unit cubes in one layer times the number of layers.",
    templateIds: [
      "prism-volume-edges",
      "prism-missing-edge",
      "composite-prism-volume",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Use V = l × w × h, and V = B × h with $B$ the base area, to find a volume.",
      "Find a missing edge from a volume, and add the volumes of joined prisms.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Count one layer, then all layers",
        paragraphs: [
          "If one flat layer has four rows of three cubes, it holds twelve cubes. If the box is five layers high, it holds five copies of that layer. Multiplication counts them without listing every cube.",
        ],
      },
      {
        title: "From cubes to a formula",
        paragraphs: [
          "Along a base $l$ cm long and $w$ cm wide, one layer of centimeter cubes holds l × w cubes. That number is also the base area $B$ in square centimeters.",
          "A height of $h$ cm stacks $h$ layers, so $V = l \\times w \\times h = B \\times h$ cubic centimeters. Any face can be the base: the product of the three edges is the same in any order.",
        ],
      },
      {
        title: "Work backward, and add parts",
        paragraphs: [
          "If the volume and two edges are known, the missing edge is the number that completes the product: divide the volume by the product of the two known edges.",
          "Volume adds. A solid made of two prisms that do not overlap has a volume equal to the sum of their volumes: split it, find each volume, then add.",
        ],
        illustration: "prism-composite",
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Volume of a rectangular prism",
        paragraphs: [
          "A right rectangular prism with edge lengths $l,w,h$ in one length unit has a base of area $lw$ square units and volume $lwh$ cubic units. The product counts unit cubes across, along, and through the layers.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "A box is 6 cm long, 4 cm wide and 3 cm high. What is its volume?",
      steps: [
        "Base area: $6 \\times 4 = 24$ square centimeters, so one layer holds 24 centimeter cubes.",
        "The height is 3 cm, so there are 3 layers: $24 \\times 3 = 72$.",
        "The volume is 72 cubic centimeters.",
      ],
      answer: "72",
      answerUnit: "cubic centimeters",
    },
    pitfalls: [
      "Multiply all three edges; adding them or multiplying only two gives a length or an area, not a volume.",
      "For a joined solid, do not count the shared face twice or multiply the overall outside edges; find each prism's volume and add.",
    ],
    parentGuide:
      "Find a cereal box and estimate its length, width and height in centimeters. Ask how many centimeter cubes would cover the bottom, and how many layers would fill it.",
  },
  {
    id: "first-quadrant-coordinates",
    title: "Points on a coordinate grid",
    summary:
      "An ordered pair tells how far across and how far up a point lies from zero.",
    templateIds: [
      "first-quadrant-locate",
      "first-quadrant-coordinates",
      "coordinate-move",
    ],
    includeGeneratedRepresentation: false,
    objectives: [
      "Plot and read points from ordered pairs in the first quadrant.",
      "Find the new coordinates after a move right and up.",
    ],
    sections: [
      {
        stage: "intuition",
        title: "Use two moves to locate a point",
        paragraphs: [
          "Start where two number lines cross at zero. Write a point as (across, up): the first number is its horizontal coordinate and the second its vertical coordinate. Together they locate one point in the upper-right part of the grid.",
        ],
      },
      {
        title: "Across first, then up",
        paragraphs: [
          "Two number lines meet at 0 at a right angle. The horizontal one is the $x$-axis; the vertical one is the $y$-axis. Their meeting point, 0 on both, is the origin.",
          "In the pair $(x, y)$, the first number says how far across from the origin, and the second says how far up. Order matters: (2, 5) and (5, 2) are different points.",
        ],
        illustration: "ordered-pair-path",
      },
      {
        title: "Moving on the grid",
        paragraphs: [
          "Moving right adds to the first coordinate; moving up adds to the second. A move right never changes the second coordinate, and a move up never changes the first.",
          "Count gridlines, not squares, starting from 0. A point on the $x$-axis has second coordinate 0; a point on the $y$-axis has first coordinate 0.",
        ],
      },
    ],
    closingSections: [
      {
        stage: "formal",
        title: "Ordered pairs locate points",
        paragraphs: [
          "In the first quadrant, an ordered pair $(x,y)$ gives a nonnegative horizontal distance $x$ from the vertical axis and a nonnegative vertical distance $y$ from the horizontal axis. Reversing the coordinates generally names a different point.",
        ],
      },
    ],
    workedExample: {
      prompt:
        "Start at (2, 3). Move 4 units right and 1 unit up. Where do you stop?",
      steps: [
        "Right changes only the first coordinate: 2 + 4 = 6.",
        "Up changes only the second coordinate: 3 + 1 = 4.",
        "You stop at (6, 4).",
      ],
      answer: "(6, 4)",
    },
    pitfalls: [
      "Write the across distance first. (3, 1) is not (1, 3).",
      "Start counting at the origin, 0, not at 1.",
    ],
    parentGuide:
      "Play a hiding game on graph paper: name a pair such as (4, 2) and have your child walk a finger across 4, then up 2. Then swap the numbers and compare the two spots.",
  },
];

const terms = {
  cube: [
    ["unit cube", "A cube with edges 1 unit long; its volume is 1 cubic unit."],
    ["layer", "One flat level of cubes covering the prism's base."],
  ],
  prism: [
    ["base area", "Length times width: the cubes in one layer."],
    ["volume", "The number of unit cubes that fill a solid."],
  ],
  grid: [
    ["ordered pair", "$(x, y)$: $x$ across from 0, then $y$ up."],
    ["origin", "The point (0, 0), where the axes meet."],
  ],
} satisfies Record<string, [string, string][]>;
export const volumeCoordinateMethods: Record<string, ProblemMethod> = {
  "unit-cube-volume": {
    goal: "Given a prism of unit cubes, find its volume in cubic units.",
    terms: terms.cube,
    method: [
      "Count the cubes along the length and the width of the top: their product is one layer.",
      "Count the layers up the side.",
      "Multiply the cubes in a layer by the number of layers.",
    ],
    watch: "Hidden cubes count. Use layers, not the visible squares.",
  },
  "cube-layer-count": {
    goal: "Given a prism of unit cubes, find how many cubes make one layer.",
    terms: terms.cube,
    method: [
      "Count the cubes along one edge of the top face.",
      "Count the cubes along the other edge.",
      "Multiply: every layer matches the top.",
    ],
    watch:
      "Multiply the two edge counts; counting only the cubes you can see misses the hidden ones.",
  },
  "prism-volume-edges": {
    goal: "Given the three edge lengths of a rectangular prism, find its volume.",
    terms: terms.prism,
    method: [
      "Multiply length by width to get the base area.",
      "Multiply the base area by the height.",
      "Write the unit as cubic centimeters.",
    ],
    watch: "Multiply all three edges; do not add them.",
  },
  "prism-missing-edge": {
    goal: "Given a prism's volume and two edges, find the third edge.",
    terms: terms.prism,
    method: [
      "Multiply the two known edges.",
      "Divide the volume by that product.",
      "Check that the three edges multiply to the volume.",
    ],
    watch:
      "Divide the volume by the product of both known edges, not by one edge.",
  },
  "composite-prism-volume": {
    goal: "Given a solid made of two rectangular prisms, find its total volume.",
    terms: terms.prism,
    method: [
      "Find the length, width and height of each prism.",
      "Find each prism's volume.",
      "Add the two volumes.",
    ],
    watch:
      "Both prisms share the depth; use each prism's own length and height.",
  },
  "first-quadrant-locate": {
    goal: "Given an ordered pair, choose the point plotted there.",
    terms: terms.grid,
    method: [
      "From the origin, go across by the first number.",
      "Then go up by the second number.",
      "Name the point you land on.",
    ],
    watch: "(3, 1) and (1, 3) are different points: across comes first.",
  },
  "first-quadrant-coordinates": {
    goal: "Given a plotted point, choose its ordered pair.",
    terms: terms.grid,
    method: [
      "Go straight down from the point to the $x$-axis: that number comes first.",
      "Go straight left to the $y$-axis: that number comes second.",
      "Write (first, second).",
    ],
    watch:
      "Write the across number first; (3, 5) and (5, 3) are different points.",
  },
  "coordinate-move": {
    goal: "Given a starting point and a move right and up, find where you stop.",
    terms: terms.grid,
    method: [
      "Read the starting point's coordinates.",
      "Add the move right to the first coordinate.",
      "Add the move up to the second coordinate.",
    ],
    watch:
      "A move right changes only the first number; a move up changes only the second.",
  },
};
export const volumeCoordinatePrinciples: Record<string, string> = {
  "unit-cube-volume":
    "Volume counts the unit cubes that fill a solid, and a prism is identical layers stacked up.",
  "cube-layer-count":
    "Every layer of a rectangular prism matches its top face: rows times cubes per row.",
  "prism-volume-edges":
    "The volume of a rectangular prism is length × width × height, the base area times the height.",
  "prism-missing-edge":
    "Volume is the product of three edges, so a missing edge is the volume divided by the other two.",
  "composite-prism-volume":
    "Volume is additive: non-overlapping parts add to the whole.",
  "first-quadrant-locate":
    "An ordered pair $(x, y)$ means $x$ across from the origin, then $y$ up.",
  "first-quadrant-coordinates":
    "A point's first coordinate is its distance across from the $y$-axis; its second is its distance up from the $x$-axis.",
  "coordinate-move":
    "Moving right changes only the first coordinate; moving up changes only the second.",
};
