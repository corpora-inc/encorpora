import React from "react";
import { longDivisionSteps } from "../math/long-division";

export type NumberSystemIllustrationKind =
  | "prime-factor-venn"
  | "gcf-area"
  | "multiple-jumps"
  | "long-division"
  | "elevation-line"
  | "opposite-line"
  | "story-jumps";

export const numberSystemIllustrationKinds: readonly NumberSystemIllustrationKind[] =
  [
    "prime-factor-venn",
    "gcf-area",
    "multiple-jumps",
    "long-division",
    "elevation-line",
    "opposite-line",
    "story-jumps",
  ];

const label = { fontSize: 20, fill: "currentColor" } as const;
const small = { fontSize: 16, fill: "currentColor" } as const;
const bold = { ...label, fontWeight: 700 } as const;
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 440,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
/** Typographic minus for displayed numbers. */
const n = (v: number) => (v < 0 ? `−${-v}` : String(v));

/** Fixed teaching models drawn to scale; data attributes let an independent reviewer recheck them. */
export function NumberSystemIllustration({
  kind,
}: {
  kind: NumberSystemIllustrationKind;
}) {
  if (kind === "prime-factor-venn") return <PrimeFactorVenn />;
  if (kind === "gcf-area") return <GcfArea />;
  if (kind === "multiple-jumps") return <MultipleJumps />;
  if (kind === "long-division") return <LongDivision />;
  if (kind === "elevation-line") return <ElevationLine />;
  if (kind === "opposite-line") return <OppositeLine />;
  return <StoryJumps />;
}

function PrimeFactorVenn() {
  const tokens: [string, number, number, number][] = [
    ["left", 2, 106, 138],
    ["shared", 2, 205, 112],
    ["shared", 2, 237, 112],
    ["shared", 2, 205, 160],
    ["shared", 3, 237, 160],
    ["right", 3, 334, 138],
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="prime-factor-venn"
        data-a="48"
        data-b="72"
        viewBox="0 0 440 290"
        role="img"
        aria-label="Two overlapping circles. The left circle holds the prime factors of 48 and the right circle the prime factors of 72. The overlap holds the shared primes 2, 2, 2 and 3. Only 48 has another 2; only 72 has another 3. The shared primes multiply to 24, the greatest common factor."
        style={svgStyle}
      >
        <title>Shared prime factors make the greatest common factor</title>
        <circle
          cx="160"
          cy="136"
          r="100"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          cx="280"
          cy="136"
          r="100"
          fill="currentColor"
          fillOpacity="0.06"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text x="110" y="26" textAnchor="middle" style={bold}>
          48
        </text>
        <text x="330" y="26" textAnchor="middle" style={bold}>
          72
        </text>
        {tokens.map(([region, prime, x, y], i) => (
          <text
            key={i}
            x={x}
            y={y + 9}
            textAnchor="middle"
            style={{ fontSize: 26, fill: "currentColor", fontWeight: 700 }}
            data-region={region}
            data-prime={prime}
          >
            {prime}
          </text>
        ))}
        <text x="220" y="276" textAnchor="middle" style={label} data-gcf="24">
          shared: 2 × 2 × 2 × 3 = 24
        </text>
      </svg>
      <figcaption style={captionStyle}>
        48 = 2 × 2 × 2 × 2 × 3 and 72 = 2 × 2 × 2 × 3 × 3. The primes both
        numbers contain go in the overlap. Their product, 24, is the greatest
        common factor; multiplying in the 2 only 48 has and the 3 only 72 has
        gives 24 × 2 × 3 = 144, the least common multiple.
      </figcaption>
    </figure>
  );
}

