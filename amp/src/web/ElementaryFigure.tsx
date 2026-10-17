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
  return (
    <svg
      className="figure elementary-figure"
      viewBox="0 0 370 210"
      role="img"
      aria-label={`Base-ten model: ${figure.hundreds} hundred flats, ${figure.tens} ten rods, and ${figure.ones} one squares. A hundred flat has ten rows of ten units; a rod has ten units.`}
    >
      <text x="76" y="22" textAnchor="middle" style={{ fontSize: 17 }}>
        Hundreds
      </text>
      <text x="204" y="22" textAnchor="middle" style={{ fontSize: 17 }}>
        Tens
      </text>
      <text x="307" y="22" textAnchor="middle" style={{ fontSize: 17 }}>
        Ones
      </text>
      <line x1="150" x2="150" y1="30" y2="180" stroke="#ccd8d3" />
      <line x1="262" x2="262" y1="30" y2="180" stroke="#ccd8d3" />
      {Array.from({ length: figure.hundreds }, (_, i) => {
        const x = 12 + (i % 3) * 44,
          y = 38 + Math.floor(i / 3) * 44;
        return (
          <g key={`h${i}`} data-unit="hundred">
            <rect
              x={x}
              y={y}
              width="40"
              height="40"
              fill="#d9e9e1"
              stroke={ink}
              strokeWidth="1"
            />
            {Array.from({ length: 9 }, (_, j) => (
              <React.Fragment key={j}>
                <line
                  x1={x + 4 * (j + 1)}
                  x2={x + 4 * (j + 1)}
                  y1={y}
                  y2={y + 40}
                  stroke={first}
                  strokeWidth=".4"
                />
                <line
                  x1={x}
                  x2={x + 40}
                  y1={y + 4 * (j + 1)}
                  y2={y + 4 * (j + 1)}
                  stroke={first}
                  strokeWidth=".4"
                />
              </React.Fragment>
            ))}
          </g>
        );
      })}
      {Array.from({ length: figure.tens }, (_, i) => {
        const x = 160 + (i % 10) * 9,
          y = 38 + Math.floor(i / 10) * 48;
        return (
          <g key={`t${i}`} data-unit="ten">
            <rect
              x={x}
              y={y}
              width="4"
              height="40"
              fill="#d9e9e1"
              stroke={ink}
              strokeWidth=".7"
            />
            {Array.from({ length: 9 }, (_, j) => (
              <line
                key={j}
                x1={x}
                x2={x + 4}
                y1={y + 4 * (j + 1)}
                y2={y + 4 * (j + 1)}
                stroke={first}
                strokeWidth=".4"
              />
            ))}
          </g>
        );
      })}
      {Array.from({ length: figure.ones }, (_, i) => (
        <rect
          key={`o${i}`}
          data-unit="one"
          x={277 + (i % 5) * 14}
          y={38 + Math.floor(i / 5) * 14}
          width="4"
          height="4"
          fill={ink}
        />
      ))}
      <text x="76" y="195" textAnchor="middle" style={{ fontSize: 14 }}>
        each = 100
      </text>
      <text x="204" y="195" textAnchor="middle" style={{ fontSize: 14 }}>
        each = 10
      </text>
      <text x="307" y="195" textAnchor="middle" style={{ fontSize: 14 }}>
        each = 1
      </text>
    </svg>
  );
}
