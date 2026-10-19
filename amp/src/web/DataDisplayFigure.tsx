import type { DataDisplayFigure as Model } from "../math/data-display-models.js";
import {
  barGraphLayout,
  boxPlotLayout,
  doubleBoxLayout,
  doubleDotLayout,
  histogramLayout,
  scatterLayout,
  twoWayLayout,
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

/** A number line with every tick drawn and some labeled, shared by the
 * single and double box plots and the double dot plot. */
export function ScaleAxis({
  left,
  right,
  axisY,
  ticks,
  labels = true,
  labelDy = 26,
}: {
  left: number;
  right: number;
  axisY: number;
  ticks: { value: number; x: number; labeled: boolean }[];
  labels?: boolean;
  /** Baseline of the tick labels below the axis. */
  labelDy?: number;
}) {
  return (
    <g data-axis="scale">
      <line
        x1={left - 10}
        x2={right + 10}
        y1={axisY}
        y2={axisY}
        stroke={ink}
        strokeWidth={2}
      />
      {ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={t.x}
            x2={t.x}
            y1={axisY - (t.labeled ? 7 : 4)}
            y2={axisY + (t.labeled ? 7 : 4)}
            stroke={ink}
            strokeWidth={t.labeled ? 2 : 1.5}
          />
          {labels && t.labeled && (
            <text x={t.x} y={axisY + labelDy} textAnchor="middle" style={label}>
              {t.value}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
const summaryText = (s: readonly number[]) =>
  `minimum ${s[0]}, lower quartile ${s[1]}, median ${s[2]}, upper quartile ${s[3]}, maximum ${s[4]}`;

/** The grid, axes and points of a scatter plot, shared with the lesson animation. */
export function ScatterGrid({
  layout: l,
  figure,
  compact = false,
}: {
  layout: ReturnType<typeof scatterLayout>;
  figure: Extract<Model, { kind: "scatter-plot" }>;
  compact?: boolean;
}) {
  const tick = compact ? { fontSize: 13, fill: ink } : small;
  return (
    <g data-scatter="grid">
      {l.xTicks.map((v, i) => (
        <g key={`x${v}`}>
          <line
            x1={l.x(v)}
            x2={l.x(v)}
            y1={l.top}
            y2={l.bottom}
            stroke={grid}
            strokeWidth={1}
          />
          {l.xLabeled(i) && (
            <text x={l.x(v)} y={l.bottom + 20} textAnchor="middle" style={tick}>
              {v}
            </text>
          )}
        </g>
      ))}
      {l.yTicks.map((v) => (
        <g key={`y${v}`}>
          <line
            x1={l.left}
            x2={l.right}
            y1={l.y(v)}
            y2={l.y(v)}
            stroke={grid}
            strokeWidth={1}
          />
          <text x={l.left - 7} y={l.y(v) + 5} textAnchor="end" style={tick}>
            {v}
          </text>
        </g>
      ))}
      <line
        x1={l.left}
        x2={l.right}
        y1={l.bottom}
        y2={l.bottom}
        stroke={ink}
        strokeWidth={2}
      />
      <line
        x1={l.left}
        x2={l.left}
        y1={l.top}
        y2={l.bottom}
        stroke={ink}
        strokeWidth={2}
      />
      {!compact && (
        <>
          <text x={l.right} y={l.bottom + 42} textAnchor="end" style={small}>
            {figure.x.label} →
          </text>
          <text x={8} y={l.top - 14} style={small}>
            ↑ {figure.y.label}
          </text>
        </>
      )}
      {l.points.map((p, i) => (
        <circle
          key={i}
          data-point={figure.points[i]!.join(",")}
          cx={p.cx}
          cy={p.cy}
          r={compact ? 4.5 : 5.5}
          fill="var(--color-figure-accent)"
          stroke="var(--color-figure-paper)"
          strokeWidth={1.5}
        />
      ))}
    </g>
  );
}
const cellText = (v: number | null | "?") =>
  v === null ? "" : v === "?" ? "?" : `${v}`;

export function DataDisplayFigure({ figure }: { figure: Model }) {
  switch (figure.kind) {
    case "scatter-plot": {
      const l = scatterLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 290"
          role="img"
          aria-label={`Scatter plot of ${figure.y.label} against ${figure.x.label}. Points: ${figure.points.map(([a, b]) => `(${a}, ${b})`).join(", ")}.${figure.line ? ` A trend line passes through (${figure.line[0].join(", ")}) and (${figure.line[1].join(", ")}).` : ""}`}
        >
          <ScatterGrid layout={l} figure={figure} />
          {l.line && (
            <g data-trend="line">
              <line
                x1={l.line.x1}
                y1={l.line.y1}
                x2={l.line.x2}
                y2={l.line.y2}
                stroke="var(--color-figure-warm)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {l.line.marks.map((m, i) => (
                <circle
                  key={i}
                  cx={m.cx}
                  cy={m.cy}
                  r={6}
                  fill="var(--color-figure-paper)"
                  stroke="var(--color-figure-warm)"
                  strokeWidth={3}
                />
              ))}
            </g>
          )}
        </svg>
      );
    }
    case "two-way-table": {
      const t = twoWayLayout();
      const rows: [string, (number | null | "?")[]][] = [
        [figure.rows[0], [...figure.cells[0], figure.rowTotals[0]]],
        [figure.rows[1], [...figure.cells[1], figure.rowTotals[1]]],
        ["Total", [...figure.columnTotals, figure.total]],
      ];
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox={`0 0 360 ${t.height}`}
          role="img"
          aria-label={`Two-way table. Columns: ${figure.columnTitle}: ${figure.columns.join(", ")}, total. ${rows.map(([name, v]) => `${name}: ${v.map((x) => (x === null ? "blank" : x === "?" ? "unknown" : x)).join(", ")}`).join(". ")}.`}
        >
          <text
            x={t.cx(0.5)}
            y={t.titleY}
            textAnchor="middle"
            style={{ ...small, fontWeight: 600 }}
          >
            {figure.columnTitle}
          </text>
          <line
            x1={t.left + t.labelWidth + 6}
            x2={t.left + t.labelWidth + 2 * t.column - 6}
            y1={t.titleY + 6}
            y2={t.titleY + 6}
            stroke={axis}
            strokeWidth={1.5}
          />
          {[...figure.columns, "Total"].map((c, i) => (
            <text
              key={c}
              x={t.cx(i)}
              y={t.top(0) + 25}
              textAnchor="middle"
              style={{ ...label, fontWeight: 600 }}
            >
              {c}
            </text>
          ))}
          {rows.map(([name, values], r) => (
            <g key={name} data-row={name}>
              <rect
                x={t.left}
                y={t.top(r + 1)}
                width={t.labelWidth + 3 * t.column}
                height={t.rowHeight}
                fill={
                  r === 2
                    ? "var(--color-figure-empty)"
                    : "var(--color-figure-paper)"
                }
                stroke={grid}
              />
              <text
                x={t.left + 8}
                y={t.top(r + 1) + 25}
                style={{ ...label, fontWeight: 600 }}
              >
                {name}
              </text>
              {values.map((v, c) => (
                <g key={c} data-cell={`${r}-${c}`} data-value={cellText(v)}>
                  {v === null || v === "?" ? (
                    <rect
                      x={t.cx(c) - 24}
                      y={t.top(r + 1) + 6}
                      width={48}
                      height={t.rowHeight - 12}
                      rx={5}
                      fill="none"
                      stroke={v === "?" ? "var(--color-figure-warm)" : axis}
                      strokeWidth={v === "?" ? 2.5 : 1.5}
                      strokeDasharray={v === "?" ? undefined : "4 3"}
                    />
                  ) : null}
                  <text
                    x={t.cx(c)}
                    y={t.top(r + 1) + 25}
                    textAnchor="middle"
                    style={{
                      ...label,
                      fontWeight: c === 2 || r === 2 ? 600 : 400,
                      fill: v === "?" ? "var(--color-figure-warm)" : ink,
                    }}
                  >
                    {cellText(v)}
                  </text>
                </g>
              ))}
            </g>
          ))}
          <line
            x1={t.left + t.labelWidth + 2 * t.column}
            x2={t.left + t.labelWidth + 2 * t.column}
            y1={t.top(1)}
            y2={t.top(4)}
            stroke={ink}
            strokeWidth={1.5}
          />
          <line
            x1={t.left}
            x2={t.left + t.labelWidth + 3 * t.column}
            y1={t.top(3)}
            y2={t.top(3)}
            stroke={ink}
            strokeWidth={1.5}
          />
        </svg>
      );
    }
    case "double-dot-plot": {
      const l = doubleDotLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 300"
          role="img"
          aria-label={`Two dot plots of ${figure.unit} on the same scale. ${figure.groups
            .map(
              (g) =>
                `${g.label}: ${[...g.values].sort((a, b) => a - b).join(", ")}`,
            )
            .join(". ")}.`}
        >
          {l.panels.map((p, i) => (
            <g key={p.label} data-group={p.label}>
              <text
                x={8}
                y={i ? 168 : 20}
                style={{ ...label, fontWeight: 600 }}
              >
                {p.label}
              </text>
              <ScaleAxis
                left={l.left}
                right={l.right}
                axisY={p.axisY}
                ticks={l.ticks}
              />
              {p.marks.map((m, j) => (
                <Mark key={j} kind="dot" cx={m.cx} cy={m.cy} />
              ))}
            </g>
          ))}
          <text x={352} y={20} textAnchor="end" style={small}>
            {figure.unit}
          </text>
        </svg>
      );
    }
    case "double-box-plot": {
      const l = doubleBoxLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 254"
          role="img"
          aria-label={`Two box plots of ${figure.unit} on the same scale. ${figure.groups.map((g) => `${g.label}: ${summaryText(g.summary)}`).join(". ")}.`}
        >
          <text x={352} y={16} textAnchor="end" style={small}>
            {figure.unit}
          </text>
          {l.boxes.map((b) => (
            <g key={b.label} data-group={b.label}>
              <text
                x={8}
                y={b.box.top - 10}
                style={{ ...label, fontWeight: 600 }}
              >
                {b.label}
              </text>
              <BoxMarks box={b.box} />
            </g>
          ))}
          <ScaleAxis
            left={l.left}
            right={l.right}
            axisY={l.axisY}
            ticks={l.ticks}
          />
        </svg>
      );
    }
    case "histogram": {
      const l = histogramLayout(figure);
      return (
        <svg
          className="figure data-figure"
          data-kind={figure.kind}
          viewBox="0 0 360 212"
          role="img"
          aria-label={`Histogram of ${figure.unit}, intervals of ${figure.width}. ${l.bars.map((b) => `${b.from} to less than ${b.from + figure.width}: ${b.count}`).join("; ")}.`}
        >
          <text x={l.left - 8} y={16} textAnchor="end" style={small}>
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
