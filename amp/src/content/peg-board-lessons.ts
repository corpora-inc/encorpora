import { chainLesson } from "./chain-lesson-kit";
import type { ProblemMethod } from "./problem-lessons";
import { pegBoardScene } from "../math/peg-board-scene";

export const pegBoardMethod: ProblemMethod = {
  goal: "Join sticks to make a shape with no gaps.",
  intuition:
    "A side is a straight part of a shape. A corner is where two sides meet and turn. A closed shape has no gaps. A triangle is a closed shape with 3 straight sides. A hexagon is a closed shape with 6 straight sides. A square corner fits the corner of a page. A rectangle is a closed shape with 4 sides and 4 square corners. A square is a rectangle with all 4 sides equally long. Join the sides without crossings.",
  terms: ["side", "triangle", "square-shape", "rectangle", "hexagon"],
  method: [
    "Tap one peg, then another to place a side. For drawing, you can also drag between pegs.",
    "Join more sides. Make a turn at each corner. Join the last corner to the first to close the shape.",
    "Count the sides and corners. A triangle has 3 sides. A hexagon has 6 sides.",
    "A square corner fits the corner of a page. A rectangle is a closed shape with 4 straight sides and 4 square corners.",
    "Length means how long a side is. A square is a rectangle with all 4 sides the same length and all 4 corners square.",
    "To copy a slanting side, count across and down between its ends. For example, go 2 spaces right and 1 down. Join those pegs with one straight side.",
    "Keep the copied shape the same size. Turn the whole shape only when the question allows it.",
  ],
  watch:
    "A ball in the middle of a straight side is not a corner. A corner needs a turn.",
};
export const pegBoardPrinciple =
  "A closed shape has no gaps. Straight sides meet at corners without crossing. Moving or turning a shape keeps its side lengths and corners.";
export const pegBoardLesson = chainLesson({
  id: "peg-board-lesson",
  title: "Build shapes from sides and corners",
  summary: pegBoardMethod.intuition!,
  templateIds: [
    "build-shape-sticks-balls",
    "build-shape-by-count",
    "copy-peg-shape",
  ],
  objectives: [
    "Join sticks into a closed shape.",
    "Count its sides and corners.",
    "Copy the size and corners of a shown shape.",
  ],
  senses: { square: "square-shape", sides: "side", side: "side" },
  openingTitle: "Join the sides",
  opening: [
    "You need to count up to 6. A side is a straight part of a shape. A stick makes one side.",
    "A corner is where two sides meet and turn. A clay ball joins two sticks there.",
    "On the board, pegs stand for clay balls. A straight mark between two pegs stands for a stick.",
    "Follow the sides all the way around. A closed shape comes back to the start, with no gaps.",
    "A square corner fits the corner of a page. A rectangle is a closed shape with 4 straight sides and 4 square corners.",
    "Length means how long a side is. A square is a rectangle with all 4 sides the same length and all 4 corners square.",
  ],
  example: {
    prompt: "Build a rectangle with sticks and clay balls.",
    steps: [
      "Join two pegs 3 spaces apart across the board. This makes the first side.",
      "From its end, go down 2 spaces. This makes a square corner, like the corner of a page.",
      "Go back across 3 spaces, then up 2 spaces to the first peg. The shape closes.",
      "Count 4 sides and 4 square corners. That makes a rectangle.",
    ],
    answer: "A rectangle with 4 sides and 4 square corners.",
    figure: {
      kind: "scene",
      scene: pegBoardScene(
        {
          kind: "peg-board",
          label: "Build a rectangle",
          grid: { cols: 5, rows: 5 },
          skin: "build",
          maxSticks: 8,
          given: [],
          check: { sides: 4, name: "rectangle", rightCorners: true },
          guessChance: 0.001,
        },
        '{"sticks":[[0,3],[3,13],[13,10],[10,0]]}',
      ),
    },
  },
  methodTitle: "Place, join and check",
  method: pegBoardMethod.method,
  formalTitle: "What makes each shape",
  formal: [
    pegBoardPrinciple,
    "A triangle has 3 straight sides. A hexagon has 6. Each has as many corners as sides.",
    "A rectangle has 4 straight sides and 4 square corners. A square is a rectangle with all 4 sides the same length.",
  ],
  pitfalls: [
    "Leaving a gap at the start.",
    "Crossing the sticks.",
    "Counting a ball along a straight side as a corner.",
  ],
  parentGuide:
    "Try this with toothpicks and dough at home. Build the shape of a window, then count its sides and corners.",
});
