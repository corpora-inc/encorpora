import type { DataDisplayFigure } from "../math/data-display-models";

/** Authored, fixed charts that lessons draw with the practice chart family. */
export const dataIllustrations = {
  "data-sorted-groups": {
    kind: "sort-shapes",
    shapes: [
      "circle",
      "circle",
      "circle",
      "circle",
      "square",
      "square",
      "triangle",
      "triangle",
      "triangle",
    ],
  },
  "data-picture-one-to-one": {
    kind: "picture-graph",
    categories: [
      { label: "apple", count: 7 },
      { label: "pear", count: 4 },
      { label: "plum", count: 5 },
    ],
    key: 1,
    unit: "students",
  },
  "data-picture-key": {
    kind: "picture-graph",
    categories: [
      { label: "cat", count: 30 },
      { label: "dog", count: 45 },
      { label: "fish", count: 15 },
    ],
    key: 10,
    unit: "students",
  },
  "data-scaled-bars": {
    kind: "scaled-bar-graph",
    categories: [
      { label: "Mon", value: 30 },
      { label: "Tue", value: 45 },
      { label: "Wed", value: 15 },
      { label: "Thu", value: 50 },
    ],
    step: 10,
    max: 60,
    unit: "cans",
  },
  "data-line-plot-inches": {
    kind: "line-plot",
    denominator: 1,
    start: 3,
    end: 9,
    values: [4, 5, 5, 6, 6, 6, 8],
    mark: "x",
    unit: "inches",
  },
  "data-line-plot-quarters": {
    kind: "line-plot",
    denominator: 4,
    start: 4,
    end: 12,
    values: [5, 6, 6, 9, 9, 9, 11],
    mark: "x",
    unit: "inches",
  },
  "data-line-plot-share": {
    kind: "line-plot",
    denominator: 4,
    start: 0,
    end: 8,
    values: [1, 2, 2, 3, 7],
    mark: "x",
    unit: "liters",
  },
} as const satisfies Record<string, DataDisplayFigure>;
export type DataIllustration = keyof typeof dataIllustrations;
export const isDataIllustration = (kind: string): kind is DataIllustration =>
  kind in dataIllustrations;