function GcfArea() {
  const unit = 28,
    x0 = 46,
    y0 = 44,
    height = 4,
    widths = [9, 2];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="gcf-area"
        data-height={height}
        data-widths={widths.join(",")}
        viewBox="0 0 400 236"
        role="img"
        aria-label="A rectangle 4 units tall and 11 units wide, split into a part 9 units wide with area 36 and a part 2 units wide with area 8. The whole area is 4 times 11, which equals 36 plus 8."
        style={svgStyle}
      >
        <title>36 + 8 = 4 × 9 + 4 × 2 = 4(9 + 2)</title>
        {widths.map((w, i) => {
          const x = x0 + (i ? widths[0]! * unit : 0);
          return (
            <g key={i}>
              <rect
                x={x}
                y={y0}
                width={w * unit}
                height={height * unit}
                fill="currentColor"
                fillOpacity={i ? 0.22 : 0.08}
                stroke="currentColor"
                strokeWidth="2.5"
                data-part-area={w * height}
              />
              {Array.from({ length: w - 1 }, (_, k) => (
                <line
                  key={k}
                  x1={x + (k + 1) * unit}
                  x2={x + (k + 1) * unit}
                  y1={y0}
                  y2={y0 + height * unit}
                  stroke="currentColor"
                  strokeOpacity="0.25"
                />
              ))}
              {Array.from({ length: height - 1 }, (_, k) => (
                <line
                  key={k}
                  x1={x}
                  x2={x + w * unit}
                  y1={y0 + (k + 1) * unit}
                  y2={y0 + (k + 1) * unit}
                  stroke="currentColor"
                  strokeOpacity="0.25"
                />
              ))}
              <text
                x={x + (w * unit) / 2}
                y={y0 - 12}
                textAnchor="middle"
                style={bold}
              >
                {w}
              </text>
              <text
                x={x + (w * unit) / 2}
                y={y0 + (height * unit) / 2 + 10}
                textAnchor="middle"
                style={{ fontSize: 28, fill: "currentColor", fontWeight: 700 }}
              >
                {w * height}
              </text>
            </g>
          );
        })}
        <text
          x={x0 - 16}
          y={y0 + (height * unit) / 2 + 7}
          textAnchor="middle"
          style={bold}
        >
          {height}
        </text>
        <text x="200" y="210" textAnchor="middle" style={label}>
          4 × 9 + 4 × 2 = 4(9 + 2)
        </text>
      </svg>
      <figcaption style={captionStyle}>
        The two parts share the height 4, the greatest common factor of 36 and
        8. Side by side they make one rectangle 9 + 2 = 11 units wide, so 36 + 8
        = 4 × 11 = 44.
      </figcaption>
    </figure>
  );
}

