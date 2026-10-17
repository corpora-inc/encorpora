import type { Diagram } from "../../src/publishing/schema.js";
export const ratioModels: Diagram[] = [
  {
    kind: "ratio-tape",
    id: "two-to-three",
    unitLabel: "liters",
    frameParts: 6,
    partValue: [3, 4],
    rows: [
      {
        label: "Concentrate",
        parts: 2,
        total: [3, 2],
      },
      {
        label: "Water",
        parts: 3,
        total: [9, 4],
      },
    ],
    caption:
      "Two equal parts of concentrate join three equal parts of water. Both quantities use liters.",
    alt: "Concentrate has two parts totaling three halves liters; water has three parts totaling nine quarters liters.",
  },
  {
    kind: "ratio-tape",
    id: "scaled-two-to-three",
    unitLabel: "liters",
    frameParts: 6,
    partValue: [3, 4],
    rows: [
      {
        label: "Concentrate",
        parts: 4,
        total: [3, 1],
      },
      {
        label: "Water",
        parts: 6,
        total: [9, 2],
      },
    ],
    caption:
      "Doubling both quantities doubles each row while preserving the amount represented by one part.",
    alt: "Concentrate has four parts totaling three liters; water has six parts totaling nine halves liters.",
  },
  {
    kind: "ratio-tape",
    id: "three-quantities",
    unitLabel: "beads",
    frameParts: 12,
    rows: [
      {
        label: "Orange beads",
        parts: 12,
        total: [36, 1],
      },
      {
        label: "Teal beads",
        parts: 7,
        total: [21, 1],
      },
      {
        label: "Violet beads",
        parts: 1,
      },
    ],
    caption:
      "Every part represents the same number of beads. The violet amount is not given.",
    alt: "Orange has twelve parts totaling 36 beads; teal seven parts totaling 21 beads; violet one part has unknown total.",
  },
  {
    kind: "ratio-tape",
    id: "unknown-batch",
    unitLabel: "milliliters",
    frameParts: 3,
    rows: [
      {
        label: "Concentrate",
        parts: 2,
      },
      {
        label: "Water",
        parts: 3,
      },
    ],
    caption:
      "The ratio fixes the relationship. Without an amount, many different batch sizes are possible.",
    alt: "Two equal parts of concentrate and three equal parts of water; no amounts are given.",
  },
  {
    kind: "percent-grid",
    id: "percent-0",
    wholeLabel: "The entire collection",
    shadedCells: [],
    caption:
      "All one hundred squares together represent the same named whole. A slash marks a selected square.",
    alt: "Exactly 0 of 100 equal squares are selected.",
  },
  {
    kind: "percent-grid",
    id: "percent-1",
    wholeLabel: "The entire collection",
    shadedCells: [0],
    caption:
      "All one hundred squares together represent the same named whole. A slash marks a selected square.",
    alt: "Exactly 1 of 100 equal squares are selected.",
  },
  {
    kind: "percent-grid",
    id: "percent-99",
    wholeLabel: "The entire collection",
    shadedCells: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
      39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
      57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
      75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95, 96, 97, 98,
    ],
    caption:
      "All one hundred squares together represent the same named whole. A slash marks a selected square.",
    alt: "Exactly 99 of 100 equal squares are selected.",
  },
  {
    kind: "percent-grid",
    id: "percent-100",
    wholeLabel: "The entire collection",
    shadedCells: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38,
      39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
      57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
      75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95, 96, 97, 98, 99,
    ],
    caption:
      "All one hundred squares together represent the same named whole. A slash marks a selected square.",
    alt: "Exactly 100 of 100 equal squares are selected.",
  },
  {
    kind: "percent-grid",
    id: "scattered-selection",
    wholeLabel: "One complete display board",
    shadedCells: [0, 9, 22, 44, 65, 90, 99],
    caption:
      "Selection can be scattered. Each marked square is still one hundredth of the same whole.",
    alt: "Seven scattered squares selected from the 100 equal squares of one board.",
  },
  {
    kind: "ratio-tape",
    id: "long-labels",
    unitLabel: "milliliters of mixture",
    frameParts: 12,
    partValue: [9999, 997],
    rows: [
      {
        label: "WWWWWWWWWWWWWWWWWWWWWWWW",
        parts: 1,
        total: [9999, 997],
      },
      {
        label: "Concentrate sample",
        parts: 1,
      },
    ],
    caption:
      "Long permitted labels and exact fractional amounts wrap without covering the equal parts.",
    alt: "Two rows each contain one equal part. The first row has a displayed exact fractional amount.",
  },
];
