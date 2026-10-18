import React from "react";

type Point = readonly [number, number];
type Line = {
  equation: string;
  coefficients: readonly [number, number, number];
  ends: readonly [Point, Point];
  dashed?: boolean;
};
type Panel = {
  id: string;
  title: string;
  description: string;
  lines: readonly Line[];
  point?: Point;
  nearMiss?: Point;
};

const label = { font: "24px Arial, sans-serif", fill: "#202020" };
const x = (value: number) => 110 + 44 * value;
const y = (value: number) => 296 - 44 * value;
const ticks = [-1, 0, 1, 2, 3, 4, 5];

const intersection: Panel = {
  id: "shared-pair",
  title: "Both equations at once",
  description:
    "The solid line y = x + 1 and dashed line x + y = 5 intersect at the filled point (2, 3). The open point (1, 2) lies on the solid line only. Each tick interval is one unit.",
  lines: [
    {
      equation: "y = x + 1",
      coefficients: [-1, 1, 1],
      ends: [
        [-1, 0],
        [4, 5],
      ],
    },
    {
      equation: "x + y = 5",
      coefficients: [1, 1, 5],
      ends: [
        [0, 5],
        [5, 0],
      ],
      dashed: true,
    },
  ],
  point: [2, 3],
  nearMiss: [1, 2],
};

const counts: readonly Panel[] = [
  {
    id: "one",
    title: "One shared pair",
    description:
      "The solid line x + y = 4 and dashed line x − y = 0 intersect at the marked point (2, 2).",
    lines: [
      {
        equation: "x + y = 4",
        coefficients: [1, 1, 4],
        ends: [
          [-1, 5],
          [5, -1],
        ],
      },
      {
        equation: "x − y = 0",
        coefficients: [1, -1, 0],
        ends: [
          [-1, -1],
          [5, 5],
        ],
        dashed: true,
      },
    ],
    point: [2, 2],
  },
  {
    id: "none",
    title: "No shared pair",
    description:
      "The solid line x + y = 2 and dashed line x + y = 4 are distinct parallel lines. They never intersect, including beyond the displayed window.",
    lines: [
      {
        equation: "x + y = 2",
        coefficients: [1, 1, 2],
        ends: [
          [-1, 3],
          [3, -1],
        ],
      },
      {
        equation: "x + y = 4",
        coefficients: [1, 1, 4],
        ends: [
          [-1, 5],
          [5, -1],
        ],
        dashed: true,
      },
    ],
  },
  {
    id: "infinite",
    title: "One line, infinitely many pairs",
    description:
      "The equations x + y = 3 and −2x − 2y = −6 describe exactly the same line. Both equation labels refer to the single solid line shown.",
    lines: [
      {
        equation: "x + y = 3",
        coefficients: [1, 1, 3],
        ends: [
          [-1, 4],
          [4, -1],
        ],
      },
      {
        equation: "−2x − 2y = −6",
        coefficients: [-2, -2, -6],
        ends: [
          [-1, 4],
          [4, -1],
        ],
      },
    ],
  },
  {
    id: "axes",
    title: "Vertical and horizontal lines",
    description:
      "The solid vertical line x = 2 and dashed horizontal line y = 1 intersect at the marked point (2, 1). No slope calculation is needed.",
    lines: [
      {
        equation: "x = 2",
        coefficients: [1, 0, 2],
        ends: [
          [2, -1],
          [2, 5],
        ],
      },
      {
        equation: "y = 1",
        coefficients: [0, 1, 1],
        ends: [
          [-1, 1],
          [5, 1],
        ],
        dashed: true,
      },
    ],
    point: [2, 1],
  },
];

