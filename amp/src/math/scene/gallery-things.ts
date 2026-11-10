import type { Scene } from "./spec";
import { thingKinds } from "./components/things-art";

/** Reference scenes for `things` (scenes-v3): every kind, and every
 * arrangement at its typical and its tightest size. The gallery draws them
 * at every width and theme and on print pages. */
const one = (element: Scene["elements"][number], extra: Partial<Scene> = {}) =>
  ({ v: 1, elements: [element], ...extra }) as Scene;

export const thingsCases: { name: string; scene: Scene }[] = [
  {
    name: "Things: every kind, in rows of six",
    scene: one(
      {
        type: "things",
        id: "all",
        sets: thingKinds.map((kind) => ({ kind, count: 1 })),
        arrange: "grid",
        perRow: 6,
      },
      { title: "Things to count" },
    ),
  },
  {
    name: "Things: five apples in a row",
    scene: one({
      type: "things",
      id: "row",
      sets: [{ kind: "apple", count: 5 }],
    }),
  },
  {
    name: "Things: ten pencils in a row, the smallest they are drawn",
    scene: one({
      type: "things",
      id: "row",
      sets: [{ kind: "pencil", count: 10 }],
    }),
  },
  {
    name: "Things: a tidy scatter of seven fish",
    scene: one({
      type: "things",
      id: "pond",
      sets: [{ kind: "fish", count: 7 }],
      arrange: "scatter",
      seed: "pond",
    }),
  },
  {
    name: "Things: a scatter of three kinds of toy",
    scene: one({
      type: "things",
      id: "toys",
      sets: [
        { kind: "bear", count: 2 },
        { kind: "ball", count: 3 },
        { kind: "car", count: 1 },
      ],
      arrange: "scatter",
      seed: "toy-box",
    }),
  },
  {
    name: "Things: two groups, three ducks and two ducks",
    scene: one({
      type: "things",
      id: "groups",
      sets: [
        { kind: "duck", count: 3 },
        { kind: "duck", count: 2 },
      ],
      arrange: "groups",
    }),
  },
  {
    name: "Things: a five-frame with three balls",
    scene: one({
      type: "things",
      id: "five",
      sets: [{ kind: "ball", count: 3 }],
      arrange: "frame",
      frame: 5,
    }),
  },
  {
    name: "Things: a ten-frame with seven strawberries",
    scene: one({
      type: "things",
      id: "ten",
      sets: [{ kind: "strawberry", count: 7 }],
      arrange: "frame",
    }),
  },
  {
    name: "Things: two ten-frames, thirteen stars",
    scene: one(
      {
        type: "things",
        id: "teen",
        sets: [{ kind: "star", count: 13 }],
        arrange: "frame",
      },
      { maxHeight: 420 },
    ),
  },
];
