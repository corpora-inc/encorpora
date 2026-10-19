import React from "react";
import {
  AngleTriangleFigure,
  Text,
  geometryInk,
} from "../web/AngleTriangleFigure";
import {
  angleLabel,
  arcPath,
  f,
  solidLayout,
  textWidth,
  triangleLayout,
  parallelLayout,
  type Point,
} from "../web/geometry-layout";

export type AngleTriangleIllustrationKind =
  | "angle-pairs"
  | "parallel-angle-pairs"
  | "triangle-sum-line"
  | "exterior-angle"
  | "side-strips"
  | "solid-slices";

const { ink, given, unknown, givenFill } = geometryInk;
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const panels = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "center",
};
const panel = { flex: "1 1 180px", maxWidth: 240, margin: 0 };
const caption = { textAlign: "center" as const, marginTop: 4, lineHeight: 1.5 };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;

/** Fixed teaching figures, drawn exactly at the stated measures. */
export function AngleTriangleIllustration({
  kind,
}: {
  kind: AngleTriangleIllustrationKind;
}) {
  if (kind === "angle-pairs") return <AnglePairs />;
  if (kind === "parallel-angle-pairs") return <ParallelPairs />;
  if (kind === "triangle-sum-line") return <TriangleSumLine />;
  if (kind === "exterior-angle") return <ExteriorSplit />;
  if (kind === "side-strips") return <SideStrips />;
  return <SolidSlices />;
}

function AnglePairs() {
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="angle-pairs"
    >
      <div style={panels}>
        <div style={panel}>
          <AngleTriangleFigure
            figure={{
              kind: "angle-rays",
              rays: [0, 62, 180],
              vertex: "O",
              points: ["B", "C", "A"],
              marks: [
                { from: 0, to: 1, label: "62°" },
                { from: 1, to: 2, label: "118°" },
              ],
            }}
          />
          <p style={caption}>Linear pair: 62° + 118° = 180°</p>
        </div>
        <div style={panel}>
          <AngleTriangleFigure
            figure={{
              kind: "angle-rays",
              rays: [0, 35, 90],
              vertex: "O",
              points: ["B", "C", "A"],
              marks: [
                { from: 0, to: 2, label: "90°", right: true },
                { from: 0, to: 1, label: "35°" },
                { from: 1, to: 2, label: "55°" },
              ],
            }}
          />
          <p style={caption}>Complementary: 35° + 55° = 90°</p>
        </div>
        <div style={panel}>
          <AngleTriangleFigure
            figure={{
              kind: "angle-rays",
              rays: [0, 50, 180, 230],
              vertex: "O",
              points: ["B", "C", "A", "D"],
              marks: [
                { from: 0, to: 1, label: "50°" },
                { from: 1, to: 2, label: "130°" },
                { from: 2, to: 3, label: "50°" },
                { from: 3, to: 0, label: "130°" },
              ],
            }}
          />
          <p style={caption}>Vertical angles are equal: 50° and 50°</p>
        </div>
      </div>
    </figure>
  );
}

function ParallelPairs() {
  const theta = 65;
  // Every angle at both crossings, so the two repeating measures are visible.
  const figure = {
    kind: "parallel-transversal" as const,
    angle: theta,
    lines: ["m", "n", "t"] as [string, string, string],
    marks: [0, 1].flatMap((crossing) =>
      [0, 1, 2, 3].map((position) => ({
        crossing: crossing as 0 | 1,
        position,
        label: position % 2 ? `${180 - theta}°` : `${theta}°`,
      })),
    ),
  };
  const L = parallelLayout(figure);
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="parallel-angle-pairs"
    >
      <svg
        viewBox={L.viewBox}
        role="img"
        aria-label="Parallel lines m and n crossed by transversal t. At each crossing, the angles above right and below left measure 65°, and the angles above left and below right measure 115°. The four angles at one crossing match the four at the other."
        style={svgStyle}
      >
        <title>Matching positions, equal angles</title>
        {L.marks.map((k, i) => (
          <path
            key={i}
            d={k.path}
            fill="none"
            stroke={k.position % 2 ? unknown : given}
            strokeWidth={2.5}
          />
        ))}
        {L.lines.map((l, i) => (
          <line
            key={i}
            x1={f(l.a.x)}
            y1={f(l.a.y)}
            x2={f(l.b.x)}
            y2={f(l.b.y)}
            stroke={ink}
            strokeWidth={2.5}
          />
        ))}
        {L.arrows.map((a, i) => (
          <path
            key={`a${i}`}
            d={`M${f(a.x - 6)} ${f(a.y - 6)} l6 6 l-6 6 M${f(a.x + 2)} ${f(a.y - 6)} l6 6 l-6 6`}
            fill="none"
            stroke={ink}
            strokeWidth={2}
          />
        ))}
        <line
          x1={f(L.transversal[0]!.x)}
          y1={f(L.transversal[0]!.y)}
          x2={f(L.transversal[1]!.x)}
          y2={f(L.transversal[1]!.y)}
          stroke={ink}
          strokeWidth={2.5}
        />
        {L.names.map((n, i) => (
          <Text key={`n${i}`} label={n} weight={700} />
        ))}
        {L.marks.map((k, i) => (
          <Text
            key={`l${i}`}
            label={k.label}
            color={k.position % 2 ? unknown : given}
            weight={700}
          />
        ))}
      </svg>
      <figcaption style={caption}>
        Two measures at each crossing: 65° and its supplement, 115°.
        Corresponding angles (same position) and alternate angles are equal.
      </figcaption>
    </figure>
  );
}

