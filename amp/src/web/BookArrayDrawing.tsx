import { useId } from "react";
import type { Diagram } from "../publishing/schema.js";
import { validateDiagram } from "../publishing/validate.js";
/** HTML labels retain reading size while the exact cell geometry scales. */
export function BookArrayDrawing({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "array" }>;
}) {
  const prefix = `array-${useId().replace(/[^a-z0-9]/gi, "")}`;
  validateDiagram(d);
  const cell = Math.min(28, 280 / d.columns, 200 / d.rows),
    x = (320 - d.columns * cell) / 2,
    y = 10,
    height = 20 + d.rows * cell;
  return (
    <>
      <p className="model-unit">
        {d.rowLabel} · {d.columnLabel}
      </p>
      <svg viewBox={`0 0 320 ${height}`} aria-hidden="true">
        <defs>
          {[0, 1, 2, 3].map((region) => (
            <pattern
              key={region}
              id={`${prefix}-${region}`}
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={8}
                height={8}
                fill={["#e3efe9", "#fbefd8", "#c5ded6", "#f5dfc5"][region]}
              />
              {(region & 1) !== 0 && (
                <path
                  d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6"
                  fill="none"
                  stroke="#64887d"
                  strokeWidth={0.8}
                />
              )}
              {(region & 2) !== 0 && (
                <circle cx={4} cy={4} r={0.8} fill="#18594f" />
              )}
            </pattern>
          ))}
        </defs>
        {Array.from({ length: d.rows }, (_, row) =>
          Array.from({ length: d.columns }, (_, column) => {
            const region =
              (d.splitAfterRow !== undefined && row >= d.splitAfterRow
                ? 2
                : 0) +
              (d.splitAfterColumn !== undefined && column >= d.splitAfterColumn
                ? 1
                : 0);
            return (
              <rect
                key={`${row}-${column}`}
                data-array-row={row}
                data-array-column={column}
                data-array-region={region}
                x={x + column * cell}
                y={y + row * cell}
                width={cell}
                height={cell}
                fill={`url(#${prefix}-${region})`}
                stroke="#18594f"
                strokeWidth={0.8}
              />
            );
          }),
        )}
        {d.splitAfterColumn !== undefined && (
          <line
            x1={x + d.splitAfterColumn * cell}
            x2={x + d.splitAfterColumn * cell}
            y1={y - 5}
            y2={y + d.rows * cell + 5}
            stroke="#18594f"
            strokeWidth={2.5}
            strokeDasharray="5 3"
          />
        )}
        {d.splitAfterRow !== undefined && (
          <line
            x1={x - 5}
            x2={x + d.columns * cell + 5}
            y1={y + d.splitAfterRow * cell}
            y2={y + d.splitAfterRow * cell}
            stroke="#18594f"
            strokeWidth={2.5}
            strokeDasharray="5 3"
          />
        )}
      </svg>
    </>
  );
}
