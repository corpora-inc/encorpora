import { z } from "zod";
import { base } from "../base";
import { registerComponent, type Prim } from "../layout";
import { atSchema, shifted } from "./shapes";
import type { FillRole, Point } from "../spec";

/**
 * Rectangular prisms in isometric view: x runs right and down, y (depth)
 * left and down, z straight up. The faces seen are the top, the left front
 * and the right front. Three forms:
 *  - `cubes`: a prism built from unit cubes, one layer at a time (layer k is
 *    `layer.k`); with `counts`, a running total beside each layer
 *    (`count.k`, derived);
 *  - `box`: a solid box with edges labeled in centimeters, one may be "?";
 *  - `composite`: two boxes of one depth side by side, the taller behind.
 */
const cube = z.number().int().min(1).max(6);
const edge = z.number().int().min(1).max(12);
const length = z
  .object({ value: edge, unit: z.literal("cm") })
  .strict()
  .nullable();
export const isoSolidSchema = z
  .object({
    ...base,
    type: z.literal("isoSolid"),
    /** Math-unit offset, to place several components in one scene. */
    at: atSchema.optional(),
    solid: z.discriminatedUnion("form", [
      z
        .object({
          form: z.literal("cubes"),
          length: cube,
          width: cube,
          height: cube,
          counts: z.boolean().optional(),
          /** Lift each layer this many units above the one below (an
           * exploded view of the layers). */
          lift: z.number().min(0).max(3).optional(),
        })
        .strict(),
      z
        .object({
          form: z.literal("box"),
          length,
          width: length,
          height: length,
        })
        .strict()
        .refine(
          (b) =>
            [b.length, b.width, b.height].filter((e) => e === null).length <= 1,
          "At most one unknown edge",
        ),
      z
        .object({
          form: z.literal("composite"),
          width: edge,
          parts: z
            .array(z.object({ length: edge, height: edge }).strict())
            .length(2),
          unit: z.literal("cm"),
          /** Pull the shorter prism this many units away (an exploded view),
           * rule both into unit cubes, and leave edges unlabeled. */
          apart: z.number().min(0).max(4).optional(),
        })
        .strict()
        .refine(
          (c) => c.parts[0]!.height > c.parts[1]!.height,
          "The taller is behind",
        ),
    ]),
  })
  .strict();
export type IsoSolid = z.infer<typeof isoSolidSchema>;

const C = Math.sqrt(3) / 2;
/** Isometric projection to figure math coordinates (y up). */
export const iso = (x: number, y: number, z: number): Point => [
  (x - y) * C,
  z - (x + y) / 2,
];
type V3 = [number, number, number];

/** The three faces of a box that face the viewer, optionally ruled into unit
 * squares, and its visible outline. Boxes nearer the viewer go later. */
