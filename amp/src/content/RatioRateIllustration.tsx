import React from "react";

export type RatioRateIllustrationKind =
  | "rate-double-line"
  | "unit-price-tapes"
  | "ratio-table-scaling"
  | "rate-through-one"
  | "fraction-rate-copies"
  | "story-tapes";

const label = { fontSize: 20, fill: "currentColor" } as const;
const small = { fontSize: 17, fill: "currentColor" } as const;
const accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  warm = "var(--color-figure-warm, #9c4420)",
  warmFill = "var(--color-figure-warm-fill, #f2d5c3)";
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 480,
  display: "block",
  margin: "0 auto",
} as const;

/** Fixed teaching models; data attributes let an independent reviewer
 * re-measure every pair, part and column. */
export function RatioRateIllustration({
  kind,
}: {
  kind: RatioRateIllustrationKind;
}) {
  if (kind === "rate-double-line") return <PagesPerMinute />;
  if (kind === "unit-price-tapes") return <UnitPriceTapes />;
  if (kind === "ratio-table-scaling") return <RatioTableScaling />;
  if (kind === "rate-through-one") return <RateThroughOne />;
  if (kind === "fraction-rate-copies") return <FractionRateCopies />;
  return <StoryTapes />;
}

/** A stacked fraction or whole number centred at (x, cy). */
function Value({
  text,
  x,
  cy,
  style = small,
}: {
  text: string;
  x: number;
  cy: number;
  style?: { fontSize: number; fill: string; fontWeight?: number };
}) {
  const [n, d] = text.split("/");
  if (!d)
    return (
      <text
        x={x}
        y={cy + style.fontSize * 0.36}
        textAnchor="middle"
        style={style}
      >
        {n}
      </text>
    );
  const size = Math.round(style.fontSize * 0.85);
  return (
    <g>
      <text
        x={x}
        y={cy - 3}
        textAnchor="middle"
        style={{ ...style, fontSize: size }}
      >
        {n}
      </text>
      <line
        x1={x - 9}
        x2={x + 9}
        y1={cy}
        y2={cy}
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <text
        x={x}
        y={cy + size - 1}
        textAnchor="middle"
        style={{ ...style, fontSize: size }}
      >
        {d}
      </text>
    </g>
  );
}

