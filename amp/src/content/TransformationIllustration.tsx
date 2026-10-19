import React from "react";
import type { CoordinateGeometryFigure, PlaneMotion } from "../math/contracts";
import { applyMotion } from "../math/plane-motion";
import {
  CoordinateGeometry,
  SimilarTriangles,
  coordinateLayout,
} from "../web/TransformationFigure";

export type TransformationIllustrationKind =
  | "coordinate-side-lengths"
  | "distance-triangle"
  | "rigid-motions-panels"
  | "dilation-rays"
  | "similar-triangles-marked"
  | "scale-drawing-plan";

const ink = "var(--color-figure-ink, #174a43)",
  accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  warm = "var(--color-figure-warm, #9c4420)",
  warmFill = "var(--color-figure-warm-fill, #f2d5c3)",
  paper = "var(--color-figure-paper, #fffdf7)";
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
const halo = {
  paintOrder: "stroke" as const,
  stroke: paper,
  strokeWidth: 4,
  strokeLinejoin: "round" as const,
  fill: ink,
};
const signed = (v: number) => (v < 0 ? `−${-v}` : String(v));
const pt = (p: { x: number; y: number }) => `(${signed(p.x)}, ${signed(p.y)})`;
type Point = { x: number; y: number };
const label = (letters: string, pts: Point[], primed = false) =>
  pts.map((p, i) => ({ ...p, label: `${letters[i]}${primed ? "′" : ""}` }));
function figureOf(
  given: Point[],
  image?: Point[],
  extra: Partial<CoordinateGeometryFigure> = {},
): CoordinateGeometryFigure {
  const all = [...given, ...(image ?? []), { x: 0, y: 0 }];
  return {
    kind: "coordinate-geometry",
    xMin: Math.min(...all.map((p) => p.x)) - 1,
    xMax: Math.max(...all.map((p) => p.x)) + 1,
    yMin: Math.min(...all.map((p) => p.y)) - 1,
    yMax: Math.max(...all.map((p) => p.y)) + 1,
    shapes: [
      { role: "given", closed: true, vertices: label("ABC", given) },
      ...(image
        ? [
            {
              role: "image" as const,
              closed: true,
              vertices: label("ABC", image, true),
            },
          ]
        : []),
    ],
    ...extra,
  };
}

/** Fixed teaching models; data attributes let an independent reviewer recheck them. */
export function TransformationIllustration({
  kind,
}: {
  kind: TransformationIllustrationKind;
}) {
  if (kind === "coordinate-side-lengths") return <SideLengths />;
  if (kind === "distance-triangle") return <DistanceTriangle />;
  if (kind === "rigid-motions-panels") return <RigidPanels />;
  if (kind === "dilation-rays") return <DilationRays />;
  if (kind === "similar-triangles-marked") return <SimilarMarked />;
  return <ScalePlan />;
}

/** A dimension line with a label, in pixel coordinates. */
function Measure({
  from,
  to,
  text,
  offset,
  vertical,
}: {
  from: Point;
  to: Point;
  text: string;
  offset: number;
  vertical: boolean;
}) {
  const ox = vertical ? offset : 0,
    oy = vertical ? 0 : offset;
  const tick = vertical
    ? (p: Point) => `M${p.x + ox - 4} ${p.y} h8`
    : (p: Point) => `M${p.x} ${p.y + oy - 4} v8`;
  return (
    <g data-measure={text}>
      <path
        d={`M${from.x + ox} ${from.y + oy} L${to.x + ox} ${to.y + oy} ${tick(from)} ${tick(to)}`}
        stroke={ink}
        strokeWidth="1.3"
        fill="none"
      />
      <text
        x={(from.x + to.x) / 2 + ox + (vertical ? 12 * Math.sign(offset) : 0)}
        y={
          (from.y + to.y) / 2 +
          oy +
          (vertical ? 5 : 15 * Math.sign(offset) + (offset < 0 ? 4 : 0))
        }
        textAnchor={vertical ? (offset > 0 ? "start" : "end") : "middle"}
        style={{ ...halo, fontSize: 15, fontWeight: 700 }}
      >
        {text}
      </text>
    </g>
  );
}