const heading = (p: Point, q: Point) =>
  (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;
function TrianglePieces({
  angles,
  exterior,
  title,
  description,
}: {
  angles: [number, number, number];
  exterior: boolean;
  title: string;
  description: string;
}) {
  const [a, b, c] = angles;
  const L = triangleLayout({
    kind: "triangle-angles",
    angles,
    vertices: ["A", "B", "C"],
    labels: [`${a}°`, exterior ? null : `${b}°`, `${c}°`],
    ...(exterior ? { exterior: { point: "D", label: null } } : {}),
  });
  const [A, B, C] = L.points as [Point, Point, Point];
  const pieces: {
    at: Point;
    d1: number;
    s: number;
    text: string;
    color: string;
  }[] = exterior
    ? [
        // Through B, a ray parallel to AC splits the exterior angle.
        { at: B, d1: 0, s: a, text: `${a}°`, color: given },
        { at: B, d1: a, s: c, text: `${c}°`, color: unknown },
      ]
    : [
        { at: C, d1: 180, s: a, text: `${a}°`, color: given },
        { at: C, d1: heading(C, B), s: b, text: `${b}°`, color: unknown },
      ];
  const reach = 120;
  const guide = exterior
    ? [
        B,
        {
          x: B.x + Math.cos((a * Math.PI) / 180) * reach,
          y: B.y - Math.sin((a * Math.PI) / 180) * reach,
        },
      ]
    : [
        { x: C.x - reach, y: C.y },
        { x: C.x + reach, y: C.y },
      ];
  const D = L.exterior?.end;
  const labels = pieces.map((p) => angleLabel(p.at, p.d1, p.s, p.text, 44));
  const xs = [A, B, C, ...(D ? [D] : []), ...guide, ...labels, ...L.names].map(
      (p) => p.x,
    ),
    ys = [A, B, C, ...guide, ...labels, ...L.names].map((p) => p.y);
  const pad = 30;
  const viewBox = `${f(Math.min(...xs) - pad)} ${f(Math.min(...ys) - pad)} ${f(Math.max(...xs) - Math.min(...xs) + 2 * pad)} ${f(Math.max(...ys) - Math.min(...ys) + 2 * pad)}`;
  return (
    <svg viewBox={viewBox} role="img" aria-label={description} style={svgStyle}>
      <title>{title}</title>
      <polygon
        points={[A, B, C].map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}
        fill={givenFill}
        fillOpacity={0.45}
        stroke={ink}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {D && (
        <line
          x1={f(B.x)}
          y1={f(B.y)}
          x2={f(D.x)}
          y2={f(D.y)}
          stroke={ink}
          strokeWidth={2.5}
        />
      )}
      <line
        x1={f(guide[0]!.x)}
        y1={f(guide[0]!.y)}
        x2={f(guide[1]!.x)}
        y2={f(guide[1]!.y)}
        stroke={ink}
        strokeWidth={1.75}
        strokeDasharray="6 5"
      />
      {L.corners.map((k, i) =>
        k.label ? (
          <g key={i}>
            <path
              d={k.path}
              fill="none"
              stroke={i === 1 ? ink : i === 0 ? given : unknown}
              strokeWidth={2.5}
            />
            <Text
              label={k.label}
              color={i === 0 ? given : i === 2 ? unknown : ink}
              weight={700}
            />
          </g>
        ) : null,
      )}
      {pieces.map((p, i) => (
        <g key={`p${i}`}>
          <path
            d={arcPath(p.at, 30, p.d1, p.s)}
            fill="none"
            stroke={p.color}
            strokeWidth={2.5}
          />
          <Text label={labels[i]!} color={p.color} weight={700} />
        </g>
      ))}
      {L.names.map((n, i) => (
        <Text key={`n${i}`} label={n} />
      ))}
      {L.exterior && <Text label={L.exterior.name} />}
    </svg>
  );
}
function TriangleSumLine() {
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="triangle-sum-line"
    >
      <TrianglePieces
        angles={[50, 60, 70]}
        exterior={false}
        title="Three angles fill a straight line"
        description="Triangle ABC with angles A = 50°, B = 60° and C = 70°. A dashed line through C runs parallel to AB. At C, an angle of 50° on the left, the triangle's 70° angle and an angle of 60° on the right fill the straight line: 50° + 70° + 60° = 180°."
      />
      <figcaption style={caption}>
        The copies of ∠A and ∠B sit beside ∠C along the line parallel to AB: 50°
        + 70° + 60° = 180°.
      </figcaption>
    </figure>
  );
}
function ExteriorSplit() {
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="exterior-angle"
    >
      <TrianglePieces
        angles={[50, 65, 65]}
        exterior
        title="The exterior angle holds both remote angles"
        description="Triangle ABC with ∠A = 50° and ∠C = 65°. Side AB is extended past B to D. A dashed ray from B parallel to AC splits the exterior angle CBD into 50°, next to BD, and 65°, next to BC. So ∠CBD = 50° + 65° = 115°."
      />
      <figcaption style={caption}>
        A ray from B parallel to AC splits ∠CBD into copies of ∠A and ∠C: ∠CBD =
        50° + 65° = 115°.
      </figcaption>
    </figure>
  );
}

