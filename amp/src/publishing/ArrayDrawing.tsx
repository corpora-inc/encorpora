import React from "react";
import type { Diagram } from "./schema.js";
/** Disjoint unit cells; borders and split lines retain meaning in grayscale. */
export function ArrayDrawing({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "array" }>;
}) {
  const cell = Math.min(38, 420 / d.columns, 240 / d.rows);
  const x = (600 - cell * d.columns) / 2,
    y = 52;
  return (
    <g>
      <text x={300} y={25} textAnchor="middle" fontSize={18}>
        {d.columnLabel}
      </text>
      <text
        transform={`translate(28 ${y + (d.rows * cell) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={18}
      >
        {d.rowLabel}
      </text>
      {Array.from({ length: d.rows }, (_, row) =>
        Array.from({ length: d.columns }, (_, column) => {
          const right =
            d.splitAfterColumn !== undefined && column >= d.splitAfterColumn;
          const lower = d.splitAfterRow !== undefined && row >= d.splitAfterRow;
          return (
            <rect
              key={`${row}-${column}`}
              data-array-row={row}
              data-array-column={column}
              data-array-region={`${Number(lower)}${Number(right)}`}
              x={x + column * cell}
              y={y + row * cell}
              width={cell}
              height={cell}
              fill={
                right
                  ? lower
                    ? "#f5dfc5"
                    : "#fbefd8"
                  : lower
                    ? "#c5ded6"
                    : "#e3efe9"
              }
              stroke="#16483f"
              strokeWidth={1}
            />
          );
        }),
      )}
      {d.splitAfterColumn !== undefined && (
        <line
          data-array-split="column"
          x1={x + d.splitAfterColumn * cell}
          x2={x + d.splitAfterColumn * cell}
          y1={y - 7}
          y2={y + d.rows * cell + 7}
          stroke="#16483f"
          strokeWidth={3}
          strokeDasharray="6 3"
        />
      )}
      {d.splitAfterRow !== undefined && (
        <line
          data-array-split="row"
          x1={x - 7}
          x2={x + d.columns * cell + 7}
          y1={y + d.splitAfterRow * cell}
          y2={y + d.splitAfterRow * cell}
          stroke="#16483f"
          strokeWidth={3}
          strokeDasharray="6 3"
        />
      )}
    </g>
  );
}