type Pair = { top: string; bottom: string; at: number; strong?: boolean };
/** Two aligned lines with a shared 0. `at` is the true-scale position, 0–1. */
function DoubleLine({
  id,
  topLabel,
  bottomLabel,
  pairs,
  highlight,
  children,
  height = 210,
  yTop = 70,
  description,
  title,
}: {
  id: string;
  topLabel: string;
  bottomLabel: string;
  pairs: Pair[];
  highlight?: [number, number];
  children?: React.ReactNode;
  height?: number;
  yTop?: number;
  description: string;
  title: string;
}) {
  const x0 = 130,
    x1 = 440,
    yBottom = yTop + 80,
    x = (p: number) => x0 + p * (x1 - x0);
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration={id}
        viewBox={`0 0 480 ${height}`}
        role="img"
        aria-label={description}
        style={svgStyle}
      >
        <title>{title}</title>
        <text x="8" y={yTop + 7} style={{ ...label, fontWeight: 700 }}>
          {topLabel}
        </text>
        <text x="8" y={yBottom + 7} style={{ ...label, fontWeight: 700 }}>
          {bottomLabel}
        </text>
        {highlight &&
          [yTop, yBottom].map((y) => (
            <rect
              key={y}
              x={x(highlight[0])}
              y={y - 7}
              width={x(highlight[1]) - x(highlight[0])}
              height="14"
              rx="3"
              fill={accentFill}
              stroke={accent}
            />
          ))}
        {[yTop, yBottom].map((y) => (
          <g key={y}>
            <line
              x1={x0}
              x2={x1 + 18}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d={`M${x1 + 26} ${y} l-10 -5.5 v11 z`} fill="currentColor" />
          </g>
        ))}
        {pairs.map((p, i) => (
          <g key={i} data-pair={`${p.bottom},${p.top}`} data-at={p.at}>
            <line
              x1={x(p.at)}
              x2={x(p.at)}
              y1={yTop + 9}
              y2={yBottom - 9}
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeDasharray="3 4"
            />
            {[yTop, yBottom].map((y) => (
              <line
                key={y}
                x1={x(p.at)}
                x2={x(p.at)}
                y1={y - 9}
                y2={y + 9}
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
            <Value
              text={p.top}
              x={x(p.at)}
              cy={yTop - 26}
              style={p.strong ? { ...small, fontWeight: 700 } : small}
            />
            <Value
              text={p.bottom}
              x={x(p.at)}
              cy={yBottom + 28}
              style={p.strong ? { ...small, fontWeight: 700 } : small}
            />
          </g>
        ))}
        {children}
      </svg>
    </figure>
  );
}

function PagesPerMinute() {
  const pairs: Pair[] = Array.from({ length: 7 }, (_, m) => ({
    top: String(22 * m),
    bottom: String(m),
    at: m / 6,
    strong: m === 1 || m === 6,
  }));
  return (
    <DoubleLine
      id="rate-double-line"
      topLabel="Pages"
      bottomLabel="Minutes"
      pairs={pairs}
      highlight={[0, 1 / 6]}
      title="132 pages in 6 minutes is 22 pages in each minute"
      description="Double number line drawn to scale. The minutes line is marked 0 through 6 in equal steps. Aligned with them, the pages line is marked 0, 22, 44, 66, 88, 110 and 132. The first step, 1 minute with 22 pages, is highlighted: 6 equal steps of 22 pages make 132 pages."
    />
  );
}

function UnitPriceTapes() {
  // 1 cent = 0.6 units of width, so both bars share one money scale.
  const scale = 0.6,
    x0 = 150;
  const packs = [
    { name: "6-pack", parts: 6, cents: 450, y: 40 },
    { name: "8-pack", parts: 8, cents: 560, y: 130 },
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="unit-price-tapes"
        viewBox="0 0 520 220"
        role="img"
        aria-label="Two bars drawn on one money scale. The 6-pack bar is $4.50 long, split into 6 equal parts of $0.75. The 8-pack bar is $5.60 long, split into 8 equal parts of $0.70. The 8-pack bar is longer, but each of its parts is shorter."
        style={svgStyle}
      >
        <title>
          Longer total, shorter parts: the 8-pack costs less per bar
        </title>
        {packs.map((p) => {
          const each = p.cents / p.parts,
            w = each * scale;
          return (
            <g
              key={p.name}
              data-pack={p.name}
              data-total-cents={p.cents}
              data-parts={p.parts}
            >
              <text x="8" y={p.y + 30} style={{ ...label, fontWeight: 700 }}>
                {p.name}
              </text>
              <text x="8" y={p.y + 56} style={small}>
                ${(p.cents / 100).toFixed(2)}
              </text>
              {Array.from({ length: p.parts }, (_, i) => (
                <rect
                  key={i}
                  data-part-cents={each}
                  data-width={w}
                  x={x0 + i * w}
                  y={p.y + 10}
                  width={w}
                  height="34"
                  fill={i === 0 ? accentFill : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ))}
              <text
                x={x0 + w / 2}
                y={p.y + 68}
                textAnchor="middle"
                style={{ ...small, fontWeight: 700 }}
              >
                ${(each / 100).toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function RatioTableScaling() {
  const columns = [
    { m: 2, top: 4, bottom: 6 },
    { m: 5, top: 10, bottom: 15 },
    { m: 7, top: 14, bottom: 21 },
  ];
  const x0 = 170,
    cell = 92,
    y0 = 50,
    row = 52;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="ratio-table-scaling"
        viewBox="0 0 470 170"
        role="img"
        aria-label="Ratio table of flour to sugar in cups. Columns: 4 and 6, labelled 2 times the simplest ratio 2 to 3; 10 and 15, labelled 5 times; 14 and 21, labelled 7 times."
        style={svgStyle}
      >
        <title>Each column is 2 : 3 multiplied by one number</title>
        <text x="8" y={y0 + row / 2 + 7} style={{ ...label, fontWeight: 700 }}>
          Flour (cups)
        </text>
        <text
          x="8"
          y={y0 + row * 1.5 + 7}
          style={{ ...label, fontWeight: 700 }}
        >
          Sugar (cups)
        </text>
        {columns.map((c, i) => (
          <g
            key={c.m}
            data-column={`${c.m},${c.top},${c.bottom}`}
            data-simplest="2,3"
          >
            <text
              x={x0 + i * cell + cell / 2}
              y={y0 - 14}
              textAnchor="middle"
              style={{ ...small, fill: warm, fontWeight: 700 }}
            >
              × {c.m}
            </text>
            {[c.top, c.bottom].map((v, r) => (
              <g key={r}>
                <rect
                  x={x0 + i * cell}
                  y={y0 + r * row}
                  width={cell}
                  height={row}
                  fill={r === 0 ? accentFill : warmFill}
                  fillOpacity="0.55"
                  stroke="currentColor"
                />
                <text
                  x={x0 + i * cell + cell / 2}
                  y={y0 + r * row + row / 2 + 7}
                  textAnchor="middle"
                  style={label}
                >
                  {v}
                </text>
              </g>
            ))}
          </g>
        ))}
        <rect
          x="2"
          y={y0}
          width={x0 + cell * 3 - 2}
          height={row * 2}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
      </svg>
    </figure>
  );
}

function RateThroughOne() {
  const pairs: Pair[] = [
    { top: "0", bottom: "0", at: 0 },
    { top: "15", bottom: "1", at: 1 / 5, strong: true },
    { top: "45", bottom: "3", at: 3 / 5 },
    { top: "75", bottom: "5", at: 1 },
  ];
  const x = (p: number) => 130 + p * 310;
  /** A curved arrow from one mark to another, bulging away from the lines. */
  const arc = (
    from: number,
    to: number,
    text: string,
    y: number,
    up: boolean,
  ) => {
    const bulge = up ? -26 : 26,
      mid = (x(from) + x(to)) / 2;
    return (
      <g data-step={text}>
        <path
          d={`M${x(from)} ${y} Q${mid} ${y + bulge} ${x(to)} ${y}`}
          fill="none"
          stroke={warm}
          strokeWidth="2"
        />
        <circle cx={x(to)} cy={y} r="4" fill={warm} />
        <text
          x={mid}
          y={y + (up ? -18 : 32)}
          textAnchor="middle"
          style={{ ...small, fill: warm, fontWeight: 700 }}
        >
          {text}
        </text>
      </g>
    );
  };
  return (
    <DoubleLine
      id="rate-through-one"
      topLabel="Miles"
      bottomLabel="Hours"
      pairs={pairs}
      highlight={[0, 1 / 5]}
      height={290}
      yTop={104}
      title="Divide both lines by 3, then multiply both by 5"
      description="Double number line drawn to scale. 45 miles is aligned with 3 hours. An arrow labelled divide by 3 leads to 15 miles and 1 hour, the unit rate. An arrow labelled multiply by 5 leads to 75 miles and 5 hours."
    >
      {arc(3 / 5, 1 / 5, "÷ 3", 52, true)}
      {arc(1 / 5, 1, "× 5", 238, false)}
    </DoubleLine>
  );
}

function FractionRateCopies() {
  const pairs: Pair[] = [0, 1, 2, 3, 4].map((k) => ({
    top: k === 0 ? "0" : k % 2 === 0 ? String(k / 2) : `${k}/2`,
    bottom: k === 0 ? "0" : k === 4 ? "1" : k === 2 ? "1/2" : `${k}/4`,
    at: k / 4,
    strong: k === 1 || k === 4,
  }));
  return (
    <DoubleLine
      id="fraction-rate-copies"
      topLabel="Miles"
      bottomLabel="Hours"
      pairs={pairs}
      highlight={[0, 1 / 4]}
      title="4 copies of 1/4 hour fill 1 hour, and 4 copies of 1/2 mile make 2 miles"
      description="Double number line drawn to scale. The hours line from 0 to 1 is split into quarters: 1/4, 1/2, 3/4 and 1. Aligned with them, the miles line shows 1/2, 1, 3/2 and 2. The first quarter hour with 1/2 mile is highlighted; 4 equal copies of it reach 1 hour and 2 miles."
    />
  );
}

function StoryTapes() {
  const x0 = 40,
    part = 54;
  const rows = [
    { y: 34, unknown: "total", text: "6 × 8 = ?" },
    { y: 134, unknown: "size", text: "48 ÷ 6 = ?" },
    { y: 234, unknown: "groups", text: "48 ÷ 8 = ?" },
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="story-tapes"
        viewBox="0 0 480 320"
        role="img"
        aria-label="Three tape diagrams of 6 equal parts of 8 making 48. First: the parts are labelled 8 and the total is unknown, 6 × 8 = ?. Second: the total 48 is known and each part is unknown, 48 ÷ 6 = ?. Third: the total 48 and part size 8 are known and the number of parts is unknown, 48 ÷ 8 = ?."
        style={svgStyle}
      >
        <title>One story, three unknowns</title>
        {rows.map((row) => (
          <g
            key={row.unknown}
            data-unknown={row.unknown}
            data-total="48"
            data-parts="6"
            data-size="8"
          >
            <path
              d={`M${x0} ${row.y + 8} v-8 h${part * 6} v8`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x={x0 + part * 3}
              y={row.y - 6}
              textAnchor="middle"
              style={{
                ...label,
                fontWeight: 700,
                fill: row.unknown === "total" ? accent : "currentColor",
              }}
            >
              {row.unknown === "total" ? "?" : "48"}
            </text>
            {Array.from({ length: 6 }, (_, i) => (
              <g key={i}>
                <rect
                  x={x0 + i * part}
                  y={row.y + 14}
                  width={part}
                  height="36"
                  fill={
                    row.unknown === "groups" && i > 0
                      ? "none"
                      : i === 0
                        ? accentFill
                        : "none"
                  }
                  stroke="currentColor"
                  strokeDasharray={
                    row.unknown === "groups" && i > 0 ? "5 4" : undefined
                  }
                  strokeWidth="1.5"
                />
                {(row.unknown !== "groups" || i === 0) && (
                  <text
                    x={x0 + i * part + part / 2}
                    y={row.y + 39}
                    textAnchor="middle"
                    style={{
                      ...small,
                      fill: row.unknown === "size" ? accent : "currentColor",
                      fontWeight: row.unknown === "size" ? 700 : 400,
                    }}
                  >
                    {row.unknown === "size" ? "?" : "8"}
                  </text>
                )}
              </g>
            ))}
            {row.unknown === "groups" && (
              <text
                x={x0 + part * 3.5}
                y={row.y + 72}
                textAnchor="middle"
                style={{ ...small, fill: accent, fontWeight: 700 }}
              >
                How many parts of 8?
              </text>
            )}
            <text
              x={x0 + part * 6 + 20}
              y={row.y + 39}
              style={{ ...label, fontWeight: 700 }}
            >
              {row.text}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
