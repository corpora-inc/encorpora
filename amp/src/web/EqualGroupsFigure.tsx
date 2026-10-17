import React from "react";
import type { SemanticFigure } from "../math/contracts.js";
export type EqualGroupsFigureData = Extract<
  SemanticFigure,
  { kind: "unit-array" | "grouped-counters" }
>;
const ink = "#16483f",
  teal = "#20776d",
  coral = "#b35a35";
/** A single square scale preserves array geometry; boxes show fixed group capacity. */
export function EqualGroupsFigure({
  figure,
}: {
  figure: EqualGroupsFigureData;
}) {
  if (figure.kind === "unit-array") {
    const cell = Math.min(30, 270 / figure.columns, 178 / figure.rows),
      w = cell * figure.columns,
      h = cell * figure.rows,
      x = (340 - w) / 2,
      y = 24;
    return (
      <svg
        className="figure equal-groups-figure"
        viewBox={`0 0 380 ${h + 52}`}
        role="img"
        aria-label={`${figure.rows} rows of ${figure.columns} unit squares${figure.splitAfterRow ? `; region A is the top ${figure.splitAfterRow} rows and region B is the remaining rows` : ""}`}
      >
        {Array.from({ length: figure.rows * figure.columns }, (_, i) => {
          const row = Math.floor(i / figure.columns),
            column = i % figure.columns;
          return (
            <rect
              data-unit-cell={i}
              key={i}
              x={x + column * cell}
              y={y + row * cell}
              width={cell}
              height={cell}
              fill={
                figure.splitAfterRow !== undefined &&
                row >= figure.splitAfterRow
                  ? "#f2d5c3"
                  : "#cde8df"
              }
              stroke={ink}
              strokeWidth="1.2"
            />
          );
        })}
        {figure.splitAfterRow !== undefined && (
          <>
            <line
              x1={x - 3}
              x2={x + w + 3}
              y1={y + figure.splitAfterRow * cell}
              y2={y + figure.splitAfterRow * cell}
              stroke={ink}
              strokeWidth="3"
            />
            <text
              x={x + w + 15}
              y={y + (figure.splitAfterRow * cell) / 2 + 6}
              fill={teal}
              fontSize="18"
            >
              A
            </text>
            <text
              x={x + w + 15}
              y={y + ((figure.splitAfterRow + figure.rows) * cell) / 2 + 6}
              fill={coral}
              fontSize="18"
            >
              B
            </text>
          </>
        )}
      </svg>
    );
  }
  const count = Math.ceil(figure.total / figure.groupSize),
    columns = Math.min(4, count),
    rows = Math.ceil(count / columns),
    boxWidth = 78,
    boxHeight = 70,
    gap = 12,
    left = (380 - (columns * boxWidth + (columns - 1) * gap)) / 2;
  return (
    <svg
      className="figure equal-groups-figure"
      viewBox={`0 0 380 ${rows * 88 + 32}`}
      role="img"
      aria-label={`${figure.total} ${figure.unit} arranged in boxes with room for ${figure.groupSize} each; outlined circles are empty places.`}
    >
      <text
        x="190"
        y={rows * 88 + 21}
        textAnchor="middle"
        style={{ fontSize: 20 }}
        fill={ink}
      >
        ● {figure.unit} · ○ empty place
      </text>
      {Array.from({ length: count }, (_, group) => {
        const x = left + (group % columns) * (boxWidth + gap),
          y = 10 + Math.floor(group / columns) * 88;
        return (
          <g key={group} data-group={group}>
            <rect
              x={x}
              y={y}
              width={boxWidth}
              height={boxHeight}
              rx="9"
              fill="#fffaf0"
              stroke={ink}
              strokeWidth="1.5"
            />
            {Array.from({ length: figure.groupSize }, (_, slot) => {
              const filled = group * figure.groupSize + slot < figure.total;
              return (
                <circle
                  key={slot}
                  data-group-slot={slot}
                  data-filled={filled ? "yes" : "no"}
                  cx={x + 15 + (slot % 4) * 16}
                  cy={y + 23 + Math.floor(slot / 4) * 25}
                  r="6"
                  fill={filled ? teal : "none"}
                  stroke={filled ? ink : "#799089"}
                  strokeWidth="1.2"
                  strokeDasharray={filled ? undefined : "2 2"}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
