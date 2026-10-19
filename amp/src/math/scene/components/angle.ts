import { registerComponent, type Prim } from "../layout";
import type { Angle, Point } from "../spec";

const at = (deg: number, r: number): Point => {
  const t = (deg * Math.PI) / 180;
  return [Math.cos(t) * r, Math.sin(t) * r];
};
/** Counterclockwise turn from direction a to direction b, in [0, 360). */
export const turn = (a: number, b: number) => (((b - a) % 360) + 360) % 360;
const degrees = (n: number) => `${Math.round(n * 1e6) / 1e6}°`;

registerComponent("protractor", {
  maxScale: () => 150,
  compile(c) {
    const prims: Prim[] = [
      {
        type: "arc",
        id: "body",
        center: [0, 0],
        r: 1,
        from: 0,
        to: 180,
        fill: "accent-fill",
        stroke: "ink",
        width: 1.5,
      },
      {
        type: "segment",
        id: "baseline",
        from: [-1, 0],
        to: [1, 0],
        stroke: "ink",
        width: 1.5,
      },
    ];
    for (let d = 0; d <= 180; d++)
      prims.push({
        type: "segment",
        id: `tick.${d}`,
        from: at(d, 1),
        to: at(d, d % 10 === 0 ? 0.91 : d % 5 === 0 ? 0.94 : 0.965),
        stroke: "ink",
        width: d % 10 === 0 ? 1.4 : 1,
      });
    for (let d = 0; d <= 180; d += 20) {
      // 0 and 180 sit just above the baseline, as on a real protractor.
      const lift = d === 0 ? 6 : d === 180 ? -6 : 0;
      prims.push({
        type: "text",
        id: `outer.${180 - d}`,
        at: at(d + lift, 0.82),
        text: String(180 - d),
        font: "sans",
        size: "sm",
        halo: true,
        data: { scale: "outer", value: 180 - d },
      });
      prims.push({
        type: "text",
        id: `inner.${d}`,
        at: at(d + lift * 1.4, 0.66),
        text: String(d),
        font: "sans",
        size: "sm",
        bold: true,
        color: "accent",
        halo: true,
        data: { scale: "inner", value: d },
      });
    }
    c.rays.forEach((d, i) => {
      prims.push({
        type: "segment",
        id: `ray.${i}`,
        from: [0, 0],
        to: at(d, 1.06),
        stroke: "ink",
        width: 3,
        cap: "round",
        data: { ray: d },
      });
      prims.push({
        type: "point",
        id: `end.${i}`,
        at: at(d, 1.06),
        r: 3.5,
        color: "ink",
      });
    });
    prims.push({
      type: "point",
      id: "vertex",
      at: [0, 0],
      r: 3.5,
      color: "ink",
    });
    if (c.labels) {
      const [a, v, b] = c.labels;
      prims.push(
        {
          type: "text",
          id: "label.0",
          at: at(c.rays[0], 1.06),
          text: a,
          bold: true,
          place: [
            [0, -14, 0, 1],
            [c.rays[0] < 90 ? 12 : -12, 0, c.rays[0] < 90 ? -1 : 1, 0],
          ],
        },
        {
          type: "text",
          id: "label.vertex",
          at: [0, 0],
          text: v,
          bold: true,
          align: [0, -1],
          offset: [0, 8],
        },
        {
          type: "text",
          id: "label.1",
          at: at(c.rays[1], 1.06),
          text: b,
          bold: true,
          place: [
            [c.rays[1] < 90 ? 10 : -10, -8, c.rays[1] < 90 ? -1 : 1, 1],
            [0, -12, 0, 1],
          ],
        },
      );
    }
    return prims;
  },
  describe(c) {
    const [a, v, b] = c.labels ?? ["", "the vertex", ""];
    const zero = c.rays[0] === 0 ? "right" : c.rays[0] === 180 ? "left" : "";
    return `A protractor centered on ${v}. ${zero ? `Ray ${v}${a} lies on 0 at the ${zero}; ` : ""}ray ${v}${b} crosses the scales. Outer numbers count from 0 on the left; inner numbers count from 0 on the right.`;
  },
});

