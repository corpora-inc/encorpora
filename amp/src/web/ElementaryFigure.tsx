import React from "react";
import type { SemanticFigure } from "../math/contracts.js";
export type ElementaryFigureData = Extract<
  SemanticFigure,
  { kind: "ten-frame" | "base-ten" }
>;
const ink = "#16483f",
  first = "#20776d",
  second = "#a74720";
export function ElementaryFigure({ figure }: { figure: ElementaryFigureData }) {
  if (figure.kind === "ten-frame") {
    const frames = figure.capacity / 10;
    return (
      <svg
        className="figure elementary-figure"
        viewBox={`0 0 300 ${frames === 1 ? 116 : 220}`}
        role="img"
        aria-label={`${frames === 1 ? "One ten-frame" : "Two ten-frames"}, each with ten places. ${figure.first} round counters and ${figure.second} square counters. Other places are empty.`}
      >
        {Array.from({ length: figure.capacity }, (_, index) => {
          const frame = Math.floor(index / 10),
            within = index % 10,
            x = 25 + (within % 5) * 50,
            y = 10 + frame * 104 + Math.floor(within / 5) * 46;
          return (
            <g key={index}>
              <rect
                data-slot={index}
                x={x}
                y={y}
                width="50"
                height="46"
                fill="#fffdf7"
                stroke={ink}
                strokeWidth="1.5"
              />
              {index < figure.first ? (
                <circle
                  data-counter="first"
                  cx={x + 25}
                  cy={y + 23}
                  r="14"
                  fill={first}
                />
              ) : index < figure.first + figure.second ? (
                <rect
                  data-counter="second"
                  x={x + 12}
                  y={y + 10}
                  width="26"
                  height="26"
                  rx="2"
                  fill={second}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    );
  }
  // Columns appear only for places in use; units are large enough to count.
  const u = figure.hundreds ? 8 : 12,
    rod = 10 * u,
    columns: {
      key: "hundred" | "ten" | "one";
      label: string;
      count: number;
      width: number;
      height: number;
    }[] = [];
  if (figure.hundreds)
    columns.push({
      key: "hundred",
      label: "Hundreds",
      count: figure.hundreds,
      width: Math.min(3, figure.hundreds) * (rod + 6),
      height: Math.ceil(figure.hundreds / 3) * (rod + 6),
    });
  columns.push({
    key: "ten",
    label: "Tens",
    count: figure.tens,
    width: Math.max(u + 6, Math.min(10, figure.tens) * (u + 5)),
    height: Math.ceil(Math.max(1, figure.tens) / 10) * (rod + 8),
  });
  columns.push({
    key: "one",
    label: "Ones",
    count: figure.ones,
    width: Math.max(u + 6, Math.min(5, Math.max(1, figure.ones)) * (u + 5)),
    height: Math.ceil(Math.max(1, figure.ones) / 5) * (u + 5),
  });
  const gap = 28,
    top = 30,
    width =
      columns.reduce((sum, c) => sum + c.width, 0) + gap * (columns.length + 1),
    height = top + Math.max(...columns.map((c) => c.height)) + 12;
  let cursor = gap;
  const placed = columns.map((c) => {
    const x = cursor;
    cursor += c.width + gap;
    return { ...c, x };
  });
  const cells = (x: number, y: number, across: number, down: number) => (
    <>
      {Array.from({ length: across - 1 }, (_, j) => (
        <line
          key={`a${j}`}
          x1={x + u * (j + 1)}
          x2={x + u * (j + 1)}
          y1={y}
          y2={y + down * u}
          className="base-cell"
        />
      ))}
      {Array.from({ length: down - 1 }, (_, j) => (
        <line
          key={`d${j}`}
          x1={x}
          x2={x + across * u}
          y1={y + u * (j + 1)}
          y2={y + u * (j + 1)}
          className="base-cell"
        />
      ))}
    </>
  );
  return (
    <svg
      className="figure elementary-figure base-ten-figure"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Base-ten model: ${figure.hundreds} hundred flats, ${figure.tens} ten rods, and ${figure.ones} one cubes. A hundred flat has ten rows of ten units; a rod has ten units.`}
    >
      {placed.map((c) => (
        <g key={c.key}>
          <text
            x={c.x + c.width / 2}
            y={18}
            textAnchor="middle"
            className="fig-scale"
          >
            {c.label}
          </text>
          {Array.from({ length: c.count }, (_, i) => {
            if (c.key === "hundred") {
              const x = c.x + (i % 3) * (rod + 6),
                y = top + Math.floor(i / 3) * (rod + 6);
              return (
                <g key={i} data-unit="hundred">
                  <rect
                    x={x}
                    y={y}
                    width={rod}
                    height={rod}
                    rx={2}
                    className="base-block"
                  />
                  {cells(x, y, 10, 10)}
                </g>
              );
            }
            if (c.key === "ten") {
              const x = c.x + (i % 10) * (u + 5),
                y = top + Math.floor(i / 10) * (rod + 8);
              return (
                <g key={i} data-unit="ten">
                  <rect
                    x={x}
                    y={y}
                    width={u}
                    height={rod}
                    rx={2}
                    className="base-block"
                  />
                  {cells(x, y, 1, 10)}
                </g>
              );
            }
            return (
              <rect
                key={i}
                data-unit="one"
                x={c.x + (i % 5) * (u + 5)}
                y={top + Math.floor(i / 5) * (u + 5)}
                width={u}
                height={u}
                rx={2}
                className="base-block"
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}
