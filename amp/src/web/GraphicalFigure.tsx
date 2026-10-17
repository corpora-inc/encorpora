import React from "react";
import type { SemanticFigure } from "../math/contracts.js";
export type GraphicalFigureData = Extract<
  SemanticFigure,
  { kind: "coordinate-plane" | "bar-chart" | "clock" | "number-line" }
>;
const ink = "#174a43",
  accent = "#20776d";
const range = (min: number, max: number) =>
  Array.from(
    { length: Math.floor(max) - Math.ceil(min) + 1 },
    (_, i) => Math.ceil(min) + i,
  );
export function GraphicalFigure({ figure }: { figure: GraphicalFigureData }) {
  switch (figure.kind) {
    case "coordinate-plane": {
      const x = (n: number) =>
        70 + ((n - figure.xMin) / (figure.xMax - figure.xMin)) * 180;
      const y = (n: number) =>
        220 - ((n - figure.yMin) / (figure.yMax - figure.yMin)) * 180;
      const pointDescription = figure.points
        .map((p) => `${p.label ?? "Point"} at (${p.x}, ${p.y})`)
        .join("; ");
      return (
        <svg
          data-kind={figure.kind}
          className="figure graphical-figure"
          viewBox="0 0 320 260"
          role="img"
          aria-label={`Coordinate grid, one unit per grid step. ${pointDescription}${figure.lines?.length ? ". A straight line passes through the marked points." : ""}`}
        >
          {range(figure.xMin, figure.xMax).map((n) => (
            <g key={`x${n}`}>
              <line
                x1={x(n)}
                y1="40"
                x2={x(n)}
                y2="220"
                stroke={n === 0 ? ink : "#789586"}
                strokeWidth={n === 0 ? 2 : 1}
              />
              {(n === 0 || n === figure.xMin || n === figure.xMax) && (
                <text
                  x={x(n)}
                  y="249"
                  textAnchor="middle"
                  style={{ fontSize: 24 }}
                >
                  {n}
                </text>
              )}
            </g>
          ))}
          {range(figure.yMin, figure.yMax).map((n) => (
            <g key={`y${n}`}>
              <line
                x1="70"
                y1={y(n)}
                x2="250"
                y2={y(n)}
                stroke={n === 0 ? ink : "#789586"}
                strokeWidth={n === 0 ? 2 : 1}
              />
              {(n === 0 || n === figure.yMin || n === figure.yMax) && (
                <text
                  x="58"
                  y={y(n) + 8}
                  textAnchor="end"
                  style={{ fontSize: 24 }}
                >
                  {n}
                </text>
              )}
            </g>
          ))}
          <text
            x="270"
            y={y(Math.min(figure.yMax, Math.max(figure.yMin, 0))) + 8}
            style={{ fontSize: 24 }}
          >
            x
          </text>
          <text
            x={x(Math.min(figure.xMax, Math.max(figure.xMin, 0)))}
            y="28"
            textAnchor="middle"
            style={{ fontSize: 24 }}
          >
            y
          </text>
          {figure.lines?.map((line, i) => {
            let left = figure.xMin,
              right = figure.xMax;
            if (line.m !== 0) {
              const first = (figure.yMin - line.b) / line.m,
                second = (figure.yMax - line.b) / line.m;
              left = Math.max(left, Math.min(first, second));
              right = Math.min(right, Math.max(first, second));
            } else if (line.b < figure.yMin || line.b > figure.yMax)
              return null;
            return left <= right ? (
              <line
                key={i}
                data-line="graph"
                x1={x(left)}
                y1={y(line.m * left + line.b)}
                x2={x(right)}
                y2={y(line.m * right + line.b)}
                stroke={accent}
                strokeWidth="3"
              />
            ) : null;
          })}
          {figure.points.map((p, i) => (
            <g key={i}>
              <circle
                data-point={p.label ?? i}
                cx={x(p.x)}
                cy={y(p.y)}
                r="5"
                fill="#9c4420"
                stroke="white"
                strokeWidth="1"
              />
              <text
                x={x(p.x) + (p.x < 0 && x(0) - x(p.x) < 30 ? -10 : 10)}
                textAnchor={p.x < 0 && x(0) - x(p.x) < 30 ? "end" : "start"}
                y={
                  y(p.y) < 70 || (p.y < 0 && y(p.y) - y(0) < 35)
                    ? y(p.y) + 25
                    : y(p.y) - 10
                }
                fill={ink}
                style={{ fontSize: 24, fontWeight: 700 }}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      );
    }
    case "bar-chart": {
      const step = Math.max(5, Math.ceil(Math.max(...figure.values) / 10) * 5),
        ceiling = step * 2,
        scale = 100 / ceiling;
      const column = 240 / figure.categories.length;
      return (
        <svg
          data-kind={figure.kind}
          className="figure graphical-figure"
          viewBox="0 0 320 240"
          role="img"
          aria-label={`${figure.valueLabel} by category. ${figure.categories.map((category, i) => `${category}: ${figure.values[i]}`).join("; ")}.`}
        >
          <text x="48" y="34" fill={ink} style={{ fontSize: 28 }}>
            {figure.valueLabel}
          </text>
          {range(0, 2).map((n) => (
            <g key={n}>
              <line
                x1="48"
                x2="288"
                y1={178 - n * step * scale}
                y2={178 - n * step * scale}
                stroke="#cad8d2"
              />
              <text
                x="38"
                y={187 - n * step * scale}
                textAnchor="end"
                style={{ fontSize: 28 }}
              >
                {n * step}
              </text>
            </g>
          ))}
          {figure.values.map((value, i) => (
            <g key={i}>
              <rect
                data-category={figure.categories[i]}
                x={48 + column * i + column * 0.2}
                y={178 - value * scale}
                width={column * 0.6}
                height={value * scale}
                fill={accent}
              />
              <text
                x={48 + column * (i + 0.5)}
                y={166 - value * scale}
                textAnchor="middle"
                style={{ fontSize: 28 }}
              >
                {value}
              </text>
              <text
                x={48 + column * (i + 0.5)}
                y="218"
                textAnchor="middle"
                style={{ fontSize: 28 }}
              >
                {figure.categories[i]}
              </text>
            </g>
          ))}
        </svg>
      );
    }
    case "clock": {
      const end = (angle: number, length: number) => ({
        x: 160 + Math.sin((angle * Math.PI) / 180) * length,
        y: 145 - Math.cos((angle * Math.PI) / 180) * length,
      });
      const hour = end((figure.hour % 12) * 30 + figure.minute * 0.5, 58),
        minute = end(figure.minute * 6, 77);
      return (
        <svg
          data-kind={figure.kind}
          className="figure graphical-figure"
          viewBox="0 15 320 260"
          role="img"
          aria-label={`Clock showing ${figure.hour}:${String(figure.minute).padStart(2, "0")}. The shorter hand shows the hour; the longer hand shows minutes.`}
        >
          <circle
            cx="160"
            cy="145"
            r="120"
            fill="#f6f2e8"
            stroke={ink}
            strokeWidth="3"
          />
          {range(1, 12).map((n) => {
            const p = end(n * 30, 93);
            return (
              <text
                key={n}
                x={p.x}
                y={p.y + 10}
                textAnchor="middle"
                style={{ fontSize: 30, fontFamily: "Arial, sans-serif" }}
              >
                {n}
              </text>
            );
          })}
          {range(0, 59).map((n) => {
            const p = end(n * 6, n % 5 ? 114 : 109),
              q = end(n * 6, 119);
            return (
              <line key={n} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={ink} />
            );
          })}
          <line
            data-hand="hour"
            x1="160"
            y1="145"
            x2={hour.x}
            y2={hour.y}
            stroke={ink}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            data-hand="minute"
            x1="160"
            y1="145"
            x2={minute.x}
            y2={minute.y}
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="160" cy="145" r="6" fill={ink} />
        </svg>
      );
    }
    case "number-line": {
      const x = (n: number) =>
        24 + ((n - figure.min) / (figure.max - figure.min)) * 272;
      return (
        <svg
          data-kind={figure.kind}
          className="figure graphical-figure"
          viewBox="0 0 320 110"
          role="img"
          aria-label={`Number line with one-unit ticks from ${figure.min} to ${figure.max}. Marked points: ${figure.points.join(", ")}.`}
        >
          <line x1="20" y1="64" x2="300" y2="64" stroke={ink} strokeWidth="2" />
          {range(figure.min, figure.max).map((n) => (
            <g key={n}>
              <line
                data-tick={n}
                x1={x(n)}
                y1="56"
                x2={x(n)}
                y2="72"
                stroke={ink}
              />
              {(n % 5 === 0 || n === figure.min || n === figure.max) && (
                <text
                  x={x(n)}
                  y="98"
                  textAnchor="middle"
                  style={{ fontSize: 18 }}
                >
                  {n}
                </text>
              )}
            </g>
          ))}
          {figure.points.map((n, i) => {
            const crowded = figure.points.some(
              (other, j) => j !== i && Math.abs(x(other) - x(n)) < 40,
            );
            const labelY = crowded && i % 2 ? 50 : 26;
            return (
              <g key={i}>
                <line
                  x1={x(n)}
                  y1={labelY + 5}
                  x2={x(n)}
                  y2="58"
                  stroke="#9c4420"
                  strokeWidth="1.5"
                />
                <text
                  x={x(n)}
                  y={labelY}
                  textAnchor="middle"
                  fill="#9c4420"
                  style={{ fontSize: 18, fontWeight: 700 }}
                >
                  {n}
                </text>
                <circle
                  data-mark={n}
                  cx={x(n)}
                  cy="64"
                  r="5"
                  fill="#9c4420"
                  stroke="white"
                  strokeWidth="1"
                />
              </g>
            );
          })}
        </svg>
      );
    }
  }
}
