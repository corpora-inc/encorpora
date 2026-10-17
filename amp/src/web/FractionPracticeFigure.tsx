import { useId } from "react";
import type { SemanticFigure } from "../math/contracts.js";
type FractionFigure = Extract<
  SemanticFigure,
  { kind: "rational-line" | "fraction-strips" }
>;
export function FractionPracticeFigure({ figure }: { figure: FractionFigure }) {
  const clipId = useId().replace(/:/g, "");
  if (figure.kind === "rational-line") {
    const steps = figure.denominator * figure.maxWhole,
      x = (n: number) => 24 + (n / steps) * 312;
    const description = `Number line from 0 to ${figure.maxWhole} ${figure.unit}, with ${figure.denominator} equal intervals in each whole. ${figure.points.map((p) => `${p.label} is ${p.numerator} small intervals after zero`).join(". ")}.`;
    return (
      <svg
        className="figure fraction-practice-figure"
        viewBox="0 0 360 140"
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        <text x="180" y="18" textAnchor="middle" fontSize="18">
          {figure.unit}
        </text>
        <line
          x1="24"
          x2="336"
          y1="90"
          y2="90"
          stroke="#183f3b"
          strokeWidth="2"
        />
        {Array.from({ length: steps + 1 }, (_, n) => (
          <g key={n}>
            <line
              data-tick={n}
              x1={x(n)}
              x2={x(n)}
              y1={n % figure.denominator === 0 ? 80 : 85}
              y2="98"
              stroke="#183f3b"
              strokeWidth={n % figure.denominator === 0 ? 2 : 1}
            />
            {n % figure.denominator === 0 && (
              <text x={x(n)} y="122" textAnchor="middle" fontSize="18">
                {n / figure.denominator}
              </text>
            )}
          </g>
        ))}
        {figure.points.map((point, index) => (
          <g key={point.label}>
            <line
              x1={x(point.numerator)}
              x2={x(point.numerator)}
              y1={index === 0 ? 44 : 68}
              y2="83"
              stroke="#9b461f"
              strokeWidth="1.5"
            />
            <text
              x={x(point.numerator)}
              y={index === 0 ? 40 : 64}
              textAnchor="middle"
              fontWeight="700"
              fontSize="18"
            >
              {point.label}
            </text>
            <circle
              data-point={point.label}
              cx={x(point.numerator)}
              cy="90"
              r="4"
              fill="#9b461f"
            />
          </g>
        ))}
      </svg>
    );
  }
  // Each whole is its own bar; a 0, 1, 2… scale ties the bars to the number line.
  const gap = 10,
    left = 20,
    span = 320,
    wholeWidth = (span - gap * (figure.wholes - 1)) / figure.wholes,
    pieceWidth = wholeWidth / figure.parts,
    labelled = figure.rows.length > 1,
    rowHeight = labelled ? 62 : 40,
    top = labelled ? 26 : 6,
    height = top + figure.rows.length * rowHeight + 22;
  const description = `${figure.rows.map((row) => `${row.label}: ${row.selected} of the equal parts shaded`).join(". ")}. Each whole is a separate bar cut into ${figure.parts} equal parts.`;
  return (
    <svg
      className="figure fraction-practice-figure"
      viewBox={`0 0 360 ${height}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {figure.rows.map((row, index) => {
        const y = top + index * rowHeight;
        return (
          <g key={index} data-row={index}>
            {labelled && (
              <text x={left} y={y - 8} className="fig-label">
                {row.label}
              </text>
            )}
            {Array.from({ length: figure.wholes }, (_, whole) => {
              const x0 = left + whole * (wholeWidth + gap);
              const clip = `${clipId}-${index}-${whole}`;
              return (
                <g key={whole} data-whole={whole}>
                  <clipPath id={clip}>
                    <rect x={x0} y={y} width={wholeWidth} height="30" rx="6" />
                  </clipPath>
                  <g clipPath={`url(#${clip})`}>
                    {Array.from({ length: figure.parts }, (_, part) => {
                      const n = whole * figure.parts + part;
                      return (
                        <rect
                          key={n}
                          data-piece={n}
                          data-shaded={n < row.selected ? "true" : "false"}
                          x={x0 + part * pieceWidth}
                          y={y}
                          width={pieceWidth}
                          height="30"
                          className={
                            n < row.selected ? "fig-fill" : "fig-empty"
                          }
                        />
                      );
                    })}
                  </g>
                  <rect
                    x={x0}
                    y={y}
                    width={wholeWidth}
                    height="30"
                    rx="6"
                    className="fig-outline"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
      {Array.from({ length: figure.wholes + 1 }, (_, n) => (
        <text
          key={n}
          x={left + n * (wholeWidth + gap) - (n === 0 ? 0 : gap / 2)}
          y={height - 4}
          textAnchor="middle"
          className="fig-scale"
        >
          {n}
        </text>
      ))}
    </svg>
  );
}
