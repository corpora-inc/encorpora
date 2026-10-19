import React from "react";
import type { AngleFigure as Model } from "../math/angle-figures.js";

const ink = "var(--color-figure-ink)",
  accent = "var(--color-figure-accent)",
  warm = "var(--color-figure-warm)",
  paper = "var(--color-figure-paper)";
const rad = Math.PI / 180;
const f2 = (n: number) => n.toFixed(2);
type P = { x: number; y: number };
/** A point at distance r in direction d (degrees, counterclockwise; screen y down). */
const polar = (c: P, r: number, d: number): P => ({
  x: c.x + r * Math.cos(d * rad),
  y: c.y - r * Math.sin(d * rad),
});
const halo = {
  stroke: paper,
  strokeWidth: 5,
  paintOrder: "stroke" as const,
};
const scaleHalo = {
  stroke: "var(--color-figure-accent-fill)",
  strokeWidth: 4,
  paintOrder: "stroke" as const,
};
/** Arc from direction a counterclockwise to direction b. */
function arc(c: P, r: number, a: number, b: number) {
  const sweep = (((b - a) % 360) + 360) % 360;
  const s = polar(c, r, a),
    e = polar(c, r, b);
  return `M${f2(s.x)} ${f2(s.y)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 0 ${f2(e.x)} ${f2(e.y)}`;
}
function Arrow({ from, to }: { from: P; to: P }) {
  const d = Math.atan2(to.y - from.y, to.x - from.x);
  const back = (s: number) => ({
    x: to.x - 13 * Math.cos(d) + s * 6 * Math.sin(d),
    y: to.y - 13 * Math.sin(d) - s * 6 * Math.cos(d),
  });
  const l = back(1),
    r = back(-1);
  return (
    <path
      d={`M${f2(to.x)} ${f2(to.y)} L${f2(l.x)} ${f2(l.y)} L${f2(r.x)} ${f2(r.y)} Z`}
      fill={ink}
    />
  );
}

/** A protractor centered at c, its baseline from direction 180 to 0. Outer
 * numbers count from 0 on the left; inner numbers from 0 on the right. */
export function Protractor({
  c,
  radius,
  children,
}: {
  c: P;
  radius: number;
  /** Drawn under the scale, as rays under a clear protractor. */
  children?: React.ReactNode;
}) {
  const ticks: string[] = [];
  for (let d = 0; d <= 180; d++) {
    const len = d % 10 === 0 ? 13 : d % 5 === 0 ? 9 : 5;
    const a = polar(c, radius, d),
      b = polar(c, radius - len, d);
    ticks.push(`M${f2(a.x)} ${f2(a.y)} L${f2(b.x)} ${f2(b.y)}`);
  }
  const labels = Array.from({ length: 10 }, (_, i) => i * 20);
  return (
    <g data-protractor="">
      <path
        d={`M${c.x - radius} ${c.y} A${radius} ${radius} 0 0 1 ${c.x + radius} ${c.y} Z`}
        fill="var(--color-figure-accent-fill)"
        stroke={ink}
        strokeWidth={1.5}
      />
      {children}
      <path d={ticks.join(" ")} stroke={ink} strokeWidth={1} />
      {labels.map((d) => {
        // 0 and 180 sit just above the baseline, as on a real protractor.
        const at = d === 0 ? 6 : d === 180 ? 174 : d;
        const outer = polar(c, radius - 25, at),
          inner = polar(
            c,
            radius - 48,
            at + (d === 0 ? 3 : d === 180 ? -3 : 0),
          );
        return (
          <g key={d}>
            <text
              x={outer.x}
              y={outer.y + 5}
              textAnchor="middle"
              style={{ fontSize: 15, fill: ink, ...scaleHalo }}
            >
              {180 - d}
            </text>
            <text
              x={inner.x}
              y={inner.y + 5}
              textAnchor="middle"
              style={{
                fontSize: 14,
                fill: accent,
                fontWeight: 700,
                ...scaleHalo,
              }}
            >
              {d}
            </text>
          </g>
        );
      })}
      <circle cx={c.x} cy={c.y} r={3.5} fill={ink} />
    </g>
  );
}

