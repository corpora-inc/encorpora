import React from "react";
import { PrintMathText } from "./PrintMathText";

export type RealNumberIllustrationKind =
  | "repeating-decimal-shift"
  | "root-zoom"
  | "root-solutions"
  | "decimal-point-shift"
  | "scientific-regroup";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
const label = { fontSize: 17, fill: "currentColor" } as const;
const accent = "var(--color-figure-accent, currentColor)";
const warm = "var(--color-figure-warm, currentColor)";

/** Fixed teaching models drawn to scale; data attributes let an independent reviewer recheck them. */
export function RealNumberIllustration({
  kind,
}: {
  kind: RealNumberIllustrationKind;
}) {
  if (kind === "repeating-decimal-shift") return <RepeatingShift />;
  if (kind === "root-zoom") return <RootZoom />;
  if (kind === "root-solutions") return <RootSolutions />;
  if (kind === "decimal-point-shift") return <DecimalPointShift />;
  return <ScientificRegroup />;
}

function RepeatingShift() {
  // Each row: label, digits before the point, digits after it, whether the tail continues.
  const rows = [
    ["100x", "27", "272727", true],
    ["x", "0", "272727", true],
    ["99x", "27", "000000", false],
  ] as const;
  const cell = {
    padding: "8px 0",
    fontSize: 20,
    whiteSpace: "nowrap" as const,
    fontVariantNumeric: "tabular-nums" as const,
    width: "0.9em",
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <table
        data-lesson-illustration="repeating-decimal-shift"
        data-block="27"
        data-multiplier="100"
        aria-label="100x equals 27.272727 and so on; x equals 0.272727 and so on. The digits after the decimal point match, so subtracting gives 99x = 27."
        style={{ margin: "0 auto", borderCollapse: "collapse" }}
      >
        <tbody>
          {rows.map(([name, whole, tail, more], i) => (
            <tr
              key={name}
              data-row={name}
              data-value={`${whole}.${tail}`}
              style={i === 2 ? { borderTop: "2px solid currentColor" } : {}}
            >
              <th
                scope="row"
                style={{
                  ...cell,
                  width: "auto",
                  paddingRight: 12,
                  textAlign: "right",
                }}
              >
                {i === 1 ? "− x" : name}
              </th>
              <td style={{ ...cell, paddingRight: 8 }}>=</td>
              {whole
                .padStart(2, " ")
                .split("")
                .map((d, j) => (
                  <td key={`w${j}`} style={{ ...cell, textAlign: "center" }}>
                    {d.trim()}
                  </td>
                ))}
              <td style={{ ...cell, textAlign: "center", width: "0.5em" }}>
                .
              </td>
              {tail.split("").map((d, j) => (
                <td
                  key={`t${j}`}
                  style={{
                    ...cell,
                    textAlign: "center",
                    fontWeight: i < 2 ? 600 : 400,
                    borderBottom:
                      i < 2 ? `3px solid ${accent}` : "3px solid transparent",
                  }}
                >
                  {d}
                </td>
              ))}
              <td style={{ ...cell, width: "1.4em", textAlign: "left" }}>
                {more ? "…" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption style={captionStyle}>
        <PrintMathText text="Multiplying by 100 moves each digit two places left, so $100x$ and $x$ have the same underlined tail. Subtracting cancels it: $99x = 27$, and $x = \frac{27}{99} = \frac{3}{11}$." />
      </figcaption>
    </figure>
  );
}

/** A number line maps a value v to x0 + (v − min) / (max − min) × (x1 − x0). */
function RootZoom() {
  const top = { y: 64, x0: 40, x1: 400, min: 4, max: 5 },
    bottom = { y: 214, x0: 40, x1: 400, min: 4.4, max: 4.5 };
  const at = (line: typeof top, v: number) =>
    line.x0 + ((v - line.min) / (line.max - line.min)) * (line.x1 - line.x0);
  const root = Math.sqrt(20);
  const topTicks = Array.from({ length: 11 }, (_, i) => 4 + i / 10);
  const bottomTicks = Array.from({ length: 11 }, (_, i) => 4.4 + i / 100);
  const topLabels = [
    ["4", "16"],
    ["4.4", ""],
    ["4.5", ""],
    ["5", "25"],
  ] as const;
  const bottomLabels = [
    ["4.4", "19.36"],
    ["4.45", "19.8025"],
    ["4.5", "20.25"],
  ] as const;
  const line = (l: typeof top) => (
    <line
      x1={l.x0}
      x2={l.x1}
      y1={l.y}
      y2={l.y}
      stroke="currentColor"
      strokeWidth="2"
      data-line={l === top ? "top" : "bottom"}
      data-number-line={`${l.min},${l.max}`}
      data-x0={l.x0}
      data-x1={l.x1}
    />
  );
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="root-zoom"
        viewBox="0 0 440 260"
        role="img"
        aria-label="Top: a number line from 4 to 5 in tenths. 4 squared is 16 and 5 squared is 25, and the square root of 20 lies between 4.4 and 4.5, at about 4.47. Bottom: the interval from 4.4 to 4.5 enlarged. 4.4 squared is 19.36, 4.45 squared is 19.8025 and 4.5 squared is 20.25; the square root of 20 lies past 4.45."
        style={svgStyle}
      >
        <title>Zoom from whole numbers to tenths</title>
        <rect
          x={at(top, 4.4)}
          y={top.y - 6}
          width={at(top, 4.5) - at(top, 4.4)}
          height="12"
          fill={accent}
          opacity="0.25"
        />
        {line(top)}
        {topTicks.map((v) => (
          <line
            key={v}
            x1={at(top, v)}
            x2={at(top, v)}
            y1={top.y - 6}
            y2={top.y + 6}
            stroke="currentColor"
          />
        ))}
        {topLabels.map(([v, square]) => (
          <g
            key={v}
            data-line="top"
            data-tick={v}
            data-square={square || undefined}
          >
            <text
              x={at(top, Number(v))}
              y={top.y - 14}
              textAnchor="middle"
              style={label}
            >
              {v}
            </text>
            {square && (
              <text
                x={at(top, Number(v))}
                y={top.y + 30}
                textAnchor="middle"
                style={{ ...label, fontSize: 15 }}
              >
                {`${v}² = ${square}`}
              </text>
            )}
          </g>
        ))}
        <g data-line="top" data-root="20" data-x={at(top, root).toFixed(2)}>
          <circle cx={at(top, root)} cy={top.y} r="5" fill={warm} />
          <text
            x={at(top, root)}
            y={top.y + 30}
            textAnchor="middle"
            style={{ ...label, fontWeight: 700 }}
          >
            √20
          </text>
        </g>
        {[4.4, 4.5].map((v, i) => (
          <line
            key={v}
            x1={at(top, v)}
            y1={top.y + 8}
            x2={i ? bottom.x1 : bottom.x0}
            y2={bottom.y - 34}
            stroke="currentColor"
            strokeDasharray="4 5"
            opacity="0.7"
          />
        ))}
        {line(bottom)}
        {bottomTicks.map((v, i) => (
          <line
            key={i}
            x1={at(bottom, v)}
            x2={at(bottom, v)}
            y1={bottom.y - (i % 5 ? 5 : 9)}
            y2={bottom.y + (i % 5 ? 5 : 9)}
            stroke="currentColor"
          />
        ))}
        {bottomLabels.map(([v, square]) => (
          <g key={v} data-line="bottom" data-tick={v} data-square={square}>
            <text
              x={at(bottom, Number(v))}
              y={bottom.y - 16}
              textAnchor="middle"
              style={label}
            >
              {v}
            </text>
            <text
              x={at(bottom, Number(v))}
              y={bottom.y + 32}
              textAnchor={
                v === "4.4" ? "start" : v === "4.5" ? "end" : "middle"
              }
              style={{ ...label, fontSize: 15 }}
            >
              {`${v}² = ${square}`}
            </text>
          </g>
        ))}
        <g
          data-line="bottom"
          data-root="20"
          data-x={at(bottom, root).toFixed(2)}
        >
          <circle cx={at(bottom, root)} cy={bottom.y} r="6" fill={warm} />
          <text
            x={at(bottom, root)}
            y={bottom.y - 16}
            textAnchor="middle"
            style={{ ...label, fontWeight: 700 }}
          >
            √20
          </text>
        </g>
      </svg>
      <figcaption style={captionStyle}>
        <PrintMathText text="Both lines are drawn to scale. On the top line, $16 < 20 < 25$ places $\sqrt{20}$ between 4 and 5. Enlarging the interval from 4.4 to 4.5: $19.8025 < 20 < 20.25$, so $\sqrt{20}$ is between 4.45 and 4.5 and rounds to 4.5." />
      </figcaption>
    </figure>
  );
}

function RootSolutions() {
  const panels = [
    {
      title: "x² = 49",
      power: 2,
      target: 49,
      min: -8,
      max: 8,
      inputs: [-7, 7],
    },
    {
      title: "x³ = −64",
      power: 3,
      target: -64,
      min: -5,
      max: 5,
      inputs: [-4, 4],
    },
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="root-solutions"
        viewBox="0 0 440 250"
        role="img"
        aria-label="Left: squaring sends both −7 and 7 to 49, so x² = 49 has two solutions. Right: cubing sends −4 to −64 and 4 to 64, so x³ = −64 has the one solution −4."
        style={svgStyle}
      >
        <title>Two square roots, one cube root</title>
        {panels.map((panel, p) => {
          const x0 = p ? 240 : 20,
            x1 = p ? 420 : 200,
            at = (v: number) =>
              x0 + ((v - panel.min) / (panel.max - panel.min)) * (x1 - x0);
          const outputs = [
            ...new Set(panel.inputs.map((v) => v ** panel.power)),
          ];
          const outX = (o: number) =>
            outputs.length === 1 ? (x0 + x1) / 2 : o < 0 ? x0 + 30 : x1 - 30;
          return (
            <g key={panel.title}>
              <text
                x={(x0 + x1) / 2}
                y="26"
                textAnchor="middle"
                style={{ ...label, fontWeight: 700 }}
              >
                {panel.title}
              </text>
              <line
                x1={x0}
                x2={x1}
                y1="80"
                y2="80"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1={at(0)}
                x2={at(0)}
                y1="74"
                y2="86"
                stroke="currentColor"
              />
              <text
                x={at(0)}
                y="104"
                textAnchor="middle"
                style={{ ...label, fontSize: 14 }}
              >
                0
              </text>
              {panel.inputs.map((v) => {
                const output = v ** panel.power,
                  solves = output === panel.target;
                return (
                  <g
                    key={v}
                    data-input={v}
                    data-power={panel.power}
                    data-output={output}
                    data-solution={solves ? "true" : "false"}
                  >
                    <circle
                      cx={at(v)}
                      cy="80"
                      r="6"
                      fill={solves ? warm : "none"}
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <text
                      x={at(v)}
                      y="64"
                      textAnchor="middle"
                      style={{ ...label, fontWeight: solves ? 700 : 400 }}
                    >
                      {String(v).replace("-", "−")}
                    </text>
                    <line
                      x1={at(v)}
                      y1="90"
                      x2={outX(output)}
                      y2="178"
                      stroke="currentColor"
                      strokeWidth={solves ? 2.5 : 1.5}
                      strokeDasharray={solves ? undefined : "5 5"}
                      markerEnd="url(#real-number-arrow)"
                    />
                  </g>
                );
              })}
              {outputs.map((o) => (
                <g key={o}>
                  <rect
                    x={outX(o) - 28}
                    y="186"
                    width="56"
                    height="32"
                    rx="6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={o === panel.target ? 2.5 : 1}
                  />
                  <text
                    x={outX(o)}
                    y="208"
                    textAnchor="middle"
                    style={{
                      ...label,
                      fontWeight: o === panel.target ? 700 : 400,
                    }}
                  >
                    {String(o).replace("-", "−")}
                  </text>
                </g>
              ))}
              <text
                x={(x0 + x1) / 2}
                y="242"
                textAnchor="middle"
                style={{ ...label, fontSize: 14 }}
              >
                {panel.power === 2 ? "square each input" : "cube each input"}
              </text>
            </g>
          );
        })}
        <defs>
          <marker
            id="real-number-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <figcaption style={captionStyle}>
        <PrintMathText text="Squaring sends 7 and −7 to the same output, 49, so $x^2 = 49$ has two solutions. Cubing keeps the sign: only −4 reaches −64, so $x^3 = -64$ has one solution." />
      </figcaption>
    </figure>
  );
}

function DecimalPointShift() {
  const places = [5, 4, 3, 2, 1, 0, -1, -2];
  const width = 44,
    left = 84;
  const column = (place: number) => left + (5 - place) * width + width / 2;
  const sup = (n: number) =>
    String(n)
      .replace("-", "⁻")
      .replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]!);
  const rows = [
    {
      name: "3.07",
      y: 96,
      digits: [
        [0, "3"],
        [-1, "0"],
        [-2, "7"],
      ],
      fill: [] as number[],
    },
    {
      name: "307,000",
      y: 206,
      digits: [
        [5, "3"],
        [4, "0"],
        [3, "7"],
      ],
      fill: [2, 1, 0],
    },
  ] as const;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="decimal-point-shift"
        data-exponent="5"
        viewBox="0 0 440 240"
        role="img"
        aria-label="A place-value chart from 10 to the 5th down to 10 to the minus 2nd. The digits 3, 0, 7 of 3.07 sit in the ones, tenths and hundredths places. Multiplying by 10 to the 5th moves each digit 5 places left, to the hundred-thousands, ten-thousands and thousands places; zeros fill the hundreds, tens and ones: 307,000."
        style={svgStyle}
      >
        <title>Multiplying by 10⁵ moves every digit 5 places</title>
        {places.map((place) => (
          <g key={place}>
            <text
              x={column(place)}
              y="28"
              textAnchor="middle"
              style={{ ...label, fontSize: 15 }}
            >
              {`10${sup(place)}`}
            </text>
            <line
              x1={column(place) - width / 2}
              x2={column(place) - width / 2}
              y1="40"
              y2="226"
              stroke="currentColor"
              opacity="0.25"
            />
          </g>
        ))}
        {rows.map((row) => (
          <g key={row.name} data-row={row.name}>
            <text x="8" y={row.y + 8} style={{ ...label, fontSize: 15 }}>
              {row.name}
            </text>
            {row.digits.map(([place, digit]) => (
              <text
                key={place}
                data-place={place}
                data-digit={digit}
                x={column(place)}
                y={row.y + 8}
                textAnchor="middle"
                style={{ ...label, fontSize: 26, fontWeight: 700 }}
              >
                {digit}
              </text>
            ))}
            {row.fill.map((place) => (
              <text
                key={place}
                data-place={place}
                data-digit="0"
                data-fill="true"
                x={column(place)}
                y={row.y + 8}
                textAnchor="middle"
                style={{ ...label, fontSize: 26, opacity: 0.55 }}
              >
                0
              </text>
            ))}
            <circle
              data-point="after-ones"
              cx={column(0) + width / 2}
              cy={row.y + 8}
              r="3.5"
              fill={warm}
            />
          </g>
        ))}
        {rows[0].digits.map(([place]) => (
          <line
            key={place}
            x1={column(place)}
            y1={rows[0].y + 18}
            x2={column(place + 5) + 4}
            y2={rows[1].y - 24}
            stroke={accent}
            strokeWidth="2"
            markerEnd="url(#real-number-shift)"
          />
        ))}
        <text x="8" y="156" style={{ ...label, fontSize: 15 }}>
          × 10⁵
        </text>
        <defs>
          <marker
            id="real-number-shift"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={accent} />
          </marker>
        </defs>
      </svg>
      <figcaption style={captionStyle}>
        <PrintMathText text="The digits 3, 0 and 7 keep their order. Multiplying by $10^{5}$ moves each one 5 places to the left; zeros fill the empty places: $3.07 \times 10^{5} = 307{,}000$. Seen from the digits, the decimal point has moved 5 places to the right." />
      </figcaption>
    </figure>
  );
}

