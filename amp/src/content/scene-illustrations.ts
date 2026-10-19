import { f, graph, scene, table } from "../math/scene/author";
import type { Graph, Scene } from "../math/scene/spec";

/** Lesson models drawn with the scene framework and shown revealed: exact
 * data, one renderer for screen and print, no bespoke illustration code. */
const g = (spec: Omit<Graph, "type">) => ({ type: "graph" as const, ...spec });

export const sceneIllustrations = {
  // f on −3 ≤ x < 4: the domain marked on the x-axis, the range on the y-axis.
  "domain-range-axes": scene(
    g({
      id: "g",
      x: [-5, 6],
      y: [-4, 6],
      grid: 1,
      curves: [
        {
          fn: f.poly(0.5, -1, -1.5),
          domain: [-3, 4],
          ends: ["closed", "open"],
        },
      ],
      segments: [
        { from: [-3, 0], to: [4, 0], color: "gold" },
        { from: [0, -2], to: [0, 6], color: "warm" },
      ],
      points: [
        { x: -3, y: 0, color: "gold", label: "−3" },
        { x: 4, y: 0, open: true, color: "gold", label: "4" },
        { x: 0, y: -2, color: "warm", label: "−2" },
        { x: 0, y: 6, color: "warm", label: "6" },
      ],
    }),
  ).build({
    title: "Domain −3 ≤ x < 4 on the x-axis and range −2 ≤ y ≤ 6 on the y-axis",
  }),
  // A repeated input with two outputs breaks a function.
  "relation-repeated-input": table(
    [
      ["x", "1", "2", "2", "5"],
      ["y", "4", "3", "7", "4"],
    ],
    { highlight: [2, 3] },
  ).scene({ title: "The input 2 has two outputs, 3 and 7" }),
  // f(x) = x² − 2x − 1 from A (1, −2) to B (4, 7): the secant's slope is 9/3.
  "average-rate-secant": graph({ id: "g", x: [-3, 5], y: [-3, 9], grid: 1 })
    .curve(f.poly(1, -2, -1))
    .secant(0, 1, 4)
    .slope([1, -2], [4, 7], "shown")
    .point(1, -2, "A")
    .point(4, 7, "B")
    .scene({
      title: "Secant AB on y = x² − 2x − 1: rise 9 over run 3",
    }),
  // F = 2d + 3: the starting amount on the F-axis, the rate as a slope step.
  "linear-model-graph": graph({
    id: "g",
    x: [0, 7],
    y: [0, 17],
    grid: 1,
    tick: 2,
    axisNames: ["d", "F"],
  })
    .curve(f.poly(2, 3), { domain: [0, 6], ends: ["none", "none"] })
    .slope([2, 7], [3, 9], "shown")
    .point(0, 3, "(0, 3)")
    .scene({ title: "F = 2d + 3: starts at 3 and rises 2 per mile" }),
  // Isolating h in A = bh/2: each step undoes one operation on both sides.
  "formula-isolate-steps": table(
    [
      ["A = bh/2", "Given"],
      ["2A = bh", "Multiply both sides by 2"],
      ["2A/b = h", "Divide both sides by b"],
    ],
    { header: "none", rules: "rows", align: ["left", "left"] },
  ).scene({ title: "Solving A = bh/2 for h" }),
  // The graph of 2x + 3y = 12 is exactly its solutions.
  "solution-set-line": graph({ id: "g", x: [-2, 8], y: [-2, 6], grid: 1 })
    .line({ a: 2, b: 3, c: 12 }, { label: "2x + 3y = 12" })
    .point(0, 4, "(0, 4)")
    .point(3, 2, "(3, 2)")
    .point(6, 0, "(6, 0)")
    .point(4, 4, "(4, 4)", { open: true })
    .scene({
      title: "Solutions of 2x + 3y = 12 lie on its line; (4, 4) does not",
    }),
} satisfies Record<string, Scene>;
export type SceneIllustrationKind = keyof typeof sceneIllustrations;
export const isSceneIllustration = (
  kind: string,
): kind is SceneIllustrationKind => kind in sceneIllustrations;
