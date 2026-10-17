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
        45 + ((n - figure.xMin) / (figure.xMax - figure.xMin)) * 300;
      const y = (n: number) =>
        325 - ((n - figure.yMin) / (figure.yMax - figure.yMin)) * 300;
      const pointDescription = figure.points
        .map((p) => `${p.label ?? "Point"} at (${p.x}, ${p.y})`)
        .join("; ");
      return (
        <svg
          data-kind={figure.kind}
          className="figure"
          viewBox="0 0 390 365"
          role="img"
          aria-label={`Coordinate grid, one unit per grid step. ${pointDescription}${figure.lines?.length ? ". A straight line passes through the marked points." : ""}`}
        >
          {range(figure.xMin, figure.xMax).map((n) => (
            <g key={`x${n}`}>
              <line
                x1={x(n)}
                y1="25"
                x2={x(n)}
                y2="325"
                stroke={n === 0 ? ink : "#cad8d2"}
                strokeWidth={n === 0 ? 2 : 1}
              />
              <text x={x(n)} y="344" textAnchor="middle" fontSize="12">
                {n}
              </text>
            </g>
          ))}
          {range(figure.yMin, figure.yMax).map((n) => (
            <g key={`y${n}`}>
              <line
                x1="45"
                y1={y(n)}
                x2="345"
                y2={y(n)}
                stroke={n === 0 ? ink : "#cad8d2"}
                strokeWidth={n === 0 ? 2 : 1}
              />
              <text x="35" y={y(n) + 4} textAnchor="end" fontSize="12">
                {n}
              </text>
            </g>
          ))}
          <text x="363" y={y(0) + 5}>
            x
          </text>
          <text x={x(0) - 4} y="16">
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
              <text x={x(p.x) + 9} y={y(p.y) - 8} fill={ink} fontWeight="bold">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      );
    }
    case "bar-chart": {
      const ceiling = Math.max(
          5,
          Math.ceil(Math.max(...figure.values) / 5) * 5,
        ),
        scale = 210 / ceiling;
      const column = 300 / figure.categories.length;
      return (
        <svg
          data-kind={figure.kind}
          className="figure"
          viewBox="0 0 400 300"
          role="img"
          aria-label={`${figure.valueLabel} by category. ${figure.categories.map((category, i) => `${category}: ${figure.values[i]}`).join("; ")}.`}
        >
          <text x="50" y="20" fill={ink}>
            {figure.valueLabel}
          </text>
          {range(0, ceiling / 5).map((n) => (
            <g key={n}>
              <line
                x1="50"
                x2="350"
                y1={250 - n * 5 * scale}
                y2={250 - n * 5 * scale}
                stroke="#cad8d2"
              />
              <text
                x="40"
                y={254 - n * 5 * scale}
                textAnchor="end"
                fontSize="12"
              >
                {n * 5}
              </text>
            </g>
          ))}
          {figure.values.map((value, i) => (
            <g key={i}>
              <rect
                data-category={figure.categories[i]}
                x={50 + column * i + column * 0.2}
                y={250 - value * scale}
                width={column * 0.6}
                height={value * scale}
                fill={accent}
              />
              <text
                x={50 + column * (i + 0.5)}
                y={242 - value * scale}
                textAnchor="middle"
              >
                {value}
              </text>
              <text
                x={50 + column * (i + 0.5)}
                y="276"
                textAnchor="middle"
                fontSize="14"
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
        minute = end(figure.minute * 6, 88);
      return (
        <svg
          data-kind={figure.kind}
          className="figure"
          viewBox="0 0 320 290"
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
            const p = end(n * 30, 101);
            return (
              <text
                key={n}
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="16"
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
        30 + ((n - figure.min) / (figure.max - figure.min)) * 480;
      return (
        <svg
          data-kind={figure.kind}
          className="figure"
          viewBox="0 0 540 125"
          role="img"
          aria-label={`Number line with one-unit ticks from ${figure.min} to ${figure.max}. Marked points: ${figure.points.join(", ")}.`}
        >
          <line x1="25" y1="58" x2="515" y2="58" stroke={ink} strokeWidth="2" />
          {range(figure.min, figure.max).map((n) => (
            <g key={n}>
              <line x1={x(n)} y1="50" x2={x(n)} y2="66" stroke={ink} />
              <text x={x(n)} y="88" textAnchor="middle" fontSize="12">
                {n}
              </text>
            </g>
          ))}
          {figure.points.map((n, i) => (
            <circle
              key={i}
              data-mark={n}
              cx={x(n)}
              cy="58"
              r="6"
              fill="#9c4420"
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>
      );
    }
  }
}