/** Rays from c with letters past their ends and at the vertex. */
function Rays({
  c,
  length,
  rays,
  labels,
}: {
  c: P;
  length: number;
  rays: readonly number[];
  labels?: { ends: string[]; vertex: string; vertexAt: number };
}) {
  return (
    <g>
      {rays.map((d, i) => {
        const end = polar(c, length, d);
        return (
          <g key={i}>
            <path
              d={`M${f2(c.x)} ${f2(c.y)} L${f2(end.x)} ${f2(end.y)}`}
              stroke={ink}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={end.x} cy={end.y} r={4} fill={ink} />
            {labels && (
              <text
                x={polar(c, length + 18, d).x}
                y={polar(c, length + 18, d).y + 7}
                textAnchor="middle"
                style={{ fontSize: 19, fontWeight: 700, fill: ink, ...halo }}
              >
                {labels.ends[i]}
              </text>
            )}
          </g>
        );
      })}
      {labels && (
        <text
          x={polar(c, 22, labels.vertexAt).x}
          y={polar(c, 22, labels.vertexAt).y + 7}
          textAnchor="middle"
          style={{ fontSize: 19, fontWeight: 700, fill: ink, ...halo }}
        >
          {labels.vertex}
        </text>
      )}
    </g>
  );
}

/** The direction halfway around the larger gap between rays, for a label
 * that sits clear of them. */