function SideLengths() {
  const pts = [
    { x: -4, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: -2 },
    { x: -4, y: -2 },
  ];
  const f: CoordinateGeometryFigure = {
    kind: "coordinate-geometry",
    xMin: -5,
    xMax: 7,
    yMin: -3,
    yMax: 5,
    shapes: [{ role: "given", closed: true, vertices: label("ABCD", pts) }],
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <CoordinateGeometry
        figure={f}
        className="geometry-illustration"
        style={svgStyle}
        description="Rectangle ABCD with A at (−4, 3), B at (5, 3), C at (5, −2) and D at (−4, −2). Side AB crosses the y-axis: 4 units to its left and 5 units to its right, 9 in all. Side BC crosses the x-axis: 3 units above and 2 below, 5 in all."
      >
        {({ x, y }) => (
          <g data-lesson-illustration="coordinate-side-lengths">
            <Measure
              from={{ x: x(-4), y: y(3) }}
              to={{ x: x(0), y: y(3) }}
              text="4"
              offset={-22}
              vertical={false}
            />
            <Measure
              from={{ x: x(0), y: y(3) }}
              to={{ x: x(5), y: y(3) }}
              text="5"
              offset={-22}
              vertical={false}
            />
            <Measure
              from={{ x: x(5), y: y(3) }}
              to={{ x: x(5), y: y(0) }}
              text="3"
              offset={20}
              vertical
            />
            <Measure
              from={{ x: x(5), y: y(0) }}
              to={{ x: x(5), y: y(-2) }}
              text="2"
              offset={20}
              vertical
            />
          </g>
        )}
      </CoordinateGeometry>
      <figcaption style={captionStyle}>
        AB runs from x = −4 to x = 5: 4 units to the y-axis and 5 more beyond
        it, so AB = 4 + 5 = 9. BC runs from y = 3 to y = −2, so BC = 3 + 2 = 5.
      </figcaption>
    </figure>
  );
}

function DistanceTriangle() {
  const a = { x: -3, y: -1 },
    b = { x: 5, y: 5 },
    corner = { x: 5, y: -1 };
  const f: CoordinateGeometryFigure = {
    kind: "coordinate-geometry",
    xMin: -4,
    xMax: 6,
    yMin: -2,
    yMax: 6,
    shapes: [
      {
        role: "given",
        closed: false,
        vertices: [
          { ...a, label: "A" },
          { ...b, label: "B" },
        ],
      },
    ],
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <CoordinateGeometry
        figure={f}
        className="geometry-illustration"
        style={svgStyle}
        description="Segment AB from A at (−3, −1) to B at (5, 5) is the hypotenuse of a right triangle. Its horizontal leg runs from (−3, −1) to (5, −1), 8 units, and its vertical leg from (5, −1) to (5, 5), 6 units. The hypotenuse is 10 units."
      >
        {({ x, y, unit }) => {
          const mid = {
            x: x(a.x) + (x(b.x) - x(a.x)) * 0.7,
            y: y(a.y) + (y(b.y) - y(a.y)) * 0.7,
          };
          return (
            <g data-lesson-illustration="distance-triangle">
              <path
                data-leg="8"
                data-from={pt(a)}
                data-to={pt(corner)}
                d={`M${x(a.x)} ${y(a.y)} H${x(corner.x)}`}
                stroke={warm}
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
              <path
                data-leg="6"
                data-from={pt(corner)}
                data-to={pt(b)}
                d={`M${x(corner.x)} ${y(corner.y)} V${y(b.y)}`}
                stroke={warm}
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
              <path
                d={`M${x(corner.x) - unit * 0.45} ${y(corner.y)} v${-unit * 0.45} h${unit * 0.45}`}
                fill="none"
                stroke={ink}
                strokeWidth="1.3"
              />
              <text
                x={(x(a.x) + x(corner.x)) / 2}
                y={y(corner.y) + 18}
                textAnchor="middle"
                style={{ ...halo, fontSize: 15, fontWeight: 700 }}
              >
                8
              </text>
              <text
                x={x(corner.x) + 10}
                y={(y(corner.y) + y(b.y)) / 2 + 5}
                style={{ ...halo, fontSize: 15, fontWeight: 700 }}
              >
                6
              </text>
              <text
                data-hypotenuse="10"
                x={mid.x - 14}
                y={mid.y - 10}
                textAnchor="end"
                style={{ ...halo, fontSize: 15, fontWeight: 700 }}
              >
                10
              </text>
            </g>
          );
        }}
      </CoordinateGeometry>
      <figcaption style={captionStyle}>
        The legs are the change in x, 5 − (−3) = 8, and the change in y, 5 −
        (−1) = 6. The hypotenuse is √(8² + 6²) = √100 = 10.
      </figcaption>
    </figure>
  );
}

