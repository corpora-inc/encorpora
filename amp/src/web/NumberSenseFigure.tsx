import type { SemanticFigure } from "../math/contracts.js";

export type NumberSenseFigureData = Extract<
  SemanticFigure,
  { kind: "hundred-chart" | "hop-line" }
>;
const ink = "var(--color-figure-ink)",
  accent = "var(--color-figure-accent)",
  warm = "var(--color-figure-warm)";

/** A window of the 1–100 chart: rows of ten, so down is +10 and right is +1. */
function HundredChart({
  figure,
}: {
  figure: Extract<NumberSenseFigureData, { kind: "hundred-chart" }>;
}) {
  const w = 56,
    h = 44,
    pad = 4;
  return (
    <svg
      className="figure number-sense-figure"
      data-kind="hundred-chart"
      viewBox={`0 0 ${figure.columns * w + 2 * pad} ${figure.rows * h + 2 * pad}`}
      style={{ maxWidth: figure.columns * 72 }}
      role="img"
      aria-label={`Part of the hundred chart: ${figure.rows} rows of ${figure.columns} squares starting at ${figure.first}. Row ${figure.blank[0] + 1}, square ${figure.blank[1] + 1} is empty.`}
    >
      {Array.from({ length: figure.rows * figure.columns }, (_, i) => {
        const row = Math.floor(i / figure.columns),
          column = i % figure.columns,
          blank = row === figure.blank[0] && column === figure.blank[1];
        const x = pad + column * w,
          y = pad + row * h;
        return (
          <g
            key={i}
            data-cell={blank ? "blank" : figure.first + row * 10 + column}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={
                blank
                  ? "var(--color-figure-gold-fill)"
                  : "var(--color-figure-paper)"
              }
              stroke={blank ? "var(--color-figure-gold)" : ink}
              strokeWidth={blank ? 2.5 : 1}
            />
            {!blank && (
              <text
                x={x + w / 2}
                y={y + h / 2 + 7}
                textAnchor="middle"
                className="fig-label"
                style={{ fontSize: 19, fontVariantNumeric: "tabular-nums" }}
              >
                {figure.first + row * 10 + column}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Unit ticks, labeled tens and hop arcs. Positions are exact: one unit is
 * the same width everywhere on the line. */
export function hopGeometry(
  figure: Extract<NumberSenseFigureData, { kind: "hop-line" }>,
) {
  const left = 18,
    right = 302,
    unit = (right - left) / (figure.max - figure.min);
  const x = (n: number) => left + (n - figure.min) * unit;
  const stops = [figure.start];
  for (const hop of figure.hops) stops.push(stops.at(-1)! + hop.size);
  return { left, right, unit, x, stops };
}

function HopLine({
  figure,
}: {
  figure: Extract<NumberSenseFigureData, { kind: "hop-line" }>;
}) {
  const { left, right, x, stops } = hopGeometry(figure);
  const y = 92;
  const end = stops.at(-1)!;
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
  return (
    <svg
      className="figure number-sense-figure"
      data-kind="hop-line"
      viewBox="0 0 320 136"
      role="img"
      aria-label={`A number line from ${figure.min} to ${figure.max} with a tick for every 1. Start at ${figure.start}. ${figure.hops
        .map((hop) =>
          hop.label === "?"
            ? `A hop of unknown length ${hop.size > 0 ? "to the right" : "to the left"}`
            : `A hop of ${signed(hop.size)}`,
        )
        .join(
          ", then ",
        )}. ${figure.end === "shown" ? `It ends at ${end}.` : "The landing point is marked with a question mark."}`}
    >
      <line x1={left} x2={right} y1={y} y2={y} stroke={ink} strokeWidth="2" />
      {Array.from({ length: figure.max - figure.min + 1 }, (_, i) => {
        const n = figure.min + i,
          major = n % 10 === 0;
        return (
          <g key={n}>
            <line
              x1={x(n)}
              x2={x(n)}
              y1={y - (major ? 8 : 4)}
              y2={y + (major ? 8 : 4)}
              stroke={ink}
              strokeWidth={major ? 1.75 : 0.9}
            />
            {major && (
              <text
                x={x(n)}
                y={y + 24}
                textAnchor="middle"
                className="fig-scale"
              >
                {n}
              </text>
            )}
          </g>
        );
      })}
      {figure.hops.map((hop, i) => {
        const from = x(stops[i]!),
          to = x(stops[i + 1]!),
          lift = Math.min(58, 14 + Math.abs(to - from) * 0.3);
        const dir = Math.sign(to - from);
        const head = Math.min(7, 2.5 + Math.abs(to - from) / 3);
        return (
          <g key={i} data-hop={i}>
            <path
              d={`M${from} ${y - 4} Q${(from + to) / 2} ${y - 4 - 2 * lift} ${to} ${y - 4}`}
              fill="none"
              stroke={accent}
              strokeWidth="2.5"
            />
            <path
              d={`M${to} ${y - 4} l${-dir * head} ${-0.85 * head} M${to} ${y - 4} l${-dir * 0.15 * head} ${-1.3 * head}`}
              fill="none"
              stroke={accent}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <text
              x={(from + to) / 2}
              y={y - 10 - lift}
              textAnchor="middle"
              className="fig-label"
            >
              {hop.label === "?" ? "?" : signed(hop.size)}
            </text>
          </g>
        );
      })}
      <circle cx={x(figure.start)} cy={y} r={5} fill={warm} />
      <text
        x={x(figure.start)}
        y={y + 40}
        textAnchor="middle"
        className="fig-label"
        style={{ fill: warm }}
      >
        {figure.start}
      </text>
      <circle
        cx={x(end)}
        cy={y}
        r={5}
        fill={figure.end === "shown" ? warm : "var(--color-figure-paper)"}
        stroke={warm}
        strokeWidth="2"
      />
      <text
        x={x(end)}
        y={y + 40}
        textAnchor="middle"
        className="fig-label"
        style={{ fill: warm }}
      >
        {figure.end === "shown" ? end : "?"}
      </text>
    </svg>
  );
}

export function NumberSenseFigure({
  figure,
}: {
  figure: NumberSenseFigureData;
}) {
  return figure.kind === "hundred-chart" ? (
    <HundredChart figure={figure} />
  ) : (
    <HopLine figure={figure} />
  );
}
