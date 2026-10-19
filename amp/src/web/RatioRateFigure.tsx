import type { ReactNode } from "react";
import {
  rateLinePositions,
  type DoubleNumberLineFigure,
  type RatioRateFigure as Figure,
  type RatioTableFigure,
} from "../math/ratio-rate-models.js";

/* Fallbacks keep print copies, which carry no theme tokens, legible. */
const ink = "var(--color-figure-ink, #174a43)",
  axis = "var(--color-figure-axis, #6f8a7d)",
  accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  paper = "var(--color-figure-paper, #fffdf7)",
  sunken = "var(--color-figure-empty, #f6f2e8)";
const text = (size: number, color = ink, weight = 500) => ({
  fontSize: size,
  fill: color,
  fontWeight: weight,
  fontFamily: "inherit",
});

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Reduced numerator and denominator of n/d. */
export function reduced(n: number, d: number): [number, number] {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}
export const valueText = (n: number, d: number) => {
  const [a, b] = reduced(n, d);
  return b === 1 ? String(a) : `${a}/${b}`;
};

/** A typeset value centred at (x, cy): a whole number, a stacked fraction
 * with a bar, or the marked unknown. */
export function FigureValue({
  n,
  d,
  x,
  cy,
  size = 17,
  color = ink,
}: {
  n: number | null;
  d: number;
  x: number;
  cy: number;
  size?: number;
  color?: string;
}): ReactNode {
  if (n === null)
    return (
      <g data-unknown="true">
        <rect
          x={x - 14}
          y={cy - size / 2 - 5}
          width="28"
          height={size + 10}
          rx="6"
          fill={accentFill}
          stroke={accent}
          strokeWidth="1.5"
        />
        <text
          x={x}
          y={cy + size * 0.36}
          textAnchor="middle"
          style={text(size, accent, 700)}
        >
          ?
        </text>
      </g>
    );
  const [a, b] = reduced(n, d);
  if (b === 1)
    return (
      <text
        x={x}
        y={cy + size * 0.36}
        textAnchor="middle"
        style={text(size, color)}
      >
        {a}
      </text>
    );
  const small = Math.round(size * 0.8),
    half = Math.max(String(a).length, String(b).length) * small * 0.3 + 3;
  return (
    <g data-fraction={`${a}/${b}`}>
      <text x={x} y={cy - 3} textAnchor="middle" style={text(small, color)}>
        {a}
      </text>
      <line
        x1={x - half}
        x2={x + half}
        y1={cy}
        y2={cy}
        stroke={color}
        strokeWidth="1.3"
      />
      <text
        x={x}
        y={cy + small - 1}
        textAnchor="middle"
        style={text(small, color)}
      >
        {b}
      </text>
    </g>
  );
}

export function RatioRateFigure({ figure }: { figure: Figure }) {
  return figure.kind === "ratio-table" ? (
    <RatioTable figure={figure} />
  ) : (
    <DoubleNumberLine figure={figure} />
  );
}

