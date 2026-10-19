import React from "react";
import { isoFit, isoPoint } from "../math/geometry-figures";
import { IsoBox, QuadrantGrid, quadrantLayout } from "../web/GeometryFigure";

export type VolumeCoordinateIllustrationKind =
  "volume-layers" | "prism-composite" | "ordered-pair-path";

const ink = "var(--color-figure-ink)",
  warm = "var(--color-figure-warm)",
  text = { fontSize: 19, fill: ink };

/** Exact models: every cube, edge and gridline is drawn at true proportion. */
export function VolumeCoordinateIllustration({
  kind,
}: {
  kind: VolumeCoordinateIllustrationKind;
}) {
  const caption =
    kind === "volume-layers"
      ? "A 4 by 3 by 2 prism lifted apart into its two layers. Each layer holds 4 × 3 = 12 cubes, so the prism holds 2 × 12 = 24."
      : kind === "prism-composite"
        ? "A stepped solid pulled apart into two rectangular prisms of the same 2 cm depth: 3 × 2 × 5 = 30 and 4 × 2 × 2 = 16, together 46 cubic centimeters."
        : "To reach (2, 5), go 2 across from 0, then 5 up. Going 5 across and 2 up reaches a different point, (5, 2).";
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      {kind === "volume-layers" ? (
        <Layers />
      ) : kind === "prism-composite" ? (
        <Composite />
      ) : (
        <OrderedPair />
      )}
      <figcaption style={{ fontSize: "0.875rem", marginTop: 8 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

const svgStyle = {
  width: "100%",
  maxWidth: 420,
  display: "block",
  margin: "0 auto",
} as const;

function Layers() {
  const lift = 2.4;
  const { unit, origin } = isoFit(4, 3, 2 + lift, {
    width: 360,
    height: 250,
    pad: 18,
  });
  const at = (layer: number) => (x: number, y: number, z: number) =>
    isoPoint(x, y, z + layer * (1 + lift), unit, {
      x: origin.x - 70,
      y: origin.y,
    });
  const label = (layer: number) => at(layer)(4, 0, 0.5);
  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label="Two layers of 12 unit cubes each, one lifted above the other"
      data-lesson-illustration="volume-layers"
      style={svgStyle}
    >
      {[0, 1].map((layer) => (
        <g key={layer}>
          <IsoBox size={[4, 3, 1]} grid project={at(layer)} />
          <text x={label(layer).x + 16} y={label(layer).y + 6} style={text}>
            {layer === 0 ? "4 × 3 = 12" : "12 more"}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Composite() {
  const gap = 1.4;
  const { unit, origin } = isoFit(3 + gap + 4, 2, 5, {
    width: 360,
    height: 250,
    pad: 30,
  });
  const p = (x: number, y: number, z: number) =>
    isoPoint(x, y, z, unit, origin);
  const tall = p(1.5, 0, 5),
    short = p(3 + gap + 4, 2, 0);
  return (
    <svg
      viewBox="0 0 360 250"
      role="img"
      aria-label="A 3 by 2 by 5 prism and a 4 by 2 by 2 prism, separated"
      data-lesson-illustration="prism-composite"
      style={svgStyle}
    >
      <IsoBox size={[3, 2, 5]} grid project={p} />
      <IsoBox at={[3 + gap, 0, 0]} size={[4, 2, 2]} grid project={p} />
      <text x={tall.x + 14} y={tall.y - 10} style={text}>
        3 × 2 × 5 = 30
      </text>
      <text x={short.x - 30} y={short.y + 30} textAnchor="middle" style={text}>
        4 × 2 × 2 = 16
      </text>
    </svg>
  );
}

function OrderedPair() {
  const figure = {
    kind: "quadrant-grid" as const,
    size: 6,
    points: [
      { x: 2, y: 5, label: "A" as const },
      { x: 5, y: 2, label: "B" as const },
    ],
  };
  const { x, y } = quadrantLayout(6);
  return (
    <div data-lesson-illustration="ordered-pair-path" style={svgStyle}>
      <QuadrantGrid figure={figure}>
        <path
          d={`M${x(0)} ${y(0)} H${x(2)} V${y(5)}`}
          fill="none"
          stroke={warm}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={`M${x(0)} ${y(0)} H${x(5)} V${y(2)}`}
          fill="none"
          stroke="var(--color-figure-axis)"
          strokeWidth={2.5}
          strokeDasharray="6 5"
        />
        <text x={x(1)} y={y(0) - 10} textAnchor="middle" style={text}>
          2
        </text>
        <text x={x(2) + 10} y={y(2.5)} style={text}>
          5
        </text>
      </QuadrantGrid>
    </div>
  );
}
