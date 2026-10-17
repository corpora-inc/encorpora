import type { Diagram } from "../../src/publishing/schema.js";
const common = {
  unitLabel: "Each small unit is one.",
  alt: "Count the pictured units.",
  caption: "Build it. Tell what you notice.",
};
const cells = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    column: i % 5,
    row: Math.floor(i / 5),
  }));
export const earlyNumberModels: Diagram[] = [
  { ...common, id: "empty-frame", kind: "ten-frame", frames: 1, occupied: [] },
  {
    ...common,
    id: "five-and-two",
    kind: "ten-frame",
    frames: 1,
    occupied: [0, 1, 2, 3, 4, 5, 6],
    emphasized: [5, 6],
    emphasisLabel: "Two more",
  },
  {
    ...common,
    id: "bridge-ten",
    kind: "ten-frame",
    frames: 2,
    occupied: Array.from({ length: 13 }, (_, i) => i),
    emphasized: [8, 9, 10, 11, 12],
    emphasisLabel: "Five added",
  },
  {
    ...common,
    id: "two-full-frames",
    kind: "ten-frame",
    frames: 2,
    occupied: Array.from({ length: 20 }, (_, i) => i),
  },
  { ...common, id: "empty-base-ten", kind: "base-ten", tens: 0, ones: 0 },
  { ...common, id: "twenty-four", kind: "base-ten", tens: 2, ones: 4 },
  {
    ...common,
    id: "exchange-twenty-four",
    kind: "base-ten",
    tens: 1,
    ones: 14,
  },
  {
    ...common,
    id: "unbundle-remove",
    kind: "base-ten",
    tens: 3,
    ones: 12,
    emphasizedTens: [0],
    emphasizedOnes: [0, 1, 2, 3, 4, 5],
    emphasisLabel: "To remove",
  },
  { ...common, id: "largest-base-ten", kind: "base-ten", tens: 6, ones: 19 },
  {
    ...common,
    id: "empty-mat",
    kind: "count-collection",
    icon: "circle",
    relationship: "single",
    panels: [{ label: "The mat", cells: [] }],
  },
  {
    ...common,
    id: "same-seven",
    kind: "count-collection",
    icon: "circle",
    relationship: "conserved",
    panels: [
      { label: "A", cells: cells(7) },
      {
        label: "B",
        cells: [
          { column: 0, row: 0 },
          { column: 5, row: 0 },
          { column: 1, row: 1 },
          { column: 4, row: 1 },
          { column: 2, row: 2 },
          { column: 0, row: 3 },
          { column: 5, row: 3 },
        ],
      },
    ],
  },
  {
    ...common,
    id: "compare-collections",
    kind: "count-collection",
    icon: "square",
    relationship: "comparison",
    panels: [
      { label: "A", cells: cells(20) },
      { label: "B", cells: cells(10) },
    ],
  },
  {
    ...common,
    id: "emphasized-collection",
    kind: "count-collection",
    icon: "circle",
    relationship: "single",
    panels: [
      {
        label: "The mat",
        cells: cells(9),
        emphasized: [5, 6, 7, 8],
        emphasisLabel: "To remove",
      },
    ],
  },
];