function CoordinatePanel({ panel }: { panel: Panel }) {
  return (
    <svg
      data-lesson-illustration={`linear-system-${panel.id}`}
      viewBox="0 0 400 450"
      data-origin="110,296"
      data-unit-scale="44"
      data-coordinate-window="-1,5,-1,5"
      role="img"
      aria-label={panel.description}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      <title>{panel.title}</title>
      <text x="200" y="28" textAnchor="middle" style={label}>
        {panel.title}
      </text>
      {ticks.map((value) => (
        <g key={value}>
          <line x1={x(value)} x2={x(value)} y1={76} y2={340} stroke="#ddd" />
          <line x1={66} x2={330} y1={y(value)} y2={y(value)} stroke="#ddd" />
        </g>
      ))}
      <g stroke="#555" strokeWidth="1.5" fill="none">
        <path data-axis="x" d="M 66 296 H 350 m -8 -5 l 8 5 -8 5" />
        <path data-axis="y" d="M 110 340 V 58 m -5 8 l 5 -8 5 8" />
      </g>
      <text x="358" y="304" style={label}>
        x
      </text>
      <text x="102" y="50" style={label}>
        y
      </text>
      {panel.lines.map((line, index) => (
        <g
          key={line.equation}
          data-equation={line.equation}
          data-coefficients={line.coefficients.join(",")}
        >
          {/* Coincident equations share one drawn segment and two solid keys. */}
          {(panel.id !== "infinite" || index === 0) && (
            <line
              data-system-line={index}
              data-coordinate-ends={line.ends.flat().join(",")}
              x1={x(line.ends[0][0])}
              y1={y(line.ends[0][1])}
              x2={x(line.ends[1][0])}
              y2={y(line.ends[1][1])}
              stroke="#202020"
              strokeWidth="3.5"
              strokeDasharray={line.dashed ? "9 7" : undefined}
            />
          )}
          <line
            x1="38"
            x2="82"
            y1={382 + 35 * index}
            y2={382 + 35 * index}
            stroke="#202020"
            strokeWidth="3.5"
            strokeDasharray={line.dashed ? "9 7" : undefined}
          />
          <text x="94" y={390 + 35 * index} style={label}>
            {line.equation}
          </text>
        </g>
      ))}
      {ticks.map((value) => (
        <g key={value}>
          <line
            data-x-tick={value}
            x1={x(value)}
            x2={x(value)}
            y1={291}
            y2={301}
            stroke="#555"
          />
          <line
            data-y-tick={value}
            x1={105}
            x2={115}
            y1={y(value)}
            y2={y(value)}
            stroke="#555"
          />
          {value !== 0 && (
            <text
              x={x(value)}
              y="324"
              textAnchor="middle"
              style={{
                ...label,
                paintOrder: "stroke",
                stroke: "white",
                strokeWidth: 4,
                strokeLinejoin: "round",
              }}
            >
              {value < 0 ? "−1" : value}
            </text>
          )}
          <text
            x="96"
            y={y(value) + (value === 0 ? -8 : 8)}
            textAnchor="end"
            style={{
              ...label,
              paintOrder: "stroke",
              stroke: "white",
              strokeWidth: 4,
              strokeLinejoin: "round",
            }}
          >
            {value < 0 ? "−1" : value}
          </text>
        </g>
      ))}
      {panel.point && (
        <g data-shared-point={panel.point.join(",")}>
          {panel.id !== "axes" && (
            <line
              data-point-label-leader="true"
              x1={x(panel.point[0])}
              y1={y(panel.point[1])}
              x2="276"
              y2="162"
              stroke="#777"
              strokeWidth="1"
            />
          )}
          <circle
            cx={x(panel.point[0])}
            cy={y(panel.point[1])}
            r="6"
            fill="#202020"
          />
          <text
            x={panel.id === "axes" ? x(panel.point[0]) + 12 : 350}
            y={panel.id === "axes" ? y(panel.point[1]) - 18 : 170}
            textAnchor={panel.id === "axes" ? "start" : "end"}
            style={label}
          >
            ({panel.point.join(", ")})
          </text>
        </g>
      )}
      {panel.nearMiss && (
        <g data-near-miss={panel.nearMiss.join(",")}>
          <circle
            cx={x(panel.nearMiss[0])}
            cy={y(panel.nearMiss[1])}
            r="6"
            fill="white"
            stroke="#202020"
            strokeWidth="2.5"
          />
          <text
            x={x(panel.nearMiss[0]) + 12}
            y={y(panel.nearMiss[1]) + 32}
            style={label}
          >
            ({panel.nearMiss.join(", ")})
          </text>
        </g>
      )}
    </svg>
  );
}

/** Exact affine lines on a common equal-unit coordinate scale. */
export function LinearSystemIllustration({
  kind,
}: {
  kind: "intersection" | "count";
}) {
  const panels = kind === "intersection" ? [intersection] : counts;
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
          gap: 16,
        }}
      >
        {panels.map((panel) => (
          <CoordinatePanel key={panel.id} panel={panel} />
        ))}
      </div>
      <figcaption style={{ marginTop: 12, lineHeight: 1.6 }}>
        {kind === "intersection"
          ? "Each tick interval is one unit on either axis. The filled point (2, 3) is on both lines. The open point (1, 2) is on only the solid line, so it does not solve the system. Both lines continue beyond the window."
          : "Each tick interval is one unit on either axis; every line continues beyond the window. Solid and dashed keys identify the equations. In the coincident case, both solid keys name the same line: every point on that line, and no point off it, is shared. Vertical and horizontal lines also represent equations."}
      </figcaption>
    </figure>
  );
}
