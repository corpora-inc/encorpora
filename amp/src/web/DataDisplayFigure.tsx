import type { DataDisplayFigure as Model } from "../math/data-display-models.js";
import {
  barGraphLayout,
  boxPlotLayout,
  histogramLayout,
  linePlotLayout,
  mixedText,
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

/** One plotted observation: an × for line plots, a dot for dot plots. */
export function Mark({
  kind,
  cx,
  cy,
}: {
  kind: "x" | "dot";
  cx: number;
  cy: number;
}) {
  const color = "var(--color-figure-accent)";
  return kind === "dot" ? (
    <circle data-mark="dot" cx={cx} cy={cy} r={6.5} fill={color} />
  ) : (
    <path
      data-mark="x"
      d={`M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}`}
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}
/** A number-line label typeset as a mixed number with a stacked fraction. */
export function TickLabel({
  x,
  y,
  whole,
  n,
  d,
}: {
  x: number;
  y: number;
  whole: number;
  n: number;
  d: number;
}) {
  if (!n)
    return (
      <text x={x} y={y + 18} textAnchor="middle" style={label}>
        {whole}
      </text>
    );
  const fx = whole ? x + 5 : x;
  return (
    <g data-tick-label={`${whole} ${n}/${d}`}>
      {whole > 0 && (
        <text x={x - 1} y={y + 19} textAnchor="end" style={label}>
          {whole}
        </text>
      )}
      <text
        x={fx}
        y={y + 10}
        textAnchor="middle"
        style={{ fontSize: 13, fill: ink }}
      >
        {n}
      </text>
      <line
        x1={fx - 5}
        x2={fx + 5}
        y1={y + 13}
        y2={y + 13}
        stroke={ink}
        strokeWidth={1.2}
      />
      <text
        x={fx}
        y={y + 25}
        textAnchor="middle"
        style={{ fontSize: 13, fill: ink }}
      >
        {d}
      </text>
    </g>
  );
}
/** Axis, ticks and labels of a line plot or dot plot, shared with lesson animations. */
export function LinePlotAxis({
  layout,
  labelGap = 6,
}: {
  layout: ReturnType<typeof linePlotLayout>;
  /** Space between the axis and its labels (room for a pivot in animations). */
  labelGap?: number;
}) {
  return (
    <g data-axis="line-plot">
      <line
        x1={layout.left - 10}
        x2={layout.right + 10}
        y1={layout.axisY}
        y2={layout.axisY}
        stroke={ink}
        strokeWidth={2}
      />
      {layout.ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={t.x}
            x2={t.x}
            y1={layout.axisY - (t.major ? 7 : 5)}
            y2={layout.axisY + (t.major ? 7 : 5)}
            stroke={ink}
            strokeWidth={t.major ? 2 : 1.5}
          />
          <TickLabel {...t} y={layout.axisY + labelGap} />
        </g>
      ))}
    </g>
  );
}

/** A box plot's marks, shared by practice figures and the lesson animation. */
export function BoxMarks({
  box,
}: {
  box: ReturnType<typeof boxPlotLayout>["box"];
}) {
  const mid = (box.top + box.bottom) / 2,
    stroke = "var(--color-figure-accent)";
  return (
    <g data-box="plot">
      <line
        x1={box.min}
        x2={box.q1}
        y1={mid}
        y2={mid}
        stroke={stroke}
        strokeWidth={2.5}
      />
      <line
        x1={box.q3}
        x2={box.max}
        y1={mid}
        y2={mid}
        stroke={stroke}
        strokeWidth={2.5}
      />
      {[box.min, box.max].map((x, i) => (
        <line
          key={i}
          x1={x}
          x2={x}
          y1={mid - 14}
          y2={mid + 14}
          stroke={stroke}
          strokeWidth={2.5}
        />
      ))}
      <rect
        x={box.q1}
        y={box.top}
        width={box.q3 - box.q1}
        height={box.bottom - box.top}
        fill="var(--color-figure-accent-fill)"
        stroke={stroke}
        strokeWidth={2.5}
      />
      <line
        x1={box.median}
        x2={box.median}
        y1={box.top}
        y2={box.bottom}
        stroke="var(--color-figure-warm)"
        strokeWidth={3.5}
      />
    </g>
  );
}