const panelTriangle = [
  { x: 1, y: 1 },
  { x: 4, y: 1 },
  { x: 1, y: 3 },
];
const panels: { motion: PlaneMotion; title: string; rule: string }[] = [
  {
    motion: { kind: "translate", dx: -6, dy: 2 },
    title: "Translation 6 left, 2 up",
    rule: "(x, y) → (x − 6, y + 2)",
  },
  {
    motion: { kind: "reflect", axis: "x" },
    title: "Reflection over the x-axis",
    rule: "(x, y) → (x, −y)",
  },
  {
    motion: { kind: "rotate", degrees: 90 },
    title: "Rotation 90° counterclockwise",
    rule: "(x, y) → (−y, x)",
  },
];
function RigidPanels() {
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="rigid-motions-panels"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
        }}
      >
        {panels.map((panel) => {
          const image = panelTriangle.map((p) => applyMotion(panel.motion, p));
          const f = figureOf(panelTriangle, image, {
            xMin: -6,
            xMax: 5,
            yMin: -4,
            yMax: 6,
          });
          return (
            <div
              key={panel.title}
              data-motion={JSON.stringify(panel.motion)}
              data-rule={panel.rule}
              style={{ breakInside: "avoid" }}
            >
              <CoordinateGeometry
                figure={f}
                className="geometry-illustration"
                style={svgStyle}
              />
              <p style={{ margin: "4px 0 0", textAlign: "center" }}>
                <strong>{panel.title}</strong>
                <br />
                {panel.rule}
              </p>
            </div>
          );
        })}
      </div>
      <figcaption style={captionStyle}>
        Triangle ABC, with A(1, 1), B(4, 1) and C(1, 3), and its dashed image
        A′B′C′ under each motion. Every image is the same size and shape.
      </figcaption>
    </figure>
  );
}

function DilationRays() {
  const given = [
    { x: 2, y: 1 },
    { x: 4, y: 1 },
    { x: 2, y: 3 },
  ];
  const image = given.map((p) =>
    applyMotion({ kind: "dilate", numerator: 2, denominator: 1 }, p),
  );
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="dilation-rays"
      data-scale="2"
    >
      <CoordinateGeometry
        figure={figureOf(given, image, { rays: true })}
        className="geometry-illustration"
        style={svgStyle}
      />
      <figcaption style={captionStyle}>
        A dilation with center at the origin and scale factor 2. Each image
        vertex lies on the ray from the origin through its vertex, twice as far
        away: A(2, 1) → A′(4, 2), B(4, 1) → B′(8, 2), C(2, 3) → C′(4, 6).
      </figcaption>
    </figure>
  );
}

function SimilarMarked() {
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration="similar-triangles-marked"
    >
      <SimilarTriangles
        className="geometry-illustration"
        style={svgStyle}
        figure={{
          kind: "similar-triangles",
          unit: "cm",
          triangles: [
            { vertices: ["A", "B", "C"], sides: [4, 6, 5] },
            { vertices: ["D", "E", "F"], sides: [6, 9, 7.5] },
          ],
        }}
      />
      <figcaption style={captionStyle}>
        Triangle ABC ∼ triangle DEF with scale factor 3/2: DE = 4 × 3/2 = 6, EF
        = 6 × 3/2 = 9 and FD = 5 × 3/2 = 7.5. Matching numbers of arcs mark
        equal angles.
      </figcaption>
    </figure>
  );
}

