import React from "react";
import { PrintMathText } from "./PrintMathText";

export type RadicalIllustrationKind =
  | "radical-square-grid"
  | "radical-like-lengths"
  | "radical-product-grid"
  | "radical-rationalize";
/** Repeated cells and segments preserve the exact ratios of the stated root units. */
export function RadicalIllustration({
  kind,
}: {
  kind: RadicalIllustrationKind;
}) {
  const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
  const captionStyle = { marginTop: 12, lineHeight: 1.6 };
  if (kind === "radical-rationalize") {
    const rows = [
      ["Before", "2", "$\\sqrt{3}$"],
      ["Multiply both", "$\\times\\sqrt{3}$", "$\\times\\sqrt{3}$"],
      ["After", "$2\\sqrt{3}$", "3"],
    ];
    return (
      <figure className="lesson-illustration" style={figureStyle}>
        <table
          data-lesson-illustration={kind}
          data-numerator="2"
          data-denominator-radicand="3"
          data-multiplier-radicand="3"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "center",
          }}
        >
          <thead>
            <tr>
              <th style={{ fontSize: 16, padding: "10px 3px" }}>Numerator</th>
              <th style={{ fontSize: 16, padding: "10px 3px" }}>Denominator</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, numerator, denominator], i) => (
              <tr key={label} data-operation-row={label} aria-label={label}>
                {[numerator!, denominator!].map((value, column) => (
                  <td
                    key={column}
                    data-column={column === 0 ? "numerator" : "denominator"}
                    style={{
                      borderTop: "1px solid currentColor",
                      padding: "14px 3px",
                      fontSize: 22,
                      lineHeight: 1.8,
                      fontWeight: i === 2 ? 600 : 400,
                    }}
                  >
                    <PrintMathText text={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <figcaption style={captionStyle}>
          <PrintMathText
            text={
              "Both parts receive the same factor: $\\frac{2}{\\sqrt{3}} = \\frac{2\\sqrt{3}}{3}$. The multiplying fraction $\\frac{\\sqrt{3}}{\\sqrt{3}}$ equals 1."
            }
          />
        </figcaption>
      </figure>
    );
  }
  const isLengths = kind === "radical-like-lengths",
    isProduct = kind === "radical-product-grid";
  const rows = isProduct ? 4 : 3,
    columns = 3,
    cell = isProduct ? 48 : 60;
  const x = isProduct ? 108 : 90,
    y = 60;
  const label = { fontSize: 26, fill: "currentColor" };
  const caption = isLengths
    ? "Every segment has length $\\sqrt{2}$ units. Three segments and two segments give five segments: $3\\sqrt{2} + 2\\sqrt{2} = 5\\sqrt{2}$."
    : isProduct
      ? "Each small square has area 2 square units and side length $\\sqrt{2}$ units. Three columns and four rows give sides $3\\sqrt{2}$ and $4\\sqrt{2}$, and total area 24 square units."
      : "Each small square has area 2 square units and side length $\\sqrt{2}$ units. Nine squares have total area 18 square units. The large square's side is $3\\sqrt{2}$ units.";
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        viewBox="0 0 360 330"
        role="img"
        aria-label={
          isLengths
            ? "Three equal root-two lengths and two equal root-two lengths combine to five equal lengths."
            : `${rows} rows and ${columns} columns of equal squares. Each cell has area 2; the whole area is ${rows * columns * 2}.`
        }
        data-lesson-illustration={kind}
        data-cell-area={isLengths ? undefined : 2}
        data-grid-rows={isLengths ? undefined : rows}
        data-grid-columns={isLengths ? undefined : columns}
        data-origin-x={x}
        data-origin-y={y}
        data-cell-pixels={cell}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          margin: "0 auto",
          color: "inherit",
        }}
      >
        <defs>
          <pattern
            id={`${kind}-hatch`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 10L10 0"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".18"
            />
          </pattern>
        </defs>
        {isLengths ? (
          <>
            <text x="180" y="30" textAnchor="middle" style={label}>
              Equal root-length units
            </text>
            {[3, 2, 5].map((count, row) => (
              <g
                key={row}
                data-length-row={row}
                data-unit-radicand="2"
                data-count={count}
                data-unit-pixels="44"
                data-start-x="100"
              >
                <text x="78" y={88 + row * 90} textAnchor="end" style={label}>
                  {count}
                </text>
                {Array.from({ length: count }, (_, column) => (
                  <rect
                    key={column}
                    data-length-segment={column}
                    x={100 + 44 * column}
                    y={65 + row * 90}
                    width="44"
                    height="30"
                    fill={`url(#${kind}-hatch)`}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                ))}
              </g>
            ))}
            <text x="78" y="125" textAnchor="end" style={label}>
              +
            </text>
            <text x="78" y="215" textAnchor="end" style={label}>
              =
            </text>
          </>
        ) : (
          <>
            <text x="180" y="30" textAnchor="middle" style={label}>
              Total area: {rows * columns * 2} square units
            </text>
            {Array.from({ length: rows }, (_, row) =>
              Array.from({ length: columns }, (_, column) => (
                <g key={`${row}-${column}`}>
                  <rect
                    data-area-cell={`${row},${column}`}
                    data-area="2"
                    x={x + column * cell}
                    y={y + row * cell}
                    width={cell}
                    height={cell}
                    fill={`url(#${kind}-hatch)`}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <text
                    x={x + (column + 0.5) * cell}
                    y={y + (row + 0.5) * cell + 9}
                    textAnchor="middle"
                    style={label}
                  >
                    2
                  </text>
                </g>
              )),
            )}
            <line
              x1={x}
              x2={x + columns * cell}
              y1="275"
              y2="275"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1={x}
              x2={x}
              y1="269"
              y2="281"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1={x + columns * cell}
              x2={x + columns * cell}
              y1="269"
              y2="281"
              stroke="currentColor"
              strokeWidth="2"
            />
            <text x="180" y="310" textAnchor="middle" style={label}>
              3 columns
            </text>
            {isProduct && (
              <>
                <line
                  x1="85"
                  x2="85"
                  y1={y}
                  y2={y + rows * cell}
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <text x="51" y="155" textAnchor="middle" style={label}>
                  4
                </text>
                <text
                  x="51"
                  y="184"
                  textAnchor="middle"
                  style={{ ...label, fontSize: 23 }}
                >
                  rows
                </text>
              </>
            )}
          </>
        )}
      </svg>
      <figcaption style={captionStyle}>
        <PrintMathText text={caption} />
      </figcaption>
    </figure>
  );
}