function ScientificRegroup() {
  const rows = [
    ["Regroup", "$3 \\times 4$", "$10^{4} \\times 10^{6}$", "12", "10"],
    ["Multiply", "12", "$10^{10}$", "12", "10"],
    ["Adjust", "1.2", "$10^{11}$", "1.2", "11"],
  ] as const;
  const cell = {
    borderTop: "1px solid currentColor",
    padding: "12px 4px",
    fontSize: 20,
    lineHeight: 1.8,
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <table
        data-lesson-illustration="scientific-regroup"
        data-product="3e4*4e6"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "center",
        }}
      >
        <thead>
          <tr>
            <th style={{ fontSize: 15, padding: "8px 4px" }}>Step</th>
            <th style={{ fontSize: 15, padding: "8px 4px" }}>Coefficient</th>
            <th style={{ fontSize: 15, padding: "8px 4px" }}>Power of 10</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([step, coefficient, power, value, exponent], i) => (
            <tr
              key={step}
              data-step={step}
              data-coefficient={value}
              data-exponent={exponent}
            >
              <th
                scope="row"
                style={{ ...cell, fontSize: 15, fontWeight: 600 }}
              >
                {step}
              </th>
              <td style={{ ...cell, fontWeight: i === 2 ? 700 : 400 }}>
                <PrintMathText text={coefficient} />
              </td>
              <td style={{ ...cell, fontWeight: i === 2 ? 700 : 400 }}>
                <PrintMathText text={power} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption style={captionStyle}>
        <PrintMathText text="$(3 \times 10^{4}) \times (4 \times 10^{6})$: coefficients multiply and exponents add. Rewriting $12 = 1.2 \times 10$ moves one factor of 10 into the power, so the value is unchanged: $1.2 \times 10^{11}$." />
      </figcaption>
    </figure>
  );
}
