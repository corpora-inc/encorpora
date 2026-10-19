import React from "react";
import { Protractor } from "../web/AngleFigure";

const kinds = [
  "degree-turns",
  "protractor-scales",
  "line-ray-segment",
  "angle-kinds",
  "symmetry-folds",
] as const;
export type AngleIllustrationKind = (typeof kinds)[number];
export const isAngleIllustration = (
  kind: string,
): kind is AngleIllustrationKind => (kinds as readonly string[]).includes(kind);

const ink = "var(--color-figure-ink)",
  warm = "var(--color-figure-warm)",
  fill = "var(--color-figure-accent-fill)",
  strong = "var(--color-figure-accent-fill-strong)";
const rad = Math.PI / 180;
type P = { x: number; y: number };
const polar = (c: P, r: number, d: number): P => ({
  x: c.x + r * Math.cos(d * rad),
  y: c.y - r * Math.sin(d * rad),
});
const f2 = (n: number) => n.toFixed(2);
const name = { fontSize: 16, fill: ink, textAnchor: "middle" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
/** A filled wedge from direction a counterclockwise to b. */
function wedge(c: P, r: number, a: number, b: number) {
  const s = polar(c, r, a),
    e = polar(c, r, b);
  return `M${c.x} ${c.y} L${f2(s.x)} ${f2(s.y)} A${r} ${r} 0 ${b - a > 180 ? 1 : 0} 0 ${f2(e.x)} ${f2(e.y)} Z`;
}
function Ray({ c, d, r }: { c: P; d: number; r: number }) {
  const e = polar(c, r, d);
  return (
    <path
      d={`M${c.x} ${c.y} L${f2(e.x)} ${f2(e.y)}`}
      stroke={ink}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  );
}
function Arrowhead({ at, d }: { at: P; d: number }) {
  const back = (s: number) => polar(at, 12, d + 180 + s * 28);
  const l = back(1),
    r = back(-1);
  return (
    <path
      d={`M${f2(at.x)} ${f2(at.y)} L${f2(l.x)} ${f2(l.y)} L${f2(r.x)} ${f2(r.y)} Z`}
      fill={ink}
    />
  );
}

/** Exact models: every angle is drawn at its true measure. */
export function AngleIllustration({ kind }: { kind: AngleIllustrationKind }) {
  const caption = {
    "degree-turns":
      "A full turn is 360°. A quarter turn is 90° and a half turn is 180°; twelve equal angles are 30° each.",
    "protractor-scales":
      "Ray BA is at 0 on the left, so read the outer scale: angle ABC is 50°. The inner scale's 130 counts from the right.",
    "line-ray-segment":
      "A line has two arrows, a ray has one endpoint and one arrow, and a segment has two endpoints.",
    "angle-kinds":
      "Acute, right, obtuse and straight angles; then parallel lines, which never meet, and perpendicular lines, which meet at a right angle.",
    "symmetry-folds":
      "A rectangle folds onto itself along its 2 lines of symmetry. Folded on a diagonal, its corners do not match.",
  }[kind];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      {kind === "degree-turns" ? (
        <Turns />
      ) : kind === "protractor-scales" ? (
        <Scales />
      ) : kind === "line-ray-segment" ? (
        <Linear />
      ) : kind === "angle-kinds" ? (
        <Kinds />
      ) : (
        <Folds />
      )}
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

function Turns() {
  const items: [string, number][] = [
    ["90°", 90],
    ["180°", 180],
    ["30°", 30],
  ];
  return (
    <svg
      viewBox="0 0 420 170"
      role="img"
      aria-label="Three circles: a quarter turn of 90 degrees, a half turn of 180 degrees, and one of twelve equal angles, 30 degrees"
      data-lesson-illustration="degree-turns"
      style={svgStyle}
    >
      {items.map(([label, m], i) => {
        const c = { x: 70 + i * 140, y: 75 };
        return (
          <g key={label}>
            <circle
              cx={c.x}
              cy={c.y}
              r={55}
              fill="none"
              stroke={ink}
              strokeWidth={2}
            />
            {i === 2 &&
              Array.from({ length: 12 }, (_, k) => (
                <Ray key={k} c={c} d={k * 30} r={55} />
              ))}
            <path
              d={wedge(c, 55, 0, m)}
              fill={strong}
              stroke={ink}
              strokeWidth={2.5}
            />
            <text x={c.x} y={158} style={{ ...name, fontWeight: 700 }}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Scales() {
  const c = { x: 210, y: 190 };
  const ray = polar(c, 156, 130),
    base = polar(c, 156, 180);
  const tick = polar(c, 150 - 6, 130),
    value = polar(c, 150 - 98, 116);
  return (
    <svg
      viewBox="0 0 420 222"
      role="img"
      aria-label="A protractor with ray BA on 0 at the left and ray BC crossing the outer scale at 50"
      data-lesson-illustration="protractor-scales"
      style={svgStyle}
    >
      <Protractor c={c} radius={150}>
        <path
          d={`M${c.x} ${c.y} L${f2(base.x)} ${f2(base.y)}`}
          stroke={warm}
          strokeWidth={3}
        />
        <path
          d={`M${c.x} ${c.y} L${f2(ray.x)} ${f2(ray.y)}`}
          stroke={ink}
          strokeWidth={3}
        />
      </Protractor>
      <circle
        cx={tick.x}
        cy={tick.y}
        r={9}
        fill="none"
        stroke={warm}
        strokeWidth={2.5}
      />
      <text
        x={value.x}
        y={value.y + 6}
        textAnchor="middle"
        style={{ fontSize: 18, fontWeight: 700, fill: warm }}
      >
        50°
      </text>
      <g style={{ fontSize: 18, fontWeight: 700, fill: ink }}>
        <text x={base.x - 6} y={base.y + 6} textAnchor="end">
          A
        </text>
        <text x={c.x} y={c.y + 24} textAnchor="middle">
          B
        </text>
        <text
          x={polar(c, 172, 130).x}
          y={polar(c, 172, 130).y + 6}
          textAnchor="middle"
        >
          C
        </text>
      </g>
    </svg>
  );
}

function Linear() {
  const rows: [string, boolean, boolean][] = [
    ["line AB", true, true],
    ["ray AB", false, true],
    ["line segment AB", false, false],
  ];
  return (
    <svg
      viewBox="0 0 420 200"
      role="img"
      aria-label="Line AB with two arrows, ray AB starting at A, and line segment AB with two endpoints"
      data-lesson-illustration="line-ray-segment"
      style={svgStyle}
    >
      {rows.map(([label, left, right], i) => {
        const y = 36 + i * 62,
          a = { x: 70, y },
          b = { x: 200, y };
        return (
          <g key={label}>
            <path
              d={`M${left ? 24 : a.x} ${y} L${right ? 246 : b.x} ${y}`}
              stroke={ink}
              strokeWidth={2.5}
            />
            {left && <Arrowhead at={{ x: 20, y }} d={180} />}
            {right && <Arrowhead at={{ x: 250, y }} d={0} />}
            {[a, b].map((p, k) => (
              <g key={k}>
                <circle cx={p.x} cy={p.y} r={5} fill={ink} />
                <text x={p.x} y={p.y - 11} style={{ ...name, fontWeight: 700 }}>
                  {k === 0 ? "A" : "B"}
                </text>
              </g>
            ))}
            <text x={272} y={y + 6} style={{ ...name, textAnchor: "start" }}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Kinds() {
  const angles: [string, number, number][] = [
    ["acute", 50, 25],
    ["right", 90, 130],
    ["obtuse", 130, 255],
    ["straight", 180, 362],
  ];
  return (
    <svg
      viewBox="0 0 420 260"
      role="img"
      aria-label="An acute, a right, an obtuse and a straight angle; then a pair of parallel lines and a pair of perpendicular lines"
      data-lesson-illustration="angle-kinds"
      style={svgStyle}
    >
      {angles.map(([label, m, x]) => {
        const c = { x, y: 95 };
        return (
          <g key={label}>
            {m === 90 ? (
              <path
                d={`M${c.x + 14} ${c.y} L${c.x + 14} ${c.y - 14} L${c.x} ${c.y - 14}`}
                fill="none"
                stroke={ink}
                strokeWidth={2}
              />
            ) : (
              <path
                d={wedge(c, 20, 0, m)}
                fill={fill}
                stroke={warm}
                strokeWidth={2}
              />
            )}
            <Ray c={c} d={0} r={48} />
            <Ray c={c} d={m} r={48} />
            <text x={m === 180 ? c.x : c.x + 22} y={130} style={name}>
              {label}
            </text>
          </g>
        );
      })}
      <path
        d="M30 170 L180 190 M30 210 L180 230"
        stroke={ink}
        strokeWidth={2.5}
      />
      <text x={105} y={252} style={name}>
        parallel
      </text>
      <path
        d="M250 200 L390 200 M320 160 L320 240"
        stroke={ink}
        strokeWidth={2.5}
      />
      <path
        d="M320 200 L334 200 L334 186 L320 186"
        fill="none"
        stroke={ink}
        strokeWidth={2}
      />
      <text x={320} y={256} style={name}>
        perpendicular
      </text>
    </svg>
  );
}

function Folds() {
  const top = 60;
  const rect = (x: number) => `M${x} ${top} h150 v80 h-150 Z`;
  // The lower-right half of the second rectangle, folded across its
  // diagonal, drawn exactly by reflecting its corner.
  const a = { x: 240, y: top + 80 },
    b = { x: 390, y: top },
    p = { x: 390, y: top + 80 };
  const len = Math.hypot(b.x - a.x, b.y - a.y),
    ux = (b.x - a.x) / len,
    uy = (b.y - a.y) / len;
  const along = (p.x - a.x) * ux + (p.y - a.y) * uy;
  const q = {
    x: a.x + 2 * along * ux - (p.x - a.x),
    y: a.y + 2 * along * uy - (p.y - a.y),
  };
  return (
    <svg
      viewBox="0 0 420 200"
      role="img"
      aria-label="A rectangle with its two lines of symmetry, and a rectangle folded along a diagonal whose corners do not match"
      data-lesson-illustration="symmetry-folds"
      style={svgStyle}
    >
      <path d={rect(20)} fill={fill} stroke={ink} strokeWidth={2.5} />
      <path
        d={`M95 ${top - 12} V${top + 92} M8 ${top + 40} H182`}
        stroke={warm}
        strokeWidth={2.5}
        strokeDasharray="8 6"
      />
      <text x={95} y={188} style={name}>
        2 lines of symmetry
      </text>
      <path
        d={`M240 ${top} L${b.x} ${b.y} L${a.x} ${a.y} Z`}
        fill={fill}
        stroke={ink}
        strokeWidth={2.5}
      />
      <path
        d={`M${a.x} ${a.y} L${f2(q.x)} ${f2(q.y)} L${b.x} ${b.y} Z`}
        fill={strong}
        stroke={warm}
        strokeWidth={2}
      />
      <path
        d={`M${a.x} ${a.y} L${b.x} ${b.y}`}
        stroke={ink}
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <text x={315} y={188} style={name}>
        a diagonal is not
      </text>
    </svg>
  );
}
