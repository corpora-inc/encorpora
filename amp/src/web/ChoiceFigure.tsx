import type { SemanticFigure } from "../math/contracts.js";
import { Figure } from "./Figure.js";
/** Compact graph labels retain readable size; coordinates are givens, not answers. */
export function ChoiceFigure({ figure }: { figure: SemanticFigure }) {
  if (figure.kind !== "coordinate-plane") return <Figure figure={figure} />;
  const left = 30,
    right = 270,
    top = 16,
    bottom = 146;
  const x = (value: number) =>
    left +
    ((value - figure.xMin) / (figure.xMax - figure.xMin)) * (right - left);
  const y = (value: number) =>
    bottom -
    ((value - figure.yMin) / (figure.yMax - figure.yMin)) * (bottom - top);
  const integers = (min: number, max: number) =>
    Array.from(
      { length: Math.floor(max) - Math.ceil(min) + 1 },
      (_, i) => Math.ceil(min) + i,
    );
  const described = figure.points
    .map((p) => `${p.label} at (${p.x}, ${p.y})`)
    .join("; ");
  return (
    <svg
      className="figure choice-coordinate"
      viewBox="0 0 300 176"
      role="img"
      aria-label={`Coordinate grid. ${described}. A straight line passes through these points. Read coordinate units, not the visual angle.`}
    >
      {integers(figure.xMin, figure.xMax).map((n) => (
        <line
          key={`x${n}`}
          x1={x(n)}
          x2={x(n)}
          y1={top}
          y2={bottom}
          stroke={n === 0 ? "#174a43" : "#dce4dc"}
          strokeWidth={n === 0 ? 1.5 : 0.75}
        />
      ))}
      {integers(figure.yMin, figure.yMax).map((n) => (
        <line
          key={`y${n}`}
          x1={left}
          x2={right}
          y1={y(n)}
          y2={y(n)}
          stroke={n === 0 ? "#174a43" : "#dce4dc"}
          strokeWidth={n === 0 ? 1.5 : 0.75}
        />
      ))}
      {[0, 2, 4]
        .filter((n) => n >= figure.xMin && n <= figure.xMax)
        .map((n) => (
          <text key={n} x={x(n)} y={166} textAnchor="middle">
            {n}
          </text>
        ))}
      <text x={left - 8} y={y(0) + 5} textAnchor="end">
        0
      </text>
      <text x={285} y={y(0) + 5}>
        x
      </text>
      <text x={x(0) + 7} y={18}>
        y
      </text>
      {figure.lines?.map((line, i) => {
        const crossings =
          line.m === 0
            ? [figure.xMin, figure.xMax]
            : [
                (figure.yMin - line.b) / line.m,
                (figure.yMax - line.b) / line.m,
              ];
        const a = Math.max(figure.xMin, Math.min(...crossings)),
          b = Math.min(figure.xMax, Math.max(...crossings));
        return a <= b ? (
          <line
            key={i}
            x1={x(a)}
            y1={y(line.m * a + line.b)}
            x2={x(b)}
            y2={y(line.m * b + line.b)}
            stroke="#20776d"
            strokeWidth={2.5}
          />
        ) : null;
      })}
      {figure.points.map((p) => (
        <g key={p.label}>
          <circle cx={x(p.x)} cy={y(p.y)} r={4} fill="#9c4420" stroke="white" />
          <text
            x={x(p.x) + (x(p.x) > 195 ? -9 : 9)}
            y={y(p.y) + 19}
            textAnchor={x(p.x) > 195 ? "end" : "start"}
            className="choice-point-label"
          >
            {p.label} ({p.x}, {p.y})
          </text>
        </g>
      ))}
    </svg>
  );
}
