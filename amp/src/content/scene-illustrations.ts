import { graph, table } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";

/** Lesson models built with the scene framework, drawn revealed. */
export const sceneIllustrations = {
  "scene-scatter-study": graph({
    x: [0, 10],
    y: [30, 100],
    grid: [1, 10],
    tick: [1, 10],
    aspect: 0.1029,
    axisNames: ["hours studied", "test score"],
  })
    .scatter([
      [1, 50],
      [2, 55],
      [2, 62],
      [3, 58],
      [4, 66],
      [5, 70],
      [5, 74],
      [6, 72],
      [7, 82],
      [8, 84],
      [9, 88],
      [10, 96],
    ])
    .scene(),
  "scene-scatter-curve": graph({
    x: [6, 20],
    y: [40, 90],
    grid: [2, 10],
    tick: [2, 10],
    aspect: 0.2016,
    axisNames: ["hour of the day", "temperature (°F)"],
  })
    .scatter([
      [6, 44],
      [8, 58],
      [10, 70],
      [12, 80],
      [14, 84],
      [16, 80],
      [18, 70],
      [20, 56],
    ])
    .scene(),
  "scene-scatter-trend": graph({
    x: [0, 10],
    y: [0, 30],
    grid: [1, 5],
    tick: [1, 5],
    aspect: 0.24,
    axisNames: ["age (years)", "value (thousand $)"],
  })
    .scatter(
      [
        [1, 26],
        [2, 23],
        [3, 21],
        [4, 19],
        [5, 18],
        [6, 13],
        [7, 12],
        [8, 9],
        [9, 5],
        [10, 6],
      ],
      { m: -2, b: 26 },
    )
    .point(2, 22, undefined, { open: true })
    .point(8, 10, undefined, { open: true })
    .scene(),
  "scene-two-way-blank": table({
    title: "Has a curfew",
    columns: ["Yes", "No", "Total"],
    rows: [
      { label: "Grade 7", cells: [18, 2, 20] },
      { label: "Grade 8", cells: [null, null, 60] },
      { label: "Total", cells: [42, 38, 80] },
    ],
    sums: true,
    derived: [[1, 0]],
  }).scene(),
  "scene-two-way-curfew": table({
    title: "Has a curfew",
    columns: ["Yes", "No", "Total"],
    rows: [
      { label: "Grade 7", cells: [18, 2, 20] },
      { label: "Grade 8", cells: [24, 36, 60] },
      { label: "Total", cells: [42, 38, 80] },
    ],
    sums: true,
  }).scene(),
} as const satisfies Record<string, Scene>;
export type SceneIllustration = keyof typeof sceneIllustrations;
export const isSceneIllustration = (kind: string): kind is SceneIllustration =>
  kind in sceneIllustrations;
