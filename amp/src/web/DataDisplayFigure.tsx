import type { DataDisplayFigure as Model } from "../math/data-display-models.js";
import {
  barGraphLayout,
  pictureGraphLayout,
  sortShapesLayout,
  type ShapeKind,
} from "../math/data-display-models.js";

/** The chart family: one visual language for every data display. Colors are
 * figure roles only, so each chart reads in light, dark and print. */
const ink = "var(--color-figure-ink)",
  grid = "var(--color-figure-grid)",
  axis = "var(--color-figure-axis)";
const label = { fontSize: 17, fill: ink } as const;
const small = { fontSize: 15, fill: ink } as const;
const shapeTone: Record<ShapeKind, [string, string]> = {
  circle: ["var(--color-figure-accent)", "var(--color-figure-accent-fill)"],
  square: ["var(--color-figure-warm)", "var(--color-figure-warm-fill)"],
  triangle: ["var(--color-figure-gold)", "var(--color-figure-gold-fill)"],
};
const plural = (n: number, unit: string) =>
  n === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;

export function Shape({
  shape,
  cx,
  cy,
  size,
}: {
  shape: ShapeKind;
  cx: number;
  cy: number;
  size: number;
}) {
  const [stroke, fill] = shapeTone[shape],
    h = size / 2;
  const common = {
    stroke,
    fill,
    strokeWidth: 3,
    strokeLinejoin: "round" as const,
  };
  if (shape === "circle")
    return <circle data-shape={shape} cx={cx} cy={cy} r={h} {...common} />;
  if (shape === "square")
    return (
      <rect
        data-shape={shape}
        x={cx - h * 0.88}
        y={cy - h * 0.88}
        width={size * 0.88}
        height={size * 0.88}
        rx={3}
        {...common}
      />
    );
  // Equilateral, centered on its centroid so groups look evenly spaced.
  const r = h * 1.12;
  const points = [90, 210, 330]
    .map((deg) => {
      const t = (deg * Math.PI) / 180;
      return `${(cx + r * Math.cos(t)).toFixed(2)},${(cy - r * Math.sin(t) + r * 0.12).toFixed(2)}`;
    })
    .join(" ");
  return <polygon data-shape={shape} points={points} {...common} />;
}

/** A picture-graph symbol; `half` draws exactly the left half. */
function Token({
  cx,
  cy,
  r,
  half,
}: {
  cx: number;
  cy: number;
  r: number;
  half?: boolean;
}) {
  const fill = "var(--color-figure-accent)";
  return half ? (
    <path
      data-symbol="half"
      d={`M${cx} ${cy - r} A${r} ${r} 0 0 0 ${cx} ${cy + r} Z`}
      fill={fill}
    />
  ) : (
    <circle data-symbol="whole" cx={cx} cy={cy} r={r} fill={fill} />
  );
}

export function DataDisplayFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "sort-shapes": {
      const placed = sortShapesLayout(figure.shapes);
      const count = (k: ShapeKind) =>
        figure.shapes.filter((s) => s === k).length;
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 200"
          role="img"
          aria-label={`${figure.shapes.length} shapes in mixed order: ${(["circle", "square", "triangle"] as const).map((k) => `${count(k)} ${k}${count(k) === 1 ? "" : "s"}`).join(", ")}.`}
        >
          {placed.map((p, i) => (
            <Shape key={i} {...p} />
          ))}
        </svg>
      );
    }
    case "picture-graph": {
      const layout = pictureGraphLayout(figure);
      const width = 360;
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox={`0 0 ${width} ${layout.height}`}
          role="img"
          aria-label={`Picture graph. Each symbol stands for ${figure.key} ${plural(figure.key, figure.unit)}${figure.key % 2 === 0 ? `; a half symbol stands for ${figure.key / 2}` : ""}. ${figure.categories.map((c) => `${c.label}: ${c.count}`).join("; ")}.`}
        >
          {layout.rows.map((row, i) => (
            <g key={row.label} data-row={row.label}>
              {i > 0 && (
                <line
                  x1={8}
                  x2={width - 8}
                  y1={row.y - 18}
                  y2={row.y - 18}
                  stroke={grid}
                />
              )}
              <text
                x={layout.labelWidth - 10}
                y={row.y + 6}
                textAnchor="end"
                style={label}
              >
                {row.label}
              </text>
              {row.symbols.map((s, j) => (
                <Token
                  key={j}
                  cx={s.cx}
                  cy={row.y}
                  r={layout.radius}
                  half={s.half}
                />
              ))}
            </g>
          ))}
          <line
            x1={layout.labelWidth}
            x2={layout.labelWidth}
            y1={layout.rows[0]!.y - 18}
            y2={layout.rows.at(-1)!.y + 18}
            stroke={axis}
            strokeWidth={2}
          />
          <g data-key={figure.key}>
            <rect
              x={layout.labelWidth}
              y={layout.keyY - 15}
              width={170}
              height={26}
              rx={6}
              fill="var(--color-figure-empty)"
            />
            <Token
              cx={layout.labelWidth + 18}
              cy={layout.keyY - 2}
              r={layout.radius - 2}
            />
            <text x={layout.labelWidth + 34} y={layout.keyY + 4} style={small}>
              = {figure.key} {plural(figure.key, figure.unit)}
            </text>
          </g>
        </svg>
      );
    }
    case "scaled-bar-graph": {
      const l = barGraphLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 206"
          role="img"
          aria-label={`Bar graph of ${figure.unit}. The scale counts by ${figure.step}s from 0 to ${figure.max}. ${figure.categories.map((c) => `${c.label}: ${c.value}`).join("; ")}.`}
        >
          <text x={l.left - 8} y={12} textAnchor="end" style={small}>
            {figure.unit}
          </text>
          {l.gridlines.map((v) => (
            <g key={v}>
              <line
                x1={l.left}
                x2={l.right}
                y1={l.y(v)}
                y2={l.y(v)}
                stroke={v ? grid : ink}
                strokeWidth={v ? 1 : 2}
              />
              <text
                x={l.left - 8}
                y={l.y(v) + 5}
                textAnchor="end"
                style={small}
              >
                {v}
              </text>
            </g>
          ))}
          <line
            x1={l.left}
            x2={l.left}
            y1={l.top}
            y2={l.bottom}
            stroke={ink}
            strokeWidth={2}
          />
          {l.bars.map((bar) => (
            <g key={bar.label} data-bar={bar.label} data-value={bar.value}>
              <rect
                x={bar.x}
                y={bar.top}
                width={bar.width}
                height={bar.height}
                fill="var(--color-figure-accent-fill-strong)"
                stroke="var(--color-figure-accent)"
                strokeWidth={2}
              />
              <text
                x={bar.center}
                y={l.bottom + 22}
                textAnchor="middle"
                style={label}
              >
                {bar.label}
              </text>
            </g>
          ))}
        </svg>
      );
    }
  }
}
