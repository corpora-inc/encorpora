import type { SemanticFigure } from "../math/contracts.js";
type FractionFigure = Extract<
  SemanticFigure,
  { kind: "rational-line" | "fraction-strips" }
>;
export function FractionPracticeFigure({ figure }: { figure: FractionFigure }) {
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
  const pieces = figure.parts * figure.wholes,
    unitWidth = 312 / figure.wholes;
  const description = `Each whole represents ${figure.unit} and has ${figure.parts} equal parts. ${figure.rows.map((row) => `${row.label}: ${row.selected} shaded parts`).join(". ")}. Heavy outlines separate wholes.`;
  return (
    <svg
      className="figure fraction-practice-figure"
      viewBox={`0 0 360 ${28 + figure.rows.length * 58}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <text x="180" y="18" textAnchor="middle" fontSize="18">
        Each whole: {figure.unit}
      </text>
      {figure.rows.map((row, index) => {
        const y = 48 + index * 58;
        return (
          <g key={index} data-row={index}>
            <text x="24" y={y - 7} fontSize="18">
              {row.label}
            </text>
            {Array.from({ length: pieces }, (_, n) => (
              <rect
                data-piece={n}
                data-shaded={n < row.selected ? "true" : "false"}
                key={n}
                x={24 + (n / pieces) * 312}
                y={y}
                width={312 / pieces}
                height="26"
                fill={n < row.selected ? "#287d70" : "#fffdf8"}
                stroke="#183f3b"
                strokeWidth="0.7"
              />
            ))}
            {Array.from({ length: figure.wholes }, (_, n) => (
              <rect
                data-whole={n}
                key={n}
                x={24 + n * unitWidth}
                y={y}
                width={unitWidth}
                height="26"
                fill="none"
                stroke="#183f3b"
                strokeWidth="2.2"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
