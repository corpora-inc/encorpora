import React from "react";

type Term = [number, number];
const text = ([c, p]: Term) =>
  `${c < 0 ? "−" : ""}${Math.abs(c) === 1 && p ? "" : Math.abs(c)}${["", "x", "x²"][p]}`;
/** Algebraic product tables: dimensions organize terms, not physical lengths. */
export function FactoringIllustration({
  kind,
}: {
  kind: "gcf" | "monic" | "nonmonic";
}) {
  const rows: Term[] =
    kind === "gcf"
      ? [[3, 1]]
      : kind === "monic"
        ? [
            [1, 1],
            [2, 0],
          ]
        : [
            [3, 1],
            [1, 0],
          ];
  const columns: Term[] =
    kind === "gcf"
      ? [
          [2, 1],
          [3, 0],
        ]
      : kind === "monic"
        ? [
            [1, 1],
            [3, 0],
          ]
        : [
            [2, 1],
            [3, 0],
          ];
  const bottom = rows.length === 1 ? 160 : 240;
  const font = { font: "26px Arial, sans-serif", fill: "#18332f" };
  const description =
    kind === "gcf"
      ? "One row labeled 3x and columns labeled 2x and 3. The products are 6x squared and 9x."
      : kind === "monic"
        ? "Rows x and 2; columns x and 3. Products x squared, 3x, 2x, and 6. Combining 3x and 2x gives 5x."
        : "Rows 3x and 1; columns 2x and 3. Products 6x squared, 9x, 2x, and 3. Combining 9x and 2x gives 11x.";
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <svg
        data-lesson-illustration={`factoring-${kind}`}
        data-factor-table={kind}
        viewBox={`0 0 400 ${bottom + 65}`}
        role="img"
        aria-label={description}
        style={{
          width: "100%",
          maxWidth: 440,
          display: "block",
          margin: "0 auto",
        }}
      >
        <title>Multiply each row term by each column term</title>
        <text x="60" y="55" textAnchor="middle" style={font}>
          ×
        </text>
        {columns.map((value, col) => (
          <text
            key={col}
            data-column={col}
            data-coefficient={value[0]}
            data-exponent={value[1]}
            x={175 + 130 * col}
            y="55"
            textAnchor="middle"
            style={font}
          >
            {text(value)}
          </text>
        ))}
        <rect
          x="110"
          y="80"
          width="260"
          height={bottom - 80}
          fill="#fff"
          stroke="#18332f"
          strokeWidth="2"
        />
        <line x1="240" x2="240" y1="80" y2={bottom} stroke="#18332f" />
        {rows.length === 2 && (
          <line x1="110" x2="370" y1="160" y2="160" stroke="#18332f" />
        )}
        {rows.map((value, row) => (
          <React.Fragment key={row}>
            <text
              data-row={row}
              data-coefficient={value[0]}
              data-exponent={value[1]}
              x="60"
              y={129 + 80 * row}
              textAnchor="middle"
              style={font}
            >
              {text(value)}
            </text>
            {columns.map((other, col) => {
              const valueProduct: Term = [
                value[0] * other[0],
                value[1] + other[1],
              ];
              return (
                <text
                  key={col}
                  data-product={`${row},${col}`}
                  data-coefficient={valueProduct[0]}
                  data-exponent={valueProduct[1]}
                  x={175 + 130 * col}
                  y={129 + 80 * row}
                  textAnchor="middle"
                  style={font}
                >
                  {text(valueProduct)}
                </text>
              );
            })}
          </React.Fragment>
        ))}
        <text x="200" y={bottom + 45} textAnchor="middle" style={font}>
          {kind === "gcf"
            ? "Sum: 6x² + 9x"
            : kind === "monic"
              ? "3x + 2x = 5x"
              : "9x + 2x = 11x"}
        </text>
      </svg>
      <figcaption>
        {description} The table shows multiplication of algebraic terms; its
        cell sizes do not represent numerical lengths or areas.
      </figcaption>
    </figure>
  );
}
