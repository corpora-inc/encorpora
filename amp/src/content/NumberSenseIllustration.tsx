import React from "react";

export type NumberSenseIllustrationKind =
  | "hundred-chart-moves"
  | "teen-ten-frame"
  | "number-line-hop-pair"
  | "rounding-halfway"
  | "power-of-ten-shift";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const highlight = { fill: "currentColor", fillOpacity: 0.14 };
const text = { fill: "currentColor" };

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: NumberSenseIllustrationKind;
  viewBox: string;
  label: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration={kind}
        viewBox={viewBox}
        role="img"
        aria-label={label}
        style={svgStyle}
        fontFamily="inherit"
      >
        {children}
      </svg>
      <figcaption style={captionStyle}>{caption}</figcaption>
    </figure>
  );
}
function Arrow({ d, head }: { d: string; head: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d={head}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

/** A number line with unit ticks and labeled tens between `min` and `max`. */
function Line({
  min,
  max,
  y,
  every = 10,
}: {
  min: number;
  max: number;
  y: number;
  every?: number;
}) {
  const x = (n: number) => 20 + ((n - min) * 280) / (max - min);
  return (
    <>
      <line
        x1={20}
        x2={300}
        y1={y}
        y2={y}
        stroke="currentColor"
        strokeWidth="2"
      />
      {Array.from({ length: max - min + 1 }, (_, i) => {
        const n = min + i,
          major = (n - min) % every === 0;
        return (
          <g key={n}>
            <line
              x1={x(n)}
              x2={x(n)}
              y1={y - (major ? 8 : 4)}
              y2={y + (major ? 8 : 4)}
              stroke="currentColor"
              strokeWidth={major ? 1.75 : 0.9}
            />
            {major && (
              <text
                x={x(n)}
                y={y + 24}
                textAnchor="middle"
                fontSize="13"
                {...text}
              >
                {n}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** Fixed teaching models with exact positions; colors inherit the text color
 * so they read in print, light and dark. */
export function NumberSenseIllustration({
  kind,
}: {
  kind: NumberSenseIllustrationKind;
}) {
  if (kind === "hundred-chart-moves") {
    const w = 64,
      h = 38,
      gapX = 34,
      gapY = 26,
      left = 30,
      top = 8;
    const x = (column: number) => left + column * (w + gapX),
      y = (row: number) => top + row * (h + gapY);
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 178"
        label="Rows 51 to 53, 61 to 63 and 71 to 73 of the hundred chart. An arrow from 62 to 63 is marked plus 1; an arrow from 62 down to 72 is marked plus 10."
        caption="One square right is 1 more; one row down is 10 more."
      >
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((column) => {
            const n = 51 + 10 * row + column,
              marked = n === 62 || n === 63 || n === 72;
            return (
              <g key={n}>
                <rect
                  x={x(column)}
                  y={y(row)}
                  width={w}
                  height={h}
                  rx={4}
                  {...(n === 62 ? highlight : { fill: "none" })}
                  stroke="currentColor"
                  strokeWidth={marked ? 2.25 : 1}
                />
                <text
                  x={x(column) + w / 2}
                  y={y(row) + 25}
                  textAnchor="middle"
                  fontSize="17"
                  fontWeight={marked ? 700 : 400}
                  {...text}
                >
                  {n}
                </text>
              </g>
            );
          }),
        )}
        <Arrow
          d={`M${x(1) + w + 5} ${y(1) + h / 2} H${x(2) - 5}`}
          head={`M${x(2) - 5} ${y(1) + h / 2} l-6 -5 M${x(2) - 5} ${y(1) + h / 2} l-6 5`}
        />
        <text
          x={x(1) + w + gapX / 2}
          y={y(1) + h / 2 - 8}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          {...text}
        >
          +1
        </text>
        <Arrow
          d={`M${x(1) + w / 2} ${y(1) + h + 4} V${y(2) - 4}`}
          head={`M${x(1) + w / 2} ${y(2) - 4} l-5 -6 M${x(1) + w / 2} ${y(2) - 4} l5 -6`}
        />
        <text
          x={x(1) + w / 2 + 10}
          y={y(1) + h + gapY / 2 + 5}
          fontSize="13"
          fontWeight="700"
          {...text}
        >
          +10
        </text>
      </Frame>
    );
  }
  if (kind === "teen-ten-frame") {
    const size = 26;
    const frame = (x0: number, filled: number, key: string) => (
      <g key={key}>
        {Array.from({ length: 10 }, (_, i) => {
          const x = x0 + (i % 5) * size,
            y = 16 + Math.floor(i / 5) * size;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={size}
                height={size}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              {i < filled && (
                <circle
                  cx={x + size / 2}
                  cy={y + size / 2}
                  r={8.5}
                  fill="currentColor"
                />
              )}
            </g>
          );
        })}
        <text
          x={x0 + (5 * size) / 2}
          y={96}
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          {...text}
        >
          {filled === 10 ? "10" : `${filled}`}
        </text>
      </g>
    );
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 108"
        label="A full ten-frame of 10 counters beside a ten-frame with 4 counters."
        caption="A full frame and 4 more: 10 + 4 = 14, which is 1 ten and 4 ones."
      >
        {frame(20, 10, "full")}
        {frame(170, 4, "extra")}
      </Frame>
    );
  }
  if (kind === "number-line-hop-pair") {
    const min = 20,
      max = 50,
      y = 92;
    const x = (n: number) => 20 + ((n - min) * 280) / (max - min);
    const hop = (from: number, to: number, lift: number, label: string) => (
      <g key={label}>
        <Arrow
          d={`M${x(from)} ${y - 4} Q${(x(from) + x(to)) / 2} ${y - 4 - 2 * lift} ${x(to)} ${y - 4}`}
          head={`M${x(to)} ${y - 4} l6 -5 M${x(to)} ${y - 4} l1 -8`}
        />
        <text
          x={(x(from) + x(to)) / 2}
          y={y - 10 - lift}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          {...text}
        >
          {label}
        </text>
      </g>
    );
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 136"
        label="A number line from 20 to 50. A hop of minus 20 goes from 46 to 26, then a hop of minus 3 goes from 26 to 23."
        caption="46 − 23: hop back 20 to 26, then back 3 to 23."
      >
        <Line min={min} max={max} y={y} />
        {hop(46, 26, 34, "−20")}
        {hop(26, 23, 14, "−3")}
        {[46, 26, 23].map((n) => (
          <g key={n}>
            <circle cx={x(n)} cy={y} r={4.5} fill="currentColor" />
            <text
              x={x(n)}
              y={y + 40}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              {...text}
            >
              {n}
            </text>
          </g>
        ))}
      </Frame>
    );
  }
  if (kind === "rounding-halfway") {
    const min = 340,
      max = 350,
      y = 70;
    const x = (n: number) => 20 + ((n - min) * 280) / (max - min);
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 136"
        label="A number line from 340 to 350 with 345 marked halfway. 347 is 7 from 340 and 3 from 350, so it is closer to 350."
        caption="347 is past the halfway mark 345, 3 from 350 and 7 from 340: it rounds to 350."
      >
        <Line min={min} max={max} y={y} every={10} />
        <line
          x1={x(345)}
          x2={x(345)}
          y1={y - 22}
          y2={y + 12}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text x={x(345)} y={y - 28} textAnchor="middle" fontSize="12" {...text}>
          halfway 345
        </text>
        <circle cx={x(347)} cy={y} r={6} fill="currentColor" />
        <text
          x={x(347)}
          y={y + 24}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          {...text}
        >
          347
        </text>
        {[
          [340, 347, "7"],
          [347, 350, "3"],
        ].map(([a, b, label]) => (
          <g key={label}>
            <path
              d={`M${x(Number(a)) + 2} ${y + 40} v6 H${x(Number(b)) - 2} v-6`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x={(x(Number(a)) + x(Number(b))) / 2}
              y={y + 62}
              textAnchor="middle"
              fontSize="13"
              fontWeight={label === "3" ? 700 : 400}
              {...text}
            >
              {label}
            </text>
          </g>
        ))}
      </Frame>
    );
  }
  const columns = ["Hundreds", "Tens", "Ones", "Tenths"];
  const rows = [
    { label: "4.7", digits: ["", "", "4", "7"] },
    { label: "× 10 = 47", digits: ["", "4", "7", ""] },
    { label: "× 10 = 470", digits: ["4", "7", "0", ""] },
  ];
  const w = 56,
    left = 92;
  const center = (i: number) => left + w * i + w / 2;
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 168"
      label="A place-value chart with hundreds, tens, ones and tenths. 4.7 times 10 is 47 and times 10 again is 470; each time every digit moves one place left."
      caption="Each × 10 moves every digit one place left: 4.7 → 47 → 470. The decimal point stays between the ones and the tenths."
    >
      {columns.map((name, i) => (
        <text
          key={name}
          x={center(i)}
          y={16}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="600"
          {...text}
        >
          {name}
        </text>
      ))}
      <line
        x1={left}
        x2={left + 4 * w}
        y1={24}
        y2={24}
        stroke="currentColor"
        strokeWidth="1"
      />
      <line
        x1={left + 3 * w}
        x2={left + 3 * w}
        y1={24}
        y2={160}
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx={left + 3 * w} cy={164} r={3} fill="currentColor" />
      {rows.map((row, r) => (
        <g key={row.label}>
          <text
            x={left - 8}
            y={60 + r * 44}
            textAnchor="end"
            fontSize="12"
            {...text}
          >
            {row.label}
          </text>
          {row.digits.map((digit, i) => (
            <text
              key={i}
              x={center(i)}
              y={62 + r * 44}
              textAnchor="middle"
              fontSize="26"
              fontWeight={digit === "4" ? 700 : 400}
              {...text}
            >
              {digit}
            </text>
          ))}
        </g>
      ))}
    </Frame>
  );
}