export function DataDisplayFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "histogram": {
      const l = histogramLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 206"
          role="img"
          aria-label={`Histogram of ${figure.unit}, intervals of ${figure.width}. ${l.bars.map((b) => `${b.from} to less than ${b.from + figure.width}: ${b.count}`).join("; ")}.`}
        >
          <text x={l.left - 8} y={14} textAnchor="end" style={small}>
            count
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
          {l.bars.map((b) => (
            <rect
              key={b.from}
              data-bin={b.from}
              data-count={b.count}
              x={b.x}
              y={b.top}
              width={b.width}
              height={b.height}
              fill="var(--color-figure-accent-fill-strong)"
              stroke="var(--color-figure-accent)"
              strokeWidth={2}
            />
          ))}
          <line
            x1={l.left}
            x2={l.left}
            y1={l.top}
            y2={l.bottom}
            stroke={ink}
            strokeWidth={2}
          />
          {l.edges.map((e) => (
            <g key={e.value}>
              <line
                x1={e.x}
                x2={e.x}
                y1={l.bottom}
                y2={l.bottom + 6}
                stroke={ink}
                strokeWidth={2}
              />
              <text x={e.x} y={l.bottom + 22} textAnchor="middle" style={small}>
                {e.value}
              </text>
            </g>
          ))}
          <text x={l.right} y={l.bottom + 38} textAnchor="end" style={small}>
            {figure.unit}
          </text>
        </svg>
      );
    }
    case "box-plot": {
      const l = boxPlotLayout(figure);
      const [min, q1, median, q3, max] = figure.summary;
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 190"
          role="img"
          aria-label={`Box plot of ${figure.unit}: minimum ${min}, lower quartile ${q1}, median ${median}, upper quartile ${q3}, maximum ${max}.`}
        >
          <text x={8} y={16} style={small}>
            {figure.unit}
          </text>
          <BoxMarks box={l.box} />
          <line
            x1={l.left - 10}
            x2={l.right + 10}
            y1={l.axisY}
            y2={l.axisY}
            stroke={ink}
            strokeWidth={2}
          />
          {l.ticks.map((t) => (
            <g key={t.value}>
              <line
                x1={t.x}
                x2={t.x}
                y1={l.axisY - (t.labeled ? 7 : 4)}
                y2={l.axisY + (t.labeled ? 7 : 4)}
                stroke={ink}
                strokeWidth={t.labeled ? 2 : 1.5}
              />
              {t.labeled && (
                <text
                  x={t.x}
                  y={l.axisY + 26}
                  textAnchor="middle"
                  style={label}
                >
                  {t.value}
                </text>
              )}
            </g>
          ))}
        </svg>
      );
    }
    case "line-plot": {
      const l = linePlotLayout(figure);
      const counts = new Map<number, number>();
      for (const v of figure.values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 200"
          role="img"
          aria-label={`${figure.mark === "x" ? "Line plot" : "Dot plot"} of ${figure.values.length} measurements in ${figure.unit}. ${[
            ...counts,
          ]
            .sort((a, b) => a[0] - b[0])
            .map(([v, c]) => `${mixedText(v, figure.denominator)}: ${c}`)
            .join("; ")}.`}
        >
          <text x={8} y={16} style={small}>
            {figure.unit}
          </text>
          <LinePlotAxis layout={l} />
          {l.marks.map((m, i) => (
            <Mark key={i} kind={figure.mark} cx={m.cx} cy={m.cy} />
          ))}
        </svg>
      );
    }
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
          <text x={l.left - 8} y={16} textAnchor="end" style={small}>
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
