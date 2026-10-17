import React from "react";
import type { Diagram } from "./schema.js";
import {
  clipPlotLine,
  exactLabel,
  exactValue,
  validateAlgebraModel,
} from "./algebra-models.js";
export type AlgebraDiagram = Extract<
  Diagram,
  { kind: "balance" | "coordinate-plot" | "value-table" }
>;
const ink = "#18594f",
  coral = "#af4c39",
  gold = "#e8c579";
/** Shared semantic drawing: print and screen preserve the same mathematical givens. */
export function AlgebraDiagramFigure({
  diagram: d,
  screen = false,
}: {
  diagram: AlgebraDiagram;
  screen?: boolean;
}) {
  validateAlgebraModel(d);
  let art: React.ReactNode, key: React.ReactNode;
  if (d.kind === "value-table") {
    art = (
      <table className="algebra-table" aria-label={d.alt}>
        <thead>
          <tr>
            <th scope="col">{d.inputLabel}</th>
            <th scope="col">{d.outputLabel}</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((row, i) => (
            <tr key={i}>
              <td>{exactLabel(row.input)}</td>
              <td>
                {row.output === null ? (
                  <span aria-label="unknown value">?</span>
                ) : (
                  exactLabel(row.output)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (d.kind === "balance") {
    art = (
      <svg
        viewBox="0 0 320 175"
        role="img"
        aria-label={d.alt}
        style={{ fontSize: 18 }}
      >
        <path
          d="M160 91 L132 162 H188 Z"
          fill="#e4f0eb"
          stroke={ink}
          strokeWidth="2"
        />
        <path
          d="M25 106 H295 M68 106 V123 H252 V106"
          fill="none"
          stroke={ink}
          strokeWidth="3"
        />
        {[d.left, d.right].map((side, i) => (
          <g
            key={i}
            data-pan={i === 0 ? "left" : "right"}
            data-bags={side.bags}
            data-units={side.units}
          >
            {Array.from({ length: side.bags }, (_, j) => (
              <g
                key={j}
                transform={`translate(${(i === 0 ? 70 : 250) - side.bags * 13 + j * 26},18)`}
              >
                <path
                  d="M5 5 H17 L21 47 Q11 53 1 47 Z"
                  fill={gold}
                  stroke={ink}
                />
                <text
                  x="11"
                  y="36"
                  textAnchor="middle"
                  style={{ fontSize: 18 }}
                >
                  {d.unknownLabel}
                </text>
              </g>
            ))}
            <rect
              x={i === 0 ? 20 : 200}
              y="77"
              width="100"
              height="27"
              rx="5"
              fill="#e4f0eb"
              stroke={ink}
            />
            <text
              x={i === 0 ? 70 : 250}
              y="97"
              textAnchor="middle"
              style={{ fontSize: 18 }}
            >
              {side.units} units
            </text>
          </g>
        ))}
        <text x="160" y="78" textAnchor="middle" style={{ fontSize: 24 }}>
          =
        </text>
      </svg>
    );
    key = (
      <p className="algebra-key">
        Each bag has the same mass, {d.unknownLabel}. One unit: {d.unitLabel}.
        Use the labels; drawings are not to scale.
      </p>
    );
  } else {
    const x = (n: number) => 50 + ((n - d.xMin) / (d.xMax - d.xMin)) * 235,
      y = (n: number) => 174 - ((n - d.yMin) / (d.yMax - d.yMin)) * 150;
    const xy = (p: { x: [number, number]; y: [number, number] }) => ({
      x: x(exactValue(p.x)),
      y: y(exactValue(p.y)),
    });
    const ticks = (min: number, max: number, step: number) =>
      Array.from({ length: (max - min) / step + 1 }, (_, i) => min + i * step);
    art = (
      <svg
        viewBox="0 0 320 220"
        role="img"
        aria-label={d.alt}
        style={{ fontSize: 18 }}
      >
        {ticks(d.xMin, d.xMax, d.xStep).map((n) => (
          <g key={`x${n}`}>
            <path d={`M${x(n)} 24 V174`} stroke="#ccdcd5" />
            <text x={x(n)} y="196" textAnchor="middle" style={{ fontSize: 17 }}>
              {n}
            </text>
          </g>
        ))}
        {ticks(d.yMin, d.yMax, d.yStep).map((n) => (
          <g key={`y${n}`}>
            <path d={`M50 ${y(n)} H285`} stroke="#ccdcd5" />
            <text x="41" y={y(n) + 6} textAnchor="end" style={{ fontSize: 17 }}>
              {n}
            </text>
          </g>
        ))}
        <path
          d={`M50 ${y(0)} H291 M${x(0)} 180 V18`}
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        <text
          x="302"
          y={Math.max(21, Math.min(181, y(0) + 6))}
          style={{ fontSize: 18 }}
        >
          x
        </text>
        <text x={Math.min(299, x(0) + 8)} y="23" style={{ fontSize: 18 }}>
          y
        </text>
        {(d.lines ?? []).map((line, i) => {
          const [a, b] = clipPlotLine(d, line).map(xy);
          const color = i === 0 ? ink : coral;
          return (
            <g key={i} data-line={line.label}>
              <line
                x1={a!.x}
                y1={a!.y}
                x2={b!.x}
                y2={b!.y}
                stroke={color}
                strokeWidth="3"
                strokeDasharray={i === 1 ? "7 3" : undefined}
              />
              {line.domain
                ? [a!, b!].map((p, j) => (
                    <circle key={j} cx={p.x} cy={p.y} r="4" fill={color} />
                  ))
                : [a!, b!].map((p, j) => {
                    const other = j === 0 ? b! : a!,
                      angle =
                        (Math.atan2(p.y - other.y, p.x - other.x) * 180) /
                        Math.PI;
                    return (
                      <path
                        key={j}
                        d="M-8,-4 L0,0 L-8,4"
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        transform={`translate(${p.x},${p.y}) rotate(${angle})`}
                      />
                    );
                  })}
            </g>
          );
        })}
        {(d.segments ?? []).map((s, i) => {
          const a = xy(s.from),
            b = xy(s.to);
          return (
            <g key={i}>
              <line
                data-segment={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={coral}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {s.label && (
                <text
                  x={Math.max(
                    s.label.length * 9 + 3,
                    Math.min(317 - s.label.length * 9, (a.x + b.x) / 2),
                  )}
                  y={Math.max(23, (a.y + b.y) / 2 - 8)}
                  textAnchor="middle"
                  paintOrder="stroke"
                  stroke="white"
                  strokeWidth="4"
                  style={{ fontSize: 18 }}
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
        {d.points.map((p, i) => {
          const at = xy(p),
            west = p.labelPosition?.includes("w"),
            south = p.labelPosition?.includes("s");
          return (
            <g key={i}>
              <circle
                data-point={p.label ?? i}
                cx={at.x}
                cy={at.y}
                r="4"
                fill={coral}
              />
              {p.label && (
                <text
                  x={Math.max(
                    west ? p.label.length * 18 + 3 : 3,
                    Math.min(
                      west ? 317 : 317 - p.label.length * 18,
                      at.x + (west ? -9 : 9),
                    ),
                  )}
                  y={Math.max(23, Math.min(171, at.y + (south ? 20 : -10)))}
                  textAnchor={west ? "end" : "start"}
                  paintOrder="stroke"
                  stroke="white"
                  strokeWidth="4"
                  fill={coral}
                  style={{ fontSize: 18 }}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
    key = (
      <div className="algebra-key">
        <p>
          x: {d.xLabel}
          <br />
          y: {d.yLabel}
        </p>
        {(d.lines ?? []).map((l, i) => (
          <p key={i}>
            <span style={{ color: i === 0 ? ink : coral }}>
              {i === 0 ? "━━" : "┄┄"} {l.label}
            </span>
            : {l.domain ? "closed endpoints" : "continues beyond window"}
          </p>
        ))}
      </div>
    );
  }
  return (
    <figure
      className={`${screen ? "book-screen-figure" : "book-figure"} algebra-figure algebra-${d.kind}`}
    >
      <div className="algebra-art">{art}</div>
      <div className="algebra-notes">
        {key}
        <figcaption>{d.caption}</figcaption>
      </div>
    </figure>
  );
}