function clearDirection(rays: readonly number[]) {
  const sorted = [...rays]
    .map((d) => ((d % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let best = 0,
    at = 0;
  sorted.forEach((d, i) => {
    const next = i === sorted.length - 1 ? sorted[0]! + 360 : sorted[i + 1]!;
    if (next - d > best) {
      best = next - d;
      at = d + best / 2;
    }
  });
  return at;
}

export function AngleFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "protractor": {
      const c = { x: 180, y: 192 },
        radius = 150;
      const [a, b, cc] = figure.labels;
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 222"
          role="img"
          aria-label={`A protractor centered on vertex ${b}. Ray ${b}${a} lies along the baseline; ray ${b}${cc} crosses the scales. Outer numbers count from 0 on the left; inner numbers from 0 on the right.`}
        >
          <Protractor c={c} radius={radius}>
            <Rays
              c={c}
              length={radius + 6}
              rays={figure.rays}
              labels={{ ends: [a, cc], vertex: b, vertexAt: 270 }}
            />
          </Protractor>
        </svg>
      );
    }
    case "angle-figure": {
      const [r0, r1] = figure.rays;
      const m = (((r1 - r0) % 360) + 360) % 360;
      const length = 120;
      const pts = [
        { x: 0, y: 0 },
        polar({ x: 0, y: 0 }, length, r0),
        polar({ x: 0, y: 0 }, length, r1),
      ];
      const minX = Math.min(...pts.map((p) => p.x)),
        maxX = Math.max(...pts.map((p) => p.x)),
        minY = Math.min(...pts.map((p) => p.y)),
        maxY = Math.max(...pts.map((p) => p.y));
      const c = {
        x: 160 - (minX + maxX) / 2,
        y: 110 - (minY + maxY) / 2,
      };
      const right = Math.abs(m - 90) < 1e-9;
      const corner = [
        polar(c, 18, r0),
        polar(polar(c, 18, r0), 18, r1),
        polar(c, 18, r1),
      ];
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 320 220"
          role="img"
          aria-label={`An angle made by two rays from one vertex${right ? ", marked as a right angle" : ""}.`}
        >
          {right ? (
            <path
              d={`M${corner.map((p) => `${f2(p.x)} ${f2(p.y)}`).join(" L")}`}
              fill="none"
              stroke={ink}
              strokeWidth={2}
            />
          ) : (
            <path
              d={arc(c, 30, r0, r1)}
              fill="none"
              stroke={warm}
              strokeWidth={3}
            />
          )}
          {[r0, r1].map((d) => (
            <g key={d}>
              <path
                d={`M${f2(c.x)} ${f2(c.y)} L${f2(polar(c, length, d).x)} ${f2(polar(c, length, d).y)}`}
                stroke={ink}
                strokeWidth={3}
              />
              <Arrow from={c} to={polar(c, length + 4, d)} />
            </g>
          ))}
          <circle cx={c.x} cy={c.y} r={4} fill={ink} />
        </svg>
      );
    }
    case "angle-parts": {
      const [d0, d1, d2] = figure.rays;
      const [A, B, C, D] = figure.labels;
      const length = 120;
      const o = { x: 0, y: 0 };
      const pts = [o, ...figure.rays.map((d) => polar(o, length + 22, d))];
      const minX = Math.min(...pts.map((p) => p.x)),
        maxX = Math.max(...pts.map((p) => p.x)),
        minY = Math.min(...pts.map((p) => p.y)),
        maxY = Math.max(...pts.map((p) => p.y));
      const scale = Math.min(1, 300 / (maxX - minX), 190 / (maxY - minY));
      const L = length * scale;
      const c = {
        x: 170 - ((minX + maxX) / 2) * scale,
        y: 138 - ((minY + maxY) / 2) * scale,
      };
      const span = (a: number, b: number) => (((b - a) % 360) + 360) % 360;
      const text = (v: number | null) => (v === null ? "?" : `${v}°`);
      const part = (a: number, b: number, v: number | null, key: string) => {
        const m = span(a, b);
        const r = Math.min(
          L - 8,
          Math.max(0.55 * L, 24 / Math.sin((m / 2) * rad)),
        );
        const at = polar(c, r, a + m / 2);
        return (
          <g key={key}>
            <path
              d={arc(c, 0.36 * L, a, b)}
              fill="none"
              stroke={accent}
              strokeWidth={2.5}
            />
            <text
              x={at.x}
              y={at.y + 6}
              textAnchor="middle"
              style={{
                fontSize: 18,
                fontWeight: 700,
                fill: v === null ? warm : ink,
                ...halo,
              }}
            >
              {text(v)}
            </text>
          </g>
        );
      };
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 340 240"
          role="img"
          aria-label={`Three rays from vertex ${B}: ${B}${A}, ${B}${C} and ${B}${D}. Angle ${A}${B}${C} is ${text(figure.parts[0])}, angle ${C}${B}${D} is ${text(figure.parts[1])}, and angle ${A}${B}${D} is ${text(figure.whole)}.`}
        >
          {part(d0, d1, figure.parts[0], "p0")}
          {part(d1, d2, figure.parts[1], "p1")}
          <Rays
            c={c}
            length={L}
            rays={[d0, d1, d2]}
            labels={{
              ends: [A, C, D],
              vertex: B,
              vertexAt: clearDirection([d0, d1, d2]),
            }}
          />
          <text
            x={12}
            y={24}
            style={{
              fontSize: 17,
              fontWeight: 700,
              fill: figure.whole === null ? warm : ink,
            }}
          >
            {`∠${A}${B}${D} = ${text(figure.whole)}`}
          </text>
        </svg>
      );
    }
    case "turn-circle": {
      const c = { x: 160, y: 115 },
        R = 100;
      const each = 360 / figure.parts;
      const spokes = Array.from(
        { length: figure.parts },
        (_, i) => figure.start + i * each,
      );
      const end = figure.start + figure.shaded * each;
      const s = polar(c, R, figure.start),
        e = polar(c, R, end);
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 320 230"
          role="img"
          aria-label={`A circle cut into ${figure.parts} equal angles at its center; ${figure.shaded} of them are shaded together as one angle.`}
        >
          <circle
            cx={c.x}
            cy={c.y}
            r={R}
            fill={paper}
            stroke={ink}
            strokeWidth={2}
          />
          <path
            d={`M${c.x} ${c.y} L${f2(s.x)} ${f2(s.y)} A${R} ${R} 0 ${end - figure.start > 180 ? 1 : 0} 0 ${f2(e.x)} ${f2(e.y)} Z`}
            fill="var(--color-figure-accent-fill-strong)"
          />
          <path
            d={spokes
              .map((d) => {
                const p = polar(c, R, d);
                return `M${c.x} ${c.y} L${f2(p.x)} ${f2(p.y)}`;
              })
              .join(" ")}
            stroke={ink}
            strokeWidth={figure.parts > 12 ? 1 : 1.5}
          />
          <path
            d={`M${c.x} ${c.y} L${f2(s.x)} ${f2(s.y)} M${c.x} ${c.y} L${f2(e.x)} ${f2(e.y)}`}
            stroke={ink}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <path
            d={arc(c, 26, figure.start, end)}
            fill="none"
            stroke={warm}
            strokeWidth={3}
          />
          <circle cx={c.x} cy={c.y} r={4} fill={ink} />
        </svg>
      );
    }
    case "line-pair": {
      const { columns, rows } = figure;
      const step = Math.min(300 / (columns - 1 + 1), 210 / (rows - 1 + 1));
      const left = (320 - step * (columns - 1)) / 2,
        top = (230 - step * (rows - 1)) / 2;
      const at = ([x, y]: readonly [number, number]) => ({
        x: left + x * step,
        y: top + (rows - 1 - y) * step,
      });
      const lo = -0.45,
        hiX = columns - 1 + 0.45,
        hiY = rows - 1 + 0.45;
      /** Extend the line through two dots to the edges of the grid. */
      const extend = ([p, q]: readonly [
        readonly [number, number],
        readonly [number, number],
      ]) => {
        const dx = q[0] - p[0],
          dy = q[1] - p[1];
        const ts: number[] = [];
        if (dx !== 0) ts.push((lo - p[0]) / dx, (hiX - p[0]) / dx);
        if (dy !== 0) ts.push((lo - p[1]) / dy, (hiY - p[1]) / dy);
        const inside = ts
          .map((t) => [p[0] + t * dx, p[1] + t * dy] as const)
          .filter(
            ([x, y]) =>
              x >= lo - 1e-9 &&
              x <= hiX + 1e-9 &&
              y >= lo - 1e-9 &&
              y <= hiY + 1e-9,
          );
        const sorted = inside.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        return [sorted[0]!, sorted[sorted.length - 1]!] as const;
      };
      const dots = [];
      for (let x = 0; x < columns; x++)
        for (let y = 0; y < rows; y++) {
          const p = at([x, y]);
          dots.push(
            <circle
              key={`${x},${y}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill="var(--color-figure-grid)"
            />,
          );
        }
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 320 230"
          role="img"
          aria-label={`Two lines drawn through dots of a ${columns} by ${rows} dot grid.`}
        >
          {dots}
          {figure.lines.map((l, i) => {
            const [a, b] = extend(l).map(at) as [P, P];
            return (
              <g key={i}>
                <path
                  d={`M${f2(a.x)} ${f2(a.y)} L${f2(b.x)} ${f2(b.y)}`}
                  stroke={i === 0 ? ink : warm}
                  strokeWidth={3}
                />
                {l.map((p, j) => {
                  const q = at(p);
                  return (
                    <circle
                      key={j}
                      cx={q.x}
                      cy={q.y}
                      r={4.5}
                      fill={i === 0 ? ink : warm}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      );
    }
    case "linear-object": {
      const [p, q] = figure.points;
      const unit = 90,
        c = { x: 160, y: 95 };
      const s = (u: readonly [number, number]) => ({
        x: c.x + u[0] * unit,
        y: c.y - u[1] * unit,
      });
      const P0 = s(p),
        Q0 = s(q);
      const dx = Q0.x - P0.x,
        dy = Q0.y - P0.y,
        len = Math.hypot(dx, dy);
      const ux = dx / len,
        uy = dy / len;
      const ends = [
        figure.ends[0] === "arrow"
          ? { x: P0.x - ux * 45, y: P0.y - uy * 45 }
          : P0,
        figure.ends[1] === "arrow"
          ? { x: Q0.x + ux * 45, y: Q0.y + uy * 45 }
          : Q0,
      ] as [P, P];
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 320 180"
          role="img"
          aria-label={`A straight figure through points ${figure.labels[0]} and ${figure.labels[1]}. At ${figure.labels[0]} it ${figure.ends[0] === "arrow" ? "continues with an arrow" : "stops"}; at ${figure.labels[1]} it ${figure.ends[1] === "arrow" ? "continues with an arrow" : "stops"}.`}
        >
          <path
            d={`M${f2(ends[0].x)} ${f2(ends[0].y)} L${f2(ends[1].x)} ${f2(ends[1].y)}`}
            stroke={ink}
            strokeWidth={3}
          />
          {figure.ends[0] === "arrow" && <Arrow from={P0} to={ends[0]} />}
          {figure.ends[1] === "arrow" && <Arrow from={Q0} to={ends[1]} />}
          {[P0, Q0].map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r={5.5} fill={ink} />
              <text
                x={pt.x - uy * 24}
                y={pt.y + ux * 24 + 7}
                textAnchor="middle"
                style={{ fontSize: 20, fontWeight: 700, fill: ink, ...halo }}
              >
                {figure.labels[i]}
              </text>
            </g>
          ))}
        </svg>
      );
    }
    case "symmetry-lines": {
      const pts = [...figure.shape, ...figure.lines.flatMap((l) => [l.a, l.b])];
      const minX = Math.min(...pts.map((p) => p[0])),
        maxX = Math.max(...pts.map((p) => p[0])),
        minY = Math.min(...pts.map((p) => p[1])),
        maxY = Math.max(...pts.map((p) => p[1]));
      const unit = Math.min(260 / (maxX - minX), 200 / (maxY - minY));
      const s = (u: readonly [number, number]) => ({
        x: 160 + (u[0] - (minX + maxX) / 2) * unit,
        y: 125 - (u[1] - (minY + maxY) / 2) * unit,
      });
      // Each letter goes past whichever end of its line keeps it farthest
      // from letters already placed.
      const spots: P[] = [];
      for (const l of figure.lines) {
        const a = s(l.a),
          b = s(l.b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ends = [
          {
            x: b.x + ((b.x - a.x) / len) * 13,
            y: b.y + ((b.y - a.y) / len) * 13,
          },
          {
            x: a.x - ((b.x - a.x) / len) * 13,
            y: a.y - ((b.y - a.y) / len) * 13,
          },
        ];
        const room = (p: P) =>
          Math.min(
            Infinity,
            ...spots.map((q) => Math.hypot(p.x - q.x, p.y - q.y)),
          );
        spots.push(room(ends[0]!) >= room(ends[1]!) ? ends[0]! : ends[1]!);
      }
      return (
        <svg
          className="figure angle-figure"
          data-kind={figure.kind}
          viewBox="0 0 320 250"
          role="img"
          aria-label={`A ${figure.shape.length}-sided shape crossed by dashed lines ${figure.lines.map((l) => l.label).join(", ")}.`}
        >
          <path
            d={`M${figure.shape.map((p) => `${f2(s(p).x)} ${f2(s(p).y)}`).join(" L")} Z`}
            fill="var(--color-figure-accent-fill)"
            stroke={ink}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {figure.lines.map((l) => {
            const a = s(l.a),
              b = s(l.b);
            const at = spots[figure.lines.indexOf(l)]!;
            return (
              <g key={l.label}>
                <path
                  d={`M${f2(a.x)} ${f2(a.y)} L${f2(b.x)} ${f2(b.y)}`}
                  stroke={warm}
                  strokeWidth={2.5}
                  strokeDasharray="8 6"
                />
                <text
                  x={at.x}
                  y={at.y + 7}
                  textAnchor="middle"
                  style={{ fontSize: 19, fontWeight: 700, fill: warm, ...halo }}
                >
                  {l.label}
                </text>
              </g>
            );
          })}
        </svg>
      );
    }
  }
}