function SideStrips() {
  const unit = 26,
    x0 = 30;
  const rows = [
    { a: 3, b: 4, verdict: "3 + 4 < 8: the strips cannot meet." },
    { a: 4, b: 4, verdict: "4 + 4 = 8: they meet only lying flat." },
    { a: 5, b: 6, verdict: "5 + 6 > 8: they rise and meet." },
  ];
  const c = 8;
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="side-strips"
    >
      <svg
        viewBox="0 0 280 420"
        role="img"
        aria-label="Three attempts on a base of 8 units. Strips of 3 and 4 laid from the ends leave a gap of 1. Strips of 4 and 4 meet only flat on the base. Strips of 5 and 6 rise and meet above the base, forming a triangle."
        style={{ ...svgStyle, maxWidth: 320 }}
      >
        <title>Two shorter sides must add to more than the longest</title>
        {rows.map((row, i) => {
          const y = 70 + i * 130;
          const L = x0,
            R = x0 + c * unit;
          // Exact apex for the triangle: intersection of circles of radii a and b.
          const xa = (row.a * row.a - row.b * row.b + c * c) / (2 * c);
          const ha = Math.sqrt(Math.max(0, row.a * row.a - xa * xa));
          const triangle = row.a + row.b > c;
          return (
            <g key={i}>
              <line
                x1={L}
                y1={y}
                x2={R}
                y2={y}
                stroke={ink}
                strokeWidth={5}
                strokeLinecap="round"
              />
              {triangle ? (
                <>
                  <line
                    x1={L}
                    y1={y}
                    x2={f(L + xa * unit)}
                    y2={f(y - ha * unit)}
                    stroke={given}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={R}
                    y1={y}
                    x2={f(L + xa * unit)}
                    y2={f(y - ha * unit)}
                    stroke={unknown}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <line
                    x1={L}
                    y1={y - 10}
                    x2={L + row.a * unit}
                    y2={y - 10}
                    stroke={given}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={R}
                    y1={y - 18}
                    x2={R - row.b * unit}
                    y2={y - 18}
                    stroke={unknown}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                </>
              )}
              <Text
                label={{
                  x: (L + R) / 2,
                  y: y + 22,
                  text: `${row.a}, ${row.b} and ${c}`,
                  width: textWidth(`${row.a}, ${row.b} and ${c}`),
                }}
              />
              <Text
                label={{
                  x: (L + R) / 2,
                  y: y + 44,
                  text: row.verdict,
                  width: 200,
                  size: 14,
                }}
                weight={500}
              />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function SolidSlices() {
  const cases = [
    {
      solid: "prism" as const,
      plane: "parallel-base" as const,
      caption: "Parallel to the base: a copy of the base",
    },
    {
      solid: "pyramid" as const,
      plane: "through-apex" as const,
      caption: "Up through the apex: a triangle",
    },
    {
      solid: "pyramid" as const,
      plane: "off-apex" as const,
      caption: "Up, missing the apex: a trapezoid",
    },
  ];
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="solid-slices"
    >
      <div style={panels}>
        {cases.map((k) => {
          const L = solidLayout({
            kind: "solid-section",
            solid: k.solid,
            length: 8,
            width: 5,
            height: 6,
            plane: k.plane,
          });
          const poly = (ps: Point[]) =>
            ps.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
          return (
            <div key={k.plane} style={panel}>
              <svg
                viewBox={L.viewBox}
                role="img"
                aria-label={`${k.solid === "prism" ? "A right rectangular prism" : "A right rectangular pyramid"} cut by a plane. ${k.caption}.`}
                style={svgStyle}
              >
                {L.edges
                  .filter((e) => e.hidden)
                  .map((e, i) => (
                    <line
                      key={`h${i}`}
                      x1={f(e.a.x)}
                      y1={f(e.a.y)}
                      x2={f(e.b.x)}
                      y2={f(e.b.y)}
                      stroke={ink}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                    />
                  ))}
                <polygon
                  points={poly(L.section)}
                  fill={geometryInk.planeFill}
                  stroke={geometryInk.plane}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
                {L.edges
                  .filter((e) => !e.hidden)
                  .map((e, i) => (
                    <line
                      key={`v${i}`}
                      x1={f(e.a.x)}
                      y1={f(e.a.y)}
                      x2={f(e.b.x)}
                      y2={f(e.b.y)}
                      stroke={ink}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  ))}
              </svg>
              <p style={caption}>{k.caption}</p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