registerComponent("angle", {
  maxScale: (c) => 140 / (c.length ?? 1),
  compile(c) {
    const L = c.length ?? 1;
    const prims: Prim[] = [];
    c.rays.forEach((d, i) => {
      prims.push({
        type: "segment",
        id: `ray.${i}`,
        from: [0, 0],
        to: at(d, L),
        stroke: "ink",
        width: 3,
        arrow: c.arrows ? "end" : undefined,
        data: { ray: d },
      });
      if (!c.arrows)
        prims.push({
          type: "point",
          id: `end.${i}`,
          at: at(d, L),
          r: 3.5,
          color: "ink",
        });
    });
    prims.push({
      type: "point",
      id: "vertex",
      at: [0, 0],
      r: 3.5,
      color: "ink",
    });
    (c.marks ?? []).forEach((m, i) => {
      const a = c.rays[m.from]!,
        span = turn(a, c.rays[m.to]!);
      const r = L * (0.24 + 0.1 * i);
      if (Math.abs(span - 90) < 1e-9)
        prims.push({
          type: "polyline",
          id: `mark.${i}`,
          points: [
            at(a, 0.16 * L),
            [...add(at(a, 0.16 * L), at(a + 90, 0.16 * L))] as Point,
            at(a + 90, 0.16 * L),
          ],
          stroke: "ink",
          width: 2,
          data: { mark: "right" },
        });
      else
        prims.push({
          type: "arc",
          id: `mark.${i}`,
          center: [0, 0],
          r,
          from: a,
          to: a + span,
          stroke: m.color ?? "accent",
          width: 2.5,
          data: { mark: "arc" },
        });
      if (m.measure) {
        // Small angles push their label out so it clears both rays.
        const out = Math.min(
          0.95 * L,
          Math.max(
            r + 0.2 * L,
            (0.22 * L) / Math.sin(((span / 2) * Math.PI) / 180),
          ),
        );
        prims.push({
          type: "text",
          id: `measure.${i}`,
          at: at(a + span / 2, out),
          text: degrees(span),
          font: "sans",
          bold: true,
          derived: m.derived,
          color: m.derived ? "warm" : "ink",
          halo: true,
        });
      }
    });
    if (c.labels) {
      c.labels.ends.forEach((name, i) =>
        prims.push({
          type: "text",
          id: `label.${i}`,
          at: at(c.rays[i]!, L * 1.14),
          text: name,
          bold: true,
          halo: true,
        }),
      );
      // The vertex letter takes the widest gap between rays.
      const sorted = [...c.rays].map((d) => turn(0, d)).sort((x, y) => x - y);
      let best = -1,
        middle = 0;
      sorted.forEach((d, i) => {
        const gap = turn(d, sorted[(i + 1) % sorted.length]!) || 360;
        if (gap > best) {
          best = gap;
          middle = d + gap / 2;
        }
      });
      prims.push({
        type: "text",
        id: "label.vertex",
        at: at(middle, 0.13 * L),
        text: c.labels.vertex,
        bold: true,
        halo: true,
      });
    }
    return prims;
  },
  describe(c, reveal) {
    const names = c.labels;
    const name = (m: { from: number; to: number }) =>
      names
        ? `angle ${names.ends[m.from]}${names.vertex}${names.ends[m.to]}`
        : "the angle";
    const marks = (c.marks ?? []).map((m) => {
      const span = turn(c.rays[m.from]!, c.rays[m.to]!);
      if (Math.abs(span - 90) < 1e-9)
        return `${name(m)} is marked as a right angle`;
      if (!m.measure) return "";
      return m.derived && !reveal
        ? `${name(m)} is the measure to find`
        : `${name(m)} is ${degrees(span)}`;
    });
    return `${c.rays.length} rays from one vertex${names ? ` ${names.vertex}` : ""}.${marks
      .filter(Boolean)
      .map((m) => ` ${m[0]!.toUpperCase()}${m.slice(1)}.`)
      .join("")}`;
  },
});

function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1]];
}

export type { Angle };