export function ratioTableDescription(figure: RatioTableFigure) {
  return `Ratio table with ${figure.rows[0].values.length} columns of equivalent ratios. ${figure.rows
    .map(
      (row) =>
        `${row.label}: ${row.values.map((v) => (v === null ? "unknown (question mark)" : v)).join(", ")}`,
    )
    .join(". ")}.`;
}
function RatioTable({ figure }: { figure: RatioTableFigure }) {
  const columns = figure.rows[0].values.length,
    labelWidth = 136,
    cell = 58,
    rowHeight = 50,
    width = labelWidth + cell * columns + 4,
    height = rowHeight * 2 + 4;
  const description = ratioTableDescription(figure);
  return (
    <svg
      className="figure ratio-rate-figure"
      data-kind="ratio-table"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {figure.rows.map((row, r) => {
        const y = 2 + r * rowHeight;
        return (
          <g key={r}>
            <rect
              x="2"
              y={y}
              width={labelWidth}
              height={rowHeight}
              fill={sunken}
              stroke={axis}
            />
            <text x="12" y={y + rowHeight / 2 + 6} style={text(16, ink, 650)}>
              {row.label}
            </text>
            {row.values.map((v, c) => (
              <g key={c} data-cell={`${r},${c}`}>
                <rect
                  x={2 + labelWidth + c * cell}
                  y={y}
                  width={cell}
                  height={rowHeight}
                  fill={paper}
                  stroke={axis}
                />
                <FigureValue
                  n={v}
                  d={1}
                  x={2 + labelWidth + c * cell + cell / 2}
                  cy={y + rowHeight / 2}
                  size={18}
                />
              </g>
            ))}
          </g>
        );
      })}
      <rect
        x="2"
        y="2"
        width={width - 4}
        height={height - 4}
        fill="none"
        stroke={ink}
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function doubleLineDescription(figure: DoubleNumberLineFigure) {
  const { top, bottom } = figure;
  const pairs = top.numerators
    .map((t, i) => {
      const b = bottom.numerators[i]!;
      const show = (n: number | null, d: number) =>
        n === null ? "unknown (question mark)" : valueText(n, d);
      return `${show(t, top.denominator)} ${top.label.toLowerCase()} with ${show(b, bottom.denominator)} ${bottom.label.toLowerCase()}`;
    })
    .join("; ");
  return `Double number line. The top line shows ${top.label.toLowerCase()} and the bottom line shows ${bottom.label.toLowerCase()}, both starting at 0 and drawn to scale. Aligned marks pair ${pairs}.`;
}
/** Stacked fractions sit farther from the line so the tick never crosses them. */
const stacked = (n: number | null | undefined, d: number) =>
  n !== null && n !== undefined && reduced(n, d)[1] !== 1;
function DoubleNumberLine({ figure }: { figure: DoubleNumberLineFigure }) {
  const { top, bottom } = figure;
  const positions = rateLinePositions(figure);
  const x0 = 124,
    x1 = 332,
    yTop = 56,
    yBottom = 112,
    x = (p: number) => x0 + p * (x1 - x0);
  const description = doubleLineDescription(figure);
  return (
    <svg
      className="figure ratio-rate-figure"
      data-kind="double-number-line"
      viewBox="0 0 360 168"
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <text x="8" y={yTop + 6} style={text(15, ink, 650)}>
        {top.label}
      </text>
      <text x="8" y={yBottom + 6} style={text(15, ink, 650)}>
        {bottom.label}
      </text>
      {[yTop, yBottom].map((y) => (
        <g key={y}>
          <line
            x1={x0}
            x2={x1 + 16}
            y1={y}
            y2={y}
            stroke={ink}
            strokeWidth="2"
          />
          <path d={`M${x1 + 22} ${y} l-9 -5 v10 z`} fill={ink} />
        </g>
      ))}
      {positions.map((p, i) => (
        <g key={i} data-column={i}>
          <line
            x1={x(p)}
            x2={x(p)}
            y1={yTop + 8}
            y2={yBottom - 8}
            stroke={axis}
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <line
            x1={x(p)}
            x2={x(p)}
            y1={yTop - 8}
            y2={yTop + 8}
            stroke={ink}
            strokeWidth="2"
          />
          <line
            x1={x(p)}
            x2={x(p)}
            y1={yBottom - 8}
            y2={yBottom + 8}
            stroke={ink}
            strokeWidth="2"
          />
          <FigureValue
            n={top.numerators[i] ?? null}
            d={top.denominator}
            x={x(p)}
            cy={yTop - (stacked(top.numerators[i], top.denominator) ? 31 : 22)}
          />
          <FigureValue
            n={bottom.numerators[i] ?? null}
            d={bottom.denominator}
            x={x(p)}
            cy={
              yBottom +
              (stacked(bottom.numerators[i], bottom.denominator) ? 30 : 24)
            }
          />
        </g>
      ))}
    </svg>
  );
}