function MultipleJumps() {
  const x = (v: number) => 20 + v * 8,
    lineY = 118;
  const arcs = (step: number, above: boolean) =>
    Array.from({ length: 48 / step }, (_, i) => {
      const from = x(i * step),
        to = x((i + 1) * step),
        lift = above ? -30 : 30;
      return (
        <path
          key={`${step}-${i}`}
          data-landing={`${step}:${(i + 1) * step}`}
          d={`M${from} ${lineY + (above ? -3 : 3)} Q${(from + to) / 2} ${lineY + lift * 1.6} ${to} ${lineY + (above ? -3 : 3)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={above ? undefined : "6 4"}
        />
      );
    });
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="multiple-jumps"
        data-steps="6,8"
        data-common="24,48"
        viewBox="0 0 424 236"
        role="img"
        aria-label="A number line from 0 to 48. Solid jumps of 6 above the line land on 6, 12, 18, 24, 30, 36, 42 and 48. Dashed jumps of 8 below the line land on 8, 16, 24, 32, 40 and 48. Both land on 24 and 48, which are circled."
        style={svgStyle}
      >
        <title>Jumps of 6 and of 8 first meet at 24</title>
        <line
          x1={x(0) - 6}
          x2={x(48) + 6}
          y1={lineY}
          y2={lineY}
          stroke="currentColor"
          strokeWidth="2"
        />
        {Array.from({ length: 49 }, (_, v) => (
          <line
            key={v}
            x1={x(v)}
            x2={x(v)}
            y1={lineY - (v % 6 === 0 || v % 8 === 0 ? 6 : 3)}
            y2={lineY + (v % 6 === 0 || v % 8 === 0 ? 6 : 3)}
            stroke="currentColor"
            strokeOpacity={v % 6 === 0 || v % 8 === 0 ? 1 : 0.4}
          />
        ))}
        {arcs(6, true)}
        {arcs(8, false)}
        {Array.from({ length: 9 }, (_, i) => (
          <text
            key={`a${i}`}
            x={x(i * 6)}
            y="44"
            textAnchor="middle"
            style={{ ...small, fontWeight: i % 4 === 0 && i ? 700 : 400 }}
          >
            {i * 6}
          </text>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <text
            key={`b${i}`}
            x={x(i * 8)}
            y="204"
            textAnchor="middle"
            style={{ ...small, fontWeight: i % 3 === 0 && i ? 700 : 400 }}
          >
            {i * 8}
          </text>
        ))}
        {[24, 48].map((v) => (
          <circle
            key={v}
            cx={x(v)}
            cy={lineY}
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            data-common-mark={v}
          />
        ))}
        <text x={x(0)} y="20" style={small}>
          jumps of 6
        </text>
        <text x={x(0)} y="228" style={small}>
          jumps of 8
        </text>
      </svg>
      <figcaption style={captionStyle}>
        Solid jumps of 6 land on the multiples of 6; dashed jumps of 8 land on
        the multiples of 8. The first landing they share is 24, the least common
        multiple. The next is 48 = 2 × 24.
      </figcaption>
    </figure>
  );
}

function LongDivision() {
  const dividend = 8736,
    divisor = 24,
    steps = longDivisionSteps(dividend, divisor);
  const digits = String(dividend).split("");
  const firstWidth = String(steps[0]!.partial).length; // digits used by step 1
  const col = 30,
    x0 = 150,
    row = 34,
    top = 46;
  const cx = (c: number) => x0 + c * col;
  // Each step ends in the column of the dividend digit that completed its partial.
  const rows: { text: string; endCol: number; kind: string; rule?: boolean }[] =
    [];
  steps.forEach((s, i) => {
    const endCol = firstWidth - 1 + i;
    if (i > 0)
      rows.push({
        text: String(s.partial),
        endCol,
        kind: "partial",
      });
    rows.push({ text: String(s.product), endCol, kind: "product", rule: true });
    if (i === steps.length - 1)
      rows.push({ text: String(s.rest), endCol, kind: "rest" });
  });
  const quotient = steps.map((s) => s.digit).join("");
  const height = top + row * (rows.length + 2) + 10;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="long-division"
        data-dividend={dividend}
        data-divisor={divisor}
        data-quotient={quotient}
        viewBox={`0 0 400 ${height}`}
        role="img"
        aria-label="Long division of 8736 by 24 with quotient 364. 24 times 3 is 72, subtracted from 87 leaves 15. Bring down 3 to make 153; 24 times 6 is 144, leaving 9. Bring down 6 to make 96; 24 times 4 is 96, leaving 0."
        style={svgStyle}
      >
        <title>8736 ÷ 24 = 364</title>
        {quotient.split("").map((d, i) => (
          <text
            key={`q${i}`}
            x={cx(firstWidth - 1 + i)}
            y={top}
            textAnchor="middle"
            style={bold}
            data-quotient-digit={d}
          >
            {d}
          </text>
        ))}
        <path
          d={`M${cx(0) - 22} ${top + row + 8} Q${cx(0) - 12} ${top + row / 2 + 6} ${cx(0) - 20} ${top + 10} H${cx(digits.length - 1) + 18}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text
          x={cx(0) - 34}
          y={top + row}
          textAnchor="end"
          style={bold}
          data-divisor-text={divisor}
        >
          {divisor}
        </text>
        {digits.map((d, i) => (
          <text
            key={`d${i}`}
            x={cx(i)}
            y={top + row}
            textAnchor="middle"
            style={bold}
          >
            {d}
          </text>
        ))}
        {rows.map((r, i) => {
          const y = top + row * (i + 2),
            chars = r.text.split(""),
            startCol = r.endCol - chars.length + 1;
          return (
            <g
              key={i}
              data-row={r.kind}
              data-value={r.text}
              data-end-col={r.endCol}
            >
              {r.kind === "product" && (
                <text
                  x={cx(startCol) - 24}
                  y={y}
                  textAnchor="middle"
                  style={label}
                >
                  −
                </text>
              )}
              {chars.map((c, k) => (
                <text
                  key={k}
                  x={cx(startCol + k)}
                  y={y}
                  textAnchor="middle"
                  style={label}
                >
                  {c}
                </text>
              ))}
              {r.rule && (
                <line
                  x1={cx(startCol) - 14}
                  x2={cx(r.endCol) + 14}
                  y1={y + 9}
                  y2={y + 9}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption style={captionStyle}>
        Each quotient digit sits above the last dividend digit it uses. Under
        it, subtract the product of that digit and 24, then bring down the next
        digit: 87 − 72 = 15, then 153 − 144 = 9, then 96 − 96 = 0. Check: 364 ×
        24 = 8736.
      </figcaption>
    </figure>
  );
}

function ElevationLine() {
  const y = (v: number) => 150 - v * 3.2,
    axisX = 120;
  const points: [number, string][] = [
    [30, "gull"],
    [-20, "diver"],
  ];
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="elevation-line"
        viewBox="0 0 360 300"
        role="img"
        aria-label="A vertical number line of heights in meters from −30 to 40, labeled every 10, with sea level at 0. The region below sea level is shaded as water. A gull is marked at 30 and a diver at −20."
        style={svgStyle}
      >
        <title>Above sea level is positive, below is negative</title>
        <rect
          x="40"
          y={y(0)}
          width="300"
          height={y(-35) - y(0)}
          fill="currentColor"
          fillOpacity="0.08"
        />
        <line
          x1="40"
          x2="340"
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          strokeDasharray="5 5"
        />
        <text x="336" y={y(0) - 8} textAnchor="end" style={small}>
          sea level
        </text>
        <line
          x1={axisX}
          x2={axisX}
          y1={y(44)}
          y2={y(-34)}
          stroke="currentColor"
          strokeWidth="2"
        />
        {Array.from({ length: 8 }, (_, i) => {
          const v = -30 + i * 10;
          return (
            <g key={v}>
              <line
                data-tick={v}
                x1={axisX - (v === 0 ? 12 : 7)}
                x2={axisX + (v === 0 ? 12 : 7)}
                y1={y(v)}
                y2={y(v)}
                stroke="currentColor"
                strokeWidth={v === 0 ? 2.5 : 1.5}
              />
              <text
                x={axisX - 18}
                y={y(v) + 6}
                textAnchor="end"
                style={{ ...small, fontWeight: v === 0 ? 700 : 400 }}
              >
                {n(v)}
              </text>
            </g>
          );
        })}
        {points.map(([v, who]) => (
          <g key={who} data-point={v}>
            <circle
              data-value={v}
              cx={axisX}
              cy={y(v)}
              r="6"
              fill="currentColor"
            />
            <line
              x1={axisX + 8}
              x2={axisX + 40}
              y1={y(v)}
              y2={y(v)}
              stroke="currentColor"
            />
            <text x={axisX + 48} y={y(v) + 6} style={label}>
              {who}: {n(v)}
            </text>
          </g>
        ))}
        <text x={axisX + 14} y="18" style={small}>
          meters
        </text>
      </svg>
      <figcaption style={captionStyle}>
        Sea level is 0. The gull is 30 meters above it, at 30; the diver is 20
        meters below it, at −20. Each number's distance from 0 is the height
        without its sign.
      </figcaption>
    </figure>
  );
}

function OppositeLine() {
  const x = (v: number) => 30 + (v + 10) * 19,
    lineY = 104;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="opposite-line"
        data-point="-6"
        data-opposite="6"
        viewBox="0 0 440 150"
        role="img"
        aria-label="A number line from −10 to 10 with one-unit ticks. Points are marked at −6 and 6. Brackets above the line show that each is 6 units from 0."
        style={svgStyle}
      >
        <title>6 and −6 are the same distance from 0</title>
        <line
          x1={x(-10) - 8}
          x2={x(10) + 8}
          y1={lineY}
          y2={lineY}
          stroke="currentColor"
          strokeWidth="2"
        />
        {Array.from({ length: 21 }, (_, i) => {
          const v = i - 10;
          return (
            <g key={v}>
              <line
                data-tick={v}
                x1={x(v)}
                x2={x(v)}
                y1={lineY - (v === 0 ? 11 : v % 5 === 0 ? 7 : 4)}
                y2={lineY + (v === 0 ? 11 : v % 5 === 0 ? 7 : 4)}
                stroke="currentColor"
                strokeWidth={v === 0 ? 2.5 : 1.25}
              />
              {(v % 10 === 0 || Math.abs(v) === 6) && (
                <text
                  x={x(v)}
                  y={lineY + 30}
                  textAnchor="middle"
                  style={{
                    ...small,
                    fontWeight: v === 0 || Math.abs(v) === 6 ? 700 : 400,
                  }}
                >
                  {n(v)}
                </text>
              )}
            </g>
          );
        })}
        {[-6, 6].map((v) => (
          <g key={v}>
            <circle
              data-value={v}
              cx={x(v)}
              cy={lineY}
              r="6.5"
              fill="currentColor"
            />
            <path
              d={`M${x(v)} ${lineY - 20} v-10 H${x(0)} v10`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x={(x(v) + x(0)) / 2}
              y={lineY - 40}
              textAnchor="middle"
              style={small}
              data-distance={Math.abs(v)}
            >
              6 units
            </text>
          </g>
        ))}
      </svg>
      <figcaption style={captionStyle}>
        −6 is 6 units to the left of 0 and 6 is 6 units to the right. Folding
        the line at 0 would place each point on the other, so each is the
        opposite of the other.
      </figcaption>
    </figure>
  );
}

function StoryJumps() {
  const start = -4.5,
    jumps = [7.25, -1.5, -1.5, -1.5];
  const min = -10,
    max = 5,
    lineY = 112;
  const x = (v: number) => 24 + ((v - min) / (max - min)) * 392;
  const stops = jumps.reduce((all, j) => [...all, all.at(-1)! + j], [start]);
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="story-jumps"
        data-start={start}
        data-jumps={jumps.join(",")}
        data-end={stops.at(-1)}
        viewBox="0 0 440 220"
        role="img"
        aria-label="A number line from −10 to 5. A solid arrow above the line jumps from −4.5 to the right by 7.25 to 2.75. Three dashed arrows below the line each jump 1.5 to the left, through 1.25 and −0.25, ending at −1.75."
        style={svgStyle}
      >
        <title>−4.5 + 7.25 + 3 × (−1.5) = −1.75</title>
        <line
          x1={x(min) - 8}
          x2={x(max) + 8}
          y1={lineY}
          y2={lineY}
          stroke="currentColor"
          strokeWidth="2"
        />
        {Array.from({ length: max - min + 1 }, (_, i) => {
          const v = min + i;
          return (
            <g key={v}>
              <line
                data-tick={v}
                x1={x(v)}
                x2={x(v)}
                y1={lineY - (v === 0 ? 11 : v % 5 === 0 ? 7 : 4)}
                y2={lineY + (v === 0 ? 11 : v % 5 === 0 ? 7 : 4)}
                stroke="currentColor"
                strokeWidth={v === 0 ? 2.5 : 1.25}
              />
              {v % 5 === 0 && (
                <text
                  x={x(v)}
                  y={lineY + 74}
                  textAnchor="middle"
                  style={{ ...small, fontWeight: v === 0 ? 700 : 400 }}
                >
                  {n(v)}
                </text>
              )}
            </g>
          );
        })}
        {jumps.map((j, i) => {
          const from = x(stops[i]!),
            to = x(stops[i + 1]!),
            above = j > 0,
            lift = above ? -52 : 30,
            base = lineY + (above ? -4 : 4),
            control = lineY + lift * 1.7;
          const dx = to - (from + to) / 2,
            dy = base - control,
            len = Math.hypot(dx, dy),
            ux = dx / len,
            uy = dy / len;
          return (
            <g key={i} data-jump={j}>
              <path
                d={`M${from} ${base} Q${(from + to) / 2} ${control} ${to} ${base}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={above ? undefined : "5 4"}
              />
              <path
                d={`M${to} ${base} L${to - 9 * ux - 4 * uy} ${base - 9 * uy + 4 * ux} L${to - 9 * ux + 4 * uy} ${base - 9 * uy - 4 * ux} Z`}
                fill="currentColor"
              />
              <text
                x={(from + to) / 2}
                y={above ? lineY + lift - 2 : lineY + lift + 18}
                textAnchor="middle"
                style={{ ...small, fontWeight: 700 }}
              >
                {j > 0 ? `+${j}` : n(j)}
              </text>
            </g>
          );
        })}
        <circle
          data-value={start}
          cx={x(start)}
          cy={lineY}
          r="6"
          fill="currentColor"
        />
        <text x={x(start)} y={lineY + 30} textAnchor="middle" style={small}>
          {n(start)}
        </text>
        <circle
          data-value={stops.at(-1)}
          cx={x(stops.at(-1)!)}
          cy={lineY}
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <text
          x={x(stops.at(-1)!)}
          y={lineY - 14}
          textAnchor="middle"
          style={{ ...small, fontWeight: 700 }}
        >
          {n(stops.at(-1)!)}
        </text>
      </svg>
      <figcaption style={captionStyle}>
        Start at −4.5. The rise of 7.25 is a jump to the right, to 2.75. Each
        fall of 1.5 is a dashed jump to the left: 1.25, then −0.25, then −1.75.
      </figcaption>
    </figure>
  );
}
