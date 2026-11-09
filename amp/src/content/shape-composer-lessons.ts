import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import { shapeComposerScene } from "../math/shape-composer-scene";
import { shapePieces } from "../math/shape-composer-practice";
import type { ShapeComposerResponse } from "../math/shape-composer";

const exampleResponse: ShapeComposerResponse = {
  kind: "shape-composer",
  label: "Make a square",
  lattice: { w: 5, h: 4 },
  guessChance: (4 / 81 ** 2) * (2 / 21 ** 2),
  stages: [
    {
      prompt: "Use two triangles to make a square.",
      target: [{ x: 2, y: 1, fill: "full" }],
      tray: [{ ...shapePieces.T1, copies: 2 }],
    },
    {
      prompt: "Use two copies of your square to make a rectangle.",
      target: [
        { x: 1, y: 1, fill: "full" },
        { x: 2, y: 1, fill: "full" },
      ],
      tray: [{ ...shapePieces.S, id: "joined", kind: "composite", copies: 2 }],
    },
  ],
};
const exampleAnswer = JSON.stringify([
  [
    { pieceId: "T1", copy: 0, x: 2, y: 1, rot: 0, flip: false },
    { pieceId: "T1", copy: 1, x: 2, y: 1, rot: 180, flip: false },
  ],
  [
    { pieceId: "joined", copy: 0, x: 1, y: 1, rot: 0, flip: false },
    { pieceId: "joined", copy: 1, x: 2, y: 1, rot: 0, flip: false },
  ],
]);

export const shapeComposerMethod: ProblemMethod = {
  goal: "Put flat pieces together to fill an outline, then build with the shape you made.",
  intuition:
    "An outline is the outside edge of a shape. Smaller shapes can fit together inside it. Turn a piece to make its sides match.",
  terms: ["triangle", "square-shape", "rectangle", "trapezoid"],
  method: [
    "Look for straight sides, corners and curves in the outline. Choose a piece with a matching edge.",
    "Tap the piece, then tap where it goes. Turn changes which way it points. Flip turns it over.",
    "Put the pieces side by side. A gap is an empty part. An overlap is where one piece covers another. Fill every part of the outline. Keep every piece inside it. Use the named pieces when the question names them.",
    "For a bigger shape, join the smaller pieces first. Then move each copy of that whole shape as one piece.",
  ],
  watch:
    "Match the outside edge, not just the number of pieces. Check for gaps, overlaps and pieces sticking out.",
};
export const shapeComposerPrinciple =
  "A composite shape is made from smaller shapes put together. The pieces cover the whole outline without gaps or overlaps. A composite can become one piece in another shape.";
export const shapeComposerLesson = chainLesson({
  id: "shape-composer-lesson",
  title: "Make shapes from pieces",
  summary: shapeComposerMethod.intuition!,
  templateIds: ["compose-flat-shape"],
  objectives: [
    "Fill an outline with flat shapes.",
    "Build a bigger shape from a shape made of smaller pieces.",
  ],
  senses: {
    square: "square-shape",
    squares: "square-shape",
    side: "side",
    sides: "side",
  },
  openingTitle: "Match the edges",
  opening: [
    "You need to recognize straight sides, corners and curves.",
    "Two triangles can fit together to make a square. A triangle has three straight sides. A square has four equal sides and four square corners.",
    "Turn one triangle until the longest sides touch. Nothing is left empty, and neither piece covers the other.",
    "A half-circle is half of a circle. A quarter-circle is one of four equal parts of a circle. Their curves can make a round outline.",
  ],
  example: {
    prompt:
      "Use two triangles to make a square. Then use two copies of that square to make a rectangle.",
    steps: [
      "Turn one triangle so the longest sides touch. The outside edge makes a square.",
      "Keep the triangles joined. Move the whole square as one piece.",
      "Place a second copy beside it. Full sides touch. The new outside edge is a rectangle.",
    ],
    answer:
      "Two triangles make a square. Two copies of the square make a rectangle.",
    figure: {
      kind: "scene",
      scene: shapeComposerScene(exampleResponse, exampleAnswer),
    },
  },
  methodTitle: "Place, turn and join",
  method: shapeComposerMethod.method,
  formalTitle: "One shape can be part of another",
  formal: [
    shapeComposerPrinciple,
    "Turning or flipping a piece changes its position, not its size. Only the outside edge names the whole shape.",
  ],
  pitfalls: [
    "Leaving an empty part between pieces.",
    "Covering a gap by putting one piece over another.",
    "Using every tray piece when a piece is not needed.",
  ],
  parentGuide:
    "Cut a paper square into two triangles. Join them, then use two paper squares to make a rectangle. Ask which edges touch.",
});
