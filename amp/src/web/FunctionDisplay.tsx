import React from "react";
import type { FunctionDisplayFigure } from "../math/contracts.js";

type Graph = NonNullable<FunctionDisplayFigure["graph"]>;
// Role tokens, with the light values as fallbacks for printed pages.
const ink = "var(--color-figure-ink, #174a43)",
  gridColor = "var(--color-figure-grid, #d6dfd6)",
  axis = "var(--color-figure-axis, #6f8a7d)",
  paper = "var(--color-figure-paper, #fffdf7)",
  seriesColor = [
    "var(--color-figure-accent, #20776d)",
    "var(--color-figure-warm, #9c4420)",
  ];
const minus = (v: number) => (v < 0 ? `−${-v}` : String(v));

/** An input/output table (inputs in the first row) above a first-quadrant graph.
 * Each axis has one uniform scale; data attributes let a reviewer recheck it. */
export function FunctionDisplay({ figure }: { figure: FunctionDisplayFigure }) {
  const table = figure.table;
  return (
    <div
      className="figure function-display"
      data-kind="function-display"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minWidth: 0,
        // Shared figure rules cap SVG heights; this figure sizes to its content.
        height: "auto",
        maxHeight: "none",
      }}
    >
      {table && (
        <table
          className="function-table"
          style={{
            borderCollapse: "collapse",
            fontVariantNumeric: "tabular-nums",
            color: "inherit",
            maxWidth: "100%",
          }}
        >
          {table.title && (
            <caption style={{ fontWeight: 700, paddingBottom: 4 }}>
              {table.title}
            </caption>
          )}
          <tbody>
            {([0, 1] as const).map((column) => (
              <tr key={column}>
                <th
                  scope="row"
                  style={{
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    padding: "4px 10px 4px 4px",
                    borderRight: `2px solid ${ink}`,
                    borderBottom: column === 0 ? `1px solid ${axis}` : "none",
                  }}
                >
                  {table.columns[column]}
                </th>
                {table.rows.map((row, i) => (
                  <td
                    key={i}
                    data-cell={`${row.x},${row.y}`}
                    style={{
                      textAlign: "center",
                      minWidth: "2.2em",
                      padding: "4px 7px",
                      borderLeft: i ? `1px solid ${axis}` : "none",
                      borderBottom: column === 0 ? `1px solid ${axis}` : "none",
                    }}
                  >
                    {minus(column === 0 ? row.x : row.y)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {figure.graph && <FunctionGraph graph={figure.graph} />}
    </div>
  );
}

const L = 62,
  R = 296,
  T = 30,
  B = 200;
export function FunctionGraph({
  graph,
  reveal,
}: {
  graph: Graph;
  /** Animation hook: how many points of each series to draw, and whether lines show. */
  reveal?: { points: number; lines: boolean };
}) {
  const x = (v: number) => L + (v / graph.xMax) * (R - L);
  const y = (v: number) => B - (v / graph.yMax) * (B - T);
  const xTicks = Array.from(
    { length: graph.xMax / graph.xStep + 1 },
    (_, i) => i * graph.xStep,
  );
  const yTicks = Array.from(
    { length: graph.yMax / graph.yStep + 1 },
    (_, i) => i * graph.yStep,
  );
  const every = xTicks.length > 7 ? 2 : 1;
  const segment = (line: { rise: number; run: number; b: number }) => {
    const f = (v: number) => (line.rise * v) / line.run + line.b;
    let lo = 0,
      hi = graph.xMax;
    if (line.rise !== 0) {
      const a = ((0 - line.b) * line.run) / line.rise,
        c = ((graph.yMax - line.b) * line.run) / line.rise;
      lo = Math.max(lo, Math.min(a, c));
      hi = Math.min(hi, Math.max(a, c));
    } else if (line.b < 0 || line.b > graph.yMax) return null;
    return lo < hi ? { x1: lo, y1: f(lo), x2: hi, y2: f(hi) } : null;
  };
  const described = graph.series
    .map((s) => {
      const name = s.label ? `Function ${s.label}: ` : "";
      const pts = s.points.map((p) => `(${p.x}, ${p.y})`).join(", ");
      return s.line
        ? `${name}a straight line through ${pts}`
        : `${name}points ${pts}`;
    })
    .join(". ");
  return (
    <svg
      className="function-graph"
      viewBox="0 0 320 236"
      role="img"
      aria-label={`Graph: ${graph.xLabel} across, from 0 to ${graph.xMax} in steps of ${graph.xStep}; ${graph.yLabel} up, from 0 to ${graph.yMax} in steps of ${graph.yStep}. ${described}.`}
      style={{
        display: "block",
        width: "100%",
        maxWidth: 360,
        height: "auto",
        overflow: "visible",
      }}
      data-x-max={graph.xMax}
      data-y-max={graph.yMax}
    >
      {xTicks.map((v, i) => (
        <g key={`x${v}`}>
          <line
            x1={x(v)}
            x2={x(v)}
            y1={T}
            y2={B}
            stroke={v === 0 ? ink : gridColor}
            strokeWidth={v === 0 ? 2 : 1}
          />
          {(i % every === 0 || v === graph.xMax) && (
            <text
              x={x(v)}
              y={B + 20}
              textAnchor="middle"
              style={{ fontSize: 16, fill: "currentColor" }}
            >
              {v}
            </text>
          )}
        </g>
      ))}
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line
            x1={L}
            x2={R}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0 ? ink : gridColor}
            strokeWidth={v === 0 ? 2 : 1}
          />
          {v > 0 && (
            <text
              x={L - 8}
              y={y(v) + 5}
              textAnchor="end"
              style={{ fontSize: 16, fill: "currentColor" }}
            >
              {v}
            </text>
          )}
        </g>
      ))}
      <text
        x={R}
        y={B + 40}
        textAnchor="end"
        style={{ fontSize: 16, fontWeight: 700, fill: "currentColor" }}
      >
        {graph.xLabel} →
      </text>
      <text
        x={L - 8}
        y={T - 12}
        textAnchor="start"
        style={{ fontSize: 16, fontWeight: 700, fill: "currentColor" }}
      >
        ↑ {graph.yLabel}
      </text>
      {graph.series.map((s, k) => {
        const seg = s.line ? segment(s.line) : null;
        const color = seriesColor[k]!;
        const shown = reveal ? reveal.points : s.points.length;
        return (
          <g key={k} data-series={s.label ?? k}>
            {seg && (
              <line
                className="function-line"
                x1={x(seg.x1)}
                y1={y(seg.y1)}
                x2={x(seg.x2)}
                y2={y(seg.y2)}
                stroke={color}
                strokeWidth="3"
                strokeDasharray={k ? "9 6" : undefined}
                style={{
                  opacity: !reveal || reveal.lines ? 1 : 0,
                  transition: "opacity 500ms ease",
                }}
              />
            )}
            {s.points.map((pt, i) =>
              k ? (
                <rect
                  key={i}
                  data-point={`${pt.x},${pt.y}`}
                  x={x(pt.x) - 5.5}
                  y={y(pt.y) - 5.5}
                  width="11"
                  height="11"
                  fill={color}
                  stroke={paper}
                  strokeWidth="1.5"
                  className="function-point"
                  style={{ opacity: i < shown ? 1 : 0 }}
                />
              ) : (
                <circle
                  key={i}
                  data-point={`${pt.x},${pt.y}`}
                  cx={x(pt.x)}
                  cy={y(pt.y)}
                  r="6"
                  fill={color}
                  stroke={paper}
                  strokeWidth="1.5"
                  className="function-point"
                  style={{
                    opacity: i < shown ? 1 : 0,
                    transition: `opacity 300ms ease ${reveal ? i * 260 : 0}ms`,
                  }}
                />
              ),
            )}
            {s.label && seg && (
              <text
                x={x(seg.x2) + (seg.x2 >= graph.xMax ? 8 : 4)}
                y={y(seg.y2) + (seg.y2 >= graph.yMax ? 14 : -6)}
                style={{ fontSize: 18, fontWeight: 700, fill: color }}
              >
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
