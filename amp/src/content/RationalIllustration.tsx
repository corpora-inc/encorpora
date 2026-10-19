import React from "react";
import { PrintMathText } from "./PrintMathText";

export type RationalIllustrationKind =
  | "signed-fraction-number-line"
  | "complex-fraction-scaling"
  | "rational-power-ladder";
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
const svgStyle = {
  width: "100%",
  display: "block",
  margin: "0 auto",
  color: "inherit",
};

/** Twelfths from −1 to 1 at equal spacing: the move from −9/12 to 1/12 is 10 units. */
function NumberLine() {
  const left = 40,
    step = 560 / 24,
    x = (twelfths: number) => left + (twelfths + 12) * step,
    start = -9,
    end = 1;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="signed-fraction-number-line"
        data-unit="12"
        data-start={start}
        data-move={end - start}
        data-end={end}
        viewBox="0 0 640 200"
        role="img"
        aria-label="A number line from negative 1 to 1 marked in twelfths. An arrow starts at negative three quarters, which is negative nine twelfths, moves ten twelfths to the right and ends at one twelfth."
        style={{ ...svgStyle, maxWidth: 640 }}
      >
        <g fill="currentColor" fontFamily="inherit">
          <path
            d={`M ${x(-12)} 130 H ${x(12)}`}
            stroke="currentColor"
            strokeWidth="2"
          />
          {Array.from({ length: 25 }, (_, i) => i - 12).map((k) => (
            <path
              key={k}
              data-tick={k}
              d={`M ${x(k)} ${k % 12 === 0 ? 118 : 124} V ${k % 12 === 0 ? 142 : 136}`}
              stroke="currentColor"
              strokeWidth={k % 12 === 0 ? 2 : 1}
            />
          ))}
          {(
            [
              [-12, "−1"],
              [0, "0"],
              [12, "1"],
            ] as const
          ).map(([k, label]) => (
            <text
              key={k}
              data-label-at={k}
              x={x(k)}
              y="170"
              textAnchor="middle"
              style={{ fontSize: 20 }}
            >
              {label}
            </text>
          ))}
          <path
            data-move-arrow=""
            d={`M ${x(start)} 100 H ${x(end) - 2} m -9 -6 l 9 6 l -9 6`}
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
          />
          <text
            x={(x(start) + x(end)) / 2}
            y="86"
            textAnchor="middle"
            style={{ fontSize: 20 }}
          >
            +10/12
          </text>
          <circle data-point="start" cx={x(start)} cy="130" r="7" />
          <circle
            data-point="end"
            cx={x(end)}
            cy="130"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <text
            x={x(start)}
            y="40"
            textAnchor="middle"
            style={{ fontSize: 20 }}
          >
            −3/4 = −9/12
          </text>
          <text x={x(end) + 14} y="40" style={{ fontSize: 20 }}>
            1/12
          </text>
        </g>
      </svg>
      <figcaption style={captionStyle}>
        Each tick marks one twelfth. Adding 5/6, which is 10 twelfths, moves
        right from −9/12 past 0 to 1/12.
      </figcaption>
    </figure>
  );
}

/** Multiplying both parts by the reciprocal 3/4 changes the denominator to 1. */
function Scaling() {
  const rows = [
    ["Before", "$\\frac{5}{12}$", "$\\frac{4}{3}$"],
    ["Multiply both", "$\\times\\frac{3}{4}$", "$\\times\\frac{3}{4}$"],
    ["After", "$\\frac{5}{16}$", "$1$"],
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <table
        data-lesson-illustration="complex-fraction-scaling"
        data-numerator="5/12"
        data-denominator="4/3"
        data-multiplier="3/4"
        data-result="5/16"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "center",
        }}
      >
        <thead>
          <tr>
            <th style={{ fontSize: 16, padding: "10px 3px" }} />
            <th style={{ fontSize: 16, padding: "10px 3px" }}>Numerator</th>
            <th style={{ fontSize: 16, padding: "10px 3px" }}>Denominator</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, numerator, denominator], i) => (
            <tr key={label} data-operation-row={label}>
              <th
                scope="row"
                style={{
                  borderTop: "1px solid currentColor",
                  fontSize: 16,
                  fontWeight: 400,
                  padding: "14px 3px",
                  textAlign: "left",
                }}
              >
                {label}
              </th>
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
        The numerator and the denominator receive the same factor, 3/4, so the
        value is unchanged. The denominator becomes 1, leaving 5/16.
      </figcaption>
    </figure>
  );
}

/** Exact values of (8/27)^(k/3); each step down divides by the cube root 2/3. */
function Ladder() {
  const rows = [
    ["1", "8/27"],
    ["2/3", "4/9"],
    ["1/3", "2/3"],
    ["0", "1"],
    ["−1/3", "3/2"],
    ["−2/3", "9/4"],
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="rational-power-ladder"
        data-base="8/27"
        viewBox="0 0 400 456"
        role="img"
        aria-label="Powers of eight twenty-sevenths: exponents 1, two thirds, one third, 0, negative one third and negative two thirds have values eight twenty-sevenths, four ninths, two thirds, 1, three halves and nine fourths. Each step down divides the value by two thirds."
        style={{ ...svgStyle, maxWidth: 420 }}
      >
        <g fill="currentColor" fontFamily="inherit">
          <text style={{ fontSize: 26 }} x="12" y="32">
            Exponent
          </text>
          <text style={{ fontSize: 26 }} x="200" y="32">
            Value
          </text>
          {rows.map(([exponent, value], i) => (
            <g key={exponent} data-exponent={exponent} data-value={value}>
              <text
                style={{ fontSize: 26 }}
                x="74"
                y={88 + i * 68}
                textAnchor="middle"
              >
                {exponent}
              </text>
              <text
                style={{ fontSize: 26 }}
                x="242"
                y={88 + i * 68}
                textAnchor="middle"
              >
                {value}
              </text>
              {i < 5 && (
                <g>
                  <path
                    d={`M 296 ${85 + i * 68} v 48 m -5 -7 l 5 7 l 5 -7`}
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="2"
                  />
                  <text style={{ fontSize: 22 }} x="310" y={119 + i * 68}>
                    ÷ 2/3
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>
        <path
          d="M 10 44 H 388 M 166 10 V 438"
          stroke="currentColor"
          opacity=".3"
        />
      </svg>
      <figcaption style={captionStyle}>
        The base is 8/27 in every row. Lowering the exponent by 1/3 divides the
        value by 2/3, the cube root of 8/27.
      </figcaption>
    </figure>
  );
}

export function RationalIllustration({
  kind,
}: {
  kind: RationalIllustrationKind;
}) {
  if (kind === "signed-fraction-number-line") return <NumberLine />;
  if (kind === "complex-fraction-scaling") return <Scaling />;
  return <Ladder />;
}