export function isoBox(
  at: V3,
  [l, w, h]: V3,
  grid: boolean,
  id: string,
): Prim[] {
  const [x0, y0, z0] = at,
    x1 = x0 + l,
    y1 = y0 + w,
    z1 = z0 + h;
  const face = (key: string, pts: V3[], fill: FillRole): Prim => ({
    type: "polygon",
    id: `${id}.${key}`,
    points: pts.map((p) => iso(...p)),
    fill,
    noStroke: true,
  });
  const prims: Prim[] = [
    face(
      "top",
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      "accent-strong",
    ),
    face(
      "left",
      [
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      "accent-fill",
    ),
    face(
      "right",
      [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
      "empty",
    ),
  ];
  const seg = (key: string, a: V3, b: V3, rule: boolean) =>
    prims.push({
      type: "segment",
      id: `${id}.${key}`,
      from: iso(...a),
      to: iso(...b),
      stroke: rule ? "accent" : "ink",
      width: rule ? 1.25 : 2,
      cap: "round",
    });
  if (grid) {
    for (let i = 1; i < l; i++) {
      seg(`grid.x${i}.top`, [x0 + i, y0, z1], [x0 + i, y1, z1], true);
      seg(`grid.x${i}.side`, [x0 + i, y1, z0], [x0 + i, y1, z1], true);
    }
    for (let j = 1; j < w; j++) {
      seg(`grid.y${j}.top`, [x0, y0 + j, z1], [x1, y0 + j, z1], true);
      seg(`grid.y${j}.side`, [x1, y0 + j, z0], [x1, y0 + j, z1], true);
    }
    for (let k = 1; k < h; k++) {
      seg(`grid.z${k}.left`, [x0, y1, z0 + k], [x1, y1, z0 + k], true);
      seg(`grid.z${k}.right`, [x1, y0, z0 + k], [x1, y1, z0 + k], true);
    }
  }
  const outline: [V3, V3][] = [
    [
      [x0, y0, z1],
      [x1, y0, z1],
    ],
    [
      [x1, y0, z1],
      [x1, y1, z1],
    ],
    [
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [
      [x0, y1, z1],
      [x0, y0, z1],
    ],
    [
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    [
      [x1, y1, z0],
      [x1, y0, z0],
    ],
    [
      [x0, y1, z0],
      [x0, y1, z1],
    ],
    [
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    [
      [x1, y0, z0],
      [x1, y0, z1],
    ],
  ];
  outline.forEach(([a, b], i) => seg(`edge.${i}`, a, b, false));
  return prims;
}

/** A label beside an edge, on the side away from the solid's center. */
function edgeLabel(id: string, a: V3, b: V3, center: V3, text: string): Prim {
  const p = iso(...a),
    q = iso(...b),
    o = iso(...center);
  const mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  let nx = -(q[1] - p[1]) / len,
    ny = (q[0] - p[0]) / len;
  if (nx * (mid[0] - o[0]) + ny * (mid[1] - o[1]) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const unknown = text === "?";
  return {
    type: "text",
    id,
    at: mid,
    text,
    font: "sans",
    bold: unknown,
    color: unknown ? "warm" : "ink",
    halo: true,
    align: [
      nx < -0.3 ? 1 : nx > 0.3 ? -1 : 0,
      ny > 0.3 ? 1 : ny < -0.3 ? -1 : 0,
    ],
    offset: [nx * 10, -ny * 10],
  };
}

function draw(c: IsoSolid): Prim[] {
  const s = c.solid;
  if (s.form === "cubes") {
    const { length: l, width: w, height: h } = s;
    const prims: Prim[] = [];
    for (let k = 0; k < h; k++) {
      const z0 = k * (1 + (s.lift ?? 0));
      prims.push(...isoBox([0, 0, z0], [l, w, 1], true, `layer.${k}`));
      if (s.counts)
        prims.push({
          type: "text",
          id: `count.${k}`,
          at: iso(l, 0, z0 + 0.5),
          text: String((k + 1) * l * w),
          font: "sans",
          bold: true,
          color: "warm",
          derived: true,
          align: [-1, 0],
          offset: [12, 0],
        });
    }
    return prims;
  }
  if (s.form === "box") {
    const given = [s.length, s.width, s.height];
    const known = given.filter((e) => e !== null).map((e) => e!.value);
    // A missing edge is drawn at a neutral length so the picture cannot
    // reveal the answer; the description says it is not to scale.
    const neutral = Math.max(
      2,
      Math.min(10, Math.round(Math.sqrt(known[0]! * known[1]!))),
    );
    const [l, w, h] = given.map((e) => e?.value ?? neutral) as V3;
    const center: V3 = [l / 2, w / 2, h / 2];
    const text = (e: (typeof given)[number]) => (e ? `${e.value} cm` : "?");
    return [
      ...isoBox([0, 0, 0], [l, w, h], false, "box"),
      edgeLabel("label.length", [0, w, 0], [l, w, 0], center, text(s.length)),
      edgeLabel("label.width", [l, 0, 0], [l, w, 0], center, text(s.width)),
      edgeLabel("label.height", [0, w, 0], [0, w, h], center, text(s.height)),
    ];
  }
  const [a, b] = s.parts as [
    { length: number; height: number },
    { length: number; height: number },
  ];
  const w = s.width,
    l = a.length + b.length,
    h = Math.max(a.height, b.height);
  const center: V3 = [l / 2, w / 2, h / 2];
  const cm = (n: number) => `${n} cm`;
  if (s.apart !== undefined)
    return [
      ...isoBox([0, 0, 0], [a.length, w, a.height], true, "tall"),
      ...isoBox(
        [a.length + s.apart, 0, 0],
        [b.length, w, b.height],
        true,
        "short",
      ),
    ];
  return [
    ...isoBox([0, 0, 0], [a.length, w, a.height], false, "tall"),
    ...isoBox([a.length, 0, 0], [b.length, w, b.height], false, "short"),
    edgeLabel(
      "label.leftLength",
      [0, 0, a.height],
      [a.length, 0, a.height],
      center,
      cm(a.length),
    ),
    edgeLabel(
      "label.rightLength",
      [a.length, w, 0],
      [l, w, 0],
      center,
      cm(b.length),
    ),
    edgeLabel(
      "label.leftHeight",
      [0, w, 0],
      [0, w, a.height],
      center,
      cm(a.height),
    ),
    edgeLabel(
      "label.rightHeight",
      [l, 0, 0],
      [l, 0, b.height],
      center,
      cm(b.height),
    ),
    edgeLabel("label.width", [l, 0, 0], [l, w, 0], center, cm(w)),
  ];
}

registerComponent("isoSolid", {
  maxScale: (c) => (c.solid.form === "cubes" ? 46 : 40),
  compile(c) {
    return shifted(draw(c), c.at);
  },
  describe(c, reveal) {
    const s = c.solid;
    if (s.form === "cubes")
      return `A rectangular prism built from unit cubes: ${s.length} cubes long, ${s.width} cubes wide and ${s.height} cubes high. Some cubes are hidden behind the visible faces.${s.counts ? (reveal ? " Running totals beside each layer." : " Running totals beside each layer are to be found.") : ""}`;
    if (s.form === "box") {
      const t = (e: typeof s.length) =>
        e ? `${e.value} ${e.unit}` : "unknown";
      const missing = [s.length, s.width, s.height].some((e) => e === null);
      return `A rectangular prism. Length ${t(s.length)}, width ${t(s.width)}, height ${t(s.height)}.${missing ? " The edge marked ? is unknown; the drawing is not to scale." : ""}`;
    }
    const [a, b] = s.parts;
    return `A solid made of two rectangular prisms side by side, both ${s.width} cm deep. Taller prism: ${a!.length} cm long and ${a!.height} cm high. Shorter prism: ${b!.length} cm long and ${b!.height} cm high.`;
  },
});
