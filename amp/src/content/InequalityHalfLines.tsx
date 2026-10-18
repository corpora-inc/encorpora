import React from "react";

/** Equal one-unit intervals; the boundary 2 is deliberately shared by all four sets. */
export function InequalityHalfLines() {
  const x = (n: number) => 34 + (n + 2) * 41.5;
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: "12px",
        }}
      >
        {[
          { sign: "<", left: true, filled: false },
          { sign: "≤", left: true, filled: true },
          { sign: ">", left: false, filled: false },
          { sign: "≥", left: false, filled: true },
        ].map((row) => {
          const y = 51;
          return (
            <svg
              key={row.sign}
              data-relation={row.sign}
              data-lesson-illustration="inequality-half-lines"
              viewBox="0 0 400 100"
              role="img"
              aria-label={`x ${row.sign} 2: the solution extends ${row.left ? "left" : "right"} from ${row.filled ? "a filled" : "an open"} circle at 2. Equal tick intervals represent one unit.`}
              style={{
                display: "block",
                width: "100%",
                maxWidth: "420px",
                margin: "0 auto",
              }}
            >
              <title>{`x ${row.sign} 2`}</title>
              <text
                x="16"
                y={y - 22}
                fill="#18332f"
                style={{ font: "24px Arial, sans-serif" }}
              >
                x {row.sign} 2
              </text>
              <line
                x1="18"
                x2="382"
                y1={y}
                y2={y}
                stroke="#788a89"
                strokeWidth="1.5"
              />
              <path
                d={`M 25 ${y - 4} L 18 ${y} L 25 ${y + 4} M 375 ${y - 4} L 382 ${y} L 375 ${y + 4}`}
                fill="none"
                stroke="#788a89"
                strokeWidth="1.5"
              />
              {Array.from({ length: 9 }, (_, j) => j - 2).map((n) => (
                <g key={n}>
                  <line
                    x1={x(n)}
                    x2={x(n)}
                    y1={y - 4}
                    y2={y + 5}
                    stroke="#18332f"
                  />
                  {n % 2 === 0 && (
                    <text
                      x={x(n)}
                      y={y + 31}
                      textAnchor="middle"
                      fill="#18332f"
                      style={{ font: "24px Arial, sans-serif" }}
                    >
                      {n < 0 ? `−${-n}` : n}
                    </text>
                  )}
                </g>
              ))}
              <line
                data-solution-ray="true"
                x1={row.left ? 18 : x(2)}
                x2={row.left ? x(2) : 382}
                y1={y}
                y2={y}
                stroke="#18332f"
                strokeWidth="5"
              />
              <path
                d={
                  row.left
                    ? `M 29 ${y - 8} L 18 ${y} L 29 ${y + 8}`
                    : `M 371 ${y - 8} L 382 ${y} L 371 ${y + 8}`
                }
                fill="none"
                stroke="#18332f"
                strokeWidth="4"
              />
              <circle
                data-boundary="2"
                data-included={row.filled}
                cx={x(2)}
                cy={y}
                r="7"
                fill={row.filled ? "#18332f" : "#fff"}
                stroke="#18332f"
                strokeWidth="2.5"
              />
            </svg>
          );
        })}
      </div>
      <figcaption
        style={{ marginTop: "10px", fontSize: "0.95em", lineHeight: 1.6 }}
      >
        The thick ray marks all solutions and continues in the arrow’s
        direction. An open circle excludes 2; a filled circle includes 2. Each
        interval between neighboring ticks represents one unit.
      </figcaption>
    </figure>
  );
}
