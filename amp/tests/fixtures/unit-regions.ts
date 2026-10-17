import type { Diagram } from "../../src/publishing/schema.js";
export const rectangleCells = (width: number, height: number) =>
  Array.from({ length: width * height }, (_, i) => ({
    column: i % width,
    row: Math.floor(i / width),
  }));
const model = (
  id: string,
  cells: ReturnType<typeof rectangleCells>,
  caption: string,
  extra: Partial<Extract<Diagram, { kind: "unit-region" }>> = {},
): Extract<Diagram, { kind: "unit-region" }> => ({
  kind: "unit-region",
  id,
  unit: "cm",
  cells,
  showGrid: true,
  caption,
  alt: caption,
  ...extra,
});
export const unitRegionModels: Extract<Diagram, { kind: "unit-region" }>[] = [
  model(
    "one-square",
    rectangleCells(1, 1),
    "One square has four boundary edges, each one unit long.",
    {
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: 1, row: 0 },
          side: "above",
        },
        {
          from: { column: 0, row: 0 },
          to: { column: 0, row: 1 },
          side: "left",
        },
      ],
    },
  ),
  model(
    "maximum-rectangle",
    rectangleCells(12, 8),
    "The unit squares have identical horizontal and vertical side lengths.",
    {
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: 12, row: 0 },
          side: "above",
        },
        {
          from: { column: 0, row: 0 },
          to: { column: 0, row: 8 },
          side: "left",
        },
      ],
    },
  ),
  model(
    "l-region",
    rectangleCells(6, 5).filter((p) => p.column < 4 || p.row >= 3),
    "The solid boundary turns into the notch. The dashed line divides two rectangles.",
    {
      partitions: [{ from: { column: 4, row: 3 }, to: { column: 4, row: 5 } }],
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: 4, row: 0 },
          side: "above",
        },
        {
          from: { column: 4, row: 0 },
          to: { column: 4, row: 3 },
          side: "right",
        },
        {
          from: { column: 4, row: 3 },
          to: { column: 6, row: 3 },
          side: "above",
        },
        {
          from: { column: 6, row: 3 },
          to: { column: 6, row: 5 },
          side: "right",
        },
        {
          from: { column: 0, row: 5 },
          to: { column: 6, row: 5 },
          side: "below",
        },
        {
          from: { column: 0, row: 0 },
          to: { column: 0, row: 5 },
          side: "left",
        },
      ],
    },
  ),
  model(
    "l-other-partition",
    rectangleCells(6, 5).filter((p) => p.column < 4 || p.row >= 3),
    "A different partition covers the same region without overlaps.",
    {
      partitions: [{ from: { column: 0, row: 3 }, to: { column: 4, row: 3 } }],
    },
  ),
  model(
    "narrow-open-notch",
    rectangleCells(12, 8).filter((p) => p.column !== 5 || p.row === 7),
    "The narrow opening is outside the region. Its two edges belong to the boundary.",
    {
      edgeLabels: [
        {
          from: { column: 5, row: 0 },
          to: { column: 5, row: 7 },
          side: "right",
        },
      ],
    },
  ),
  model(
    "outline-only",
    rectangleCells(7, 3),
    "The shaded region covers the same area when the interior grid is hidden.",
    {
      showGrid: false,
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: 7, row: 0 },
          side: "above",
        },
        {
          from: { column: 7, row: 0 },
          to: { column: 7, row: 3 },
          side: "right",
        },
      ],
    },
  ),
];
