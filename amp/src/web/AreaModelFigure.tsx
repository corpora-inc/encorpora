import type { SemanticFigure } from "../math/contracts.js";

type AreaModel = Extract<SemanticFigure, { kind: "area-model" }>;

/** Region sizes and positions for an area model drawn to scale. */
export function areaModelLayout(
  figure: AreaModel,
  box: { x: number; y: number; width: number; height: number },
) {
  const a = figure.columns.reduce((s, n) => s + n, 0),
    b = figure.rows.reduce((s, n) => s + n, 0);
  const scale = Math.min(box.width / a, box.height / b);
  const x0 = box.x + (box.width - a * scale) / 2,
    y0 = box.y;
  const xs = figure.columns.map(
    (_, i) =>
      x0 + figure.columns.slice(0, i).reduce((s, n) => s + n, 0) * scale,
  );
  const ys = figure.rows.map(
    (_, j) => y0 + figure.rows.slice(0, j).reduce((s, n) => s + n, 0) * scale,
  );
  return {
    x0,
    y0,
    width: a * scale,
    height: b * scale,
    columns: figure.columns.map((n, i) => ({ n, x: xs[i]!, w: n * scale })),
    rows: figure.rows.map((n, j) => ({ n, y: ys[j]!, h: n * scale })),
  };
}

/** A rectangle whose sides are split by place value, drawn to scale. */
export function AreaModelFigure({ figure }: { figure: AreaModel }) {
  const a = figure.columns.reduce((s, n) => s + n, 0),
    b = figure.rows.reduce((s, n) => s + n, 0);
  const layout = areaModelLayout(figure, {
    x: 52,
    y: 30,
    width: 250,
    height: 176,
  });
  return (
    <svg
      className="figure area-model-figure"
      data-kind="area-model"
      viewBox={`0 0 320 ${Math.ceil(layout.height) + 40}`}
      role="img"
      aria-label={`A rectangle ${a} units wide and ${b} units tall, drawn to scale. The width is split into ${figure.columns.join(" and ")}; the height is split into ${figure.rows.join(" and ")}.`}
    >
      {layout.rows.flatMap((row, j) =>
        layout.columns.map((column, i) => (
          <rect
            key={`${i}-${j}`}
            data-region={`${column.n}x${row.n}`}
            x={column.x}
            y={row.y}
            width={column.w}
            height={row.h}
            fill={
              (i + j) % 2
                ? "var(--color-figure-gold-fill)"
                : "var(--color-figure-accent-fill)"
            }
            stroke="var(--color-figure-ink)"
            strokeWidth="1.5"
          />
        )),
      )}
      {layout.columns.map((column) => (
        <text
          key={`c${column.x}`}
          x={column.x + column.w / 2}
          y={layout.y0 - 10}
          textAnchor="middle"
          className="fig-label"
        >
          {column.n}
        </text>
      ))}
      {layout.rows.map((row) => (
        <text
          key={`r${row.y}`}
          x={layout.x0 - 8}
          y={row.y + row.h / 2 + 5}
          textAnchor="end"
          className="fig-label"
        >
          {row.n}
        </text>
      ))}
    </svg>
  );
}