function ScalePlan() {
  const cell = 26,
    plan = { w: 4, h: 3 },
    scale = 2;
  const small = cell / scale;
  const left = 24,
    top = 40,
    right = 196;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="scale-drawing-plan"
        data-plan={`${plan.w}x${plan.h}`}
        data-scale={scale}
        data-actual={`${plan.w * scale}x${plan.h * scale}`}
        viewBox="0 0 400 230"
        role="img"
        aria-label="Left: a floor plan 4 cm by 3 cm, made of 12 one-centimeter squares, with the scale 1 cm represents 2 m. Right: the actual room, 8 m by 6 m, made of 48 one-meter squares. One plan square, shaded, matches a block of 2 by 2, or 4, square meters."
        style={svgStyle}
      >
        <text
          x={left}
          y="24"
          style={{ ...halo, fontSize: 16, fontWeight: 700 }}
        >
          Plan
        </text>
        <text
          x={right}
          y="24"
          style={{ ...halo, fontSize: 16, fontWeight: 700 }}
        >
          Actual room
        </text>
        {Array.from({ length: plan.w * plan.h }, (_, i) => (
          <rect
            key={i}
            data-plan-square={i}
            x={left + (i % plan.w) * cell}
            y={top + Math.floor(i / plan.w) * cell}
            width={cell}
            height={cell}
            fill={i === 0 ? accent : accentFill}
            fillOpacity={i === 0 ? 0.55 : 0.6}
            stroke={accent}
            strokeWidth="1.2"
          />
        ))}
        {Array.from({ length: plan.w * scale * plan.h * scale }, (_, i) => {
          const col = i % (plan.w * scale),
            row = Math.floor(i / (plan.w * scale));
          const first = col < scale && row < scale;
          return (
            <rect
              key={i}
              data-actual-square={i}
              x={right + col * small * 1.6}
              y={top + row * small * 1.6}
              width={small * 1.6}
              height={small * 1.6}
              fill={first ? warm : warmFill}
              fillOpacity={first ? 0.55 : 0.6}
              stroke={warm}
              strokeWidth="1"
            />
          );
        })}
        <text
          x={left + (plan.w * cell) / 2}
          y={top + plan.h * cell + 20}
          textAnchor="middle"
          style={{ ...halo, fontSize: 14 }}
        >
          4 cm
        </text>
        <text
          x={left + plan.w * cell + 8}
          y={top + (plan.h * cell) / 2 + 5}
          style={{ ...halo, fontSize: 14 }}
        >
          3 cm
        </text>
        <text
          x={right + (plan.w * scale * small * 1.6) / 2}
          y={top + plan.h * scale * small * 1.6 + 20}
          textAnchor="middle"
          style={{ ...halo, fontSize: 14 }}
        >
          8 m
        </text>
        <text
          x={right + plan.w * scale * small * 1.6 + 6}
          y={top + (plan.h * scale * small * 1.6) / 2 + 5}
          style={{ ...halo, fontSize: 14 }}
        >
          6 m
        </text>
        <g data-scale-bar="1 cm : 2 m">
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={left + i * cell}
              y="190"
              width={cell}
              height="8"
              fill={i % 2 ? paper : ink}
              stroke={ink}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <text
              key={i}
              x={left + i * cell}
              y="216"
              textAnchor="middle"
              style={{ ...halo, fontSize: 12 }}
            >
              {i * scale}
            </text>
          ))}
          <text
            x={left + 3 * cell + 14}
            y="216"
            style={{ ...halo, fontSize: 12 }}
          >
            m (1 cm each)
          </text>
        </g>
      </svg>
      <figcaption style={captionStyle}>
        Scale 1 cm represents 2 m. The plan has 4 × 3 = 12 squares of 1 cm².
        Each becomes a 2 m by 2 m block of 4 m², so the room has 12 × 4 = 48 m².
      </figcaption>
    </figure>
  );
}
