import React from "react";

export type ComparisonIllustrationKind =
  | "comparison-pairing"
  | "comparison-number-path"
  | "comparison-place-chart"
  | "large-place-value-chart";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const highlight = { fill: "currentColor", fillOpacity: 0.14 };

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: ComparisonIllustrationKind;
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

/** Fixed teaching models with exact positions; colors inherit the text color so
 * they read in print, light and dark. */
export function ComparisonIllustration({
  kind,
}: {
  kind: ComparisonIllustrationKind;
}) {
  if (kind === "comparison-pairing") {
    const circles = [40, 80, 120, 160, 200],
      squares = [40, 120, 200, 280];
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 136"
        label="Five circles close together above four squares spread wide. Lines pair four circles with four squares; one circle has no partner."
        caption="Four pairs and one circle left over: 5 circles > 4 squares, although the squares stretch farther."
      >
        {squares.map((x, i) => (
          <line
            key={`p${i}`}
            data-pair={i}
            x1={circles[i]}
            y1={48}
            x2={x}
            y2={92}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}
        {circles.map((x) => (
          <circle key={x} cx={x} cy={36} r={12} fill="currentColor" />
        ))}
        <circle
          cx={200}
          cy={36}
          r={18}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <text x={224} y={41} fill="currentColor" style={{ fontSize: 14 }}>
          no partner
        </text>
        {squares.map((x) => (
          <rect
            key={x}
            x={x - 12}
            y={92}
            width={24}
            height={24}
            rx={2}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          />
        ))}
      </Frame>
    );
  }
  if (kind === "comparison-number-path") {
    const box = 26,
      left = 17;
    const x = (n: number) => left + n * box;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 104"
        label="A number path from 0 to 10 with 4 and 7 marked. An arrow from 4 to 7 shows that 7 comes later in the count."
        caption="7 comes after 4 in the count, so 7 > 4 and 4 < 7."
      >
        {Array.from({ length: 11 }, (_, n) => (
          <g key={n}>
            <rect
              x={x(n)}
              y={14}
              width={box}
              height={box}
              {...(n === 4 || n === 7 ? highlight : { fill: "none" })}
              stroke="currentColor"
              strokeWidth={n === 4 || n === 7 ? 2.5 : 1}
            />
            <text
              x={x(n) + box / 2}
              y={33}
              textAnchor="middle"
              fill="currentColor"
              style={{
                fontWeight: n === 4 || n === 7 ? 700 : 400,
                fontSize: 14,
              }}
            >
              {n}
            </text>
          </g>
        ))}
        <path
          d={`M${x(4) + box / 2} 46 Q${(x(4) + x(7)) / 2 + box / 2} 72 ${x(7) + box / 2 - 2} 48`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d={`M${x(7) + box / 2 - 9} 50 L${x(7) + box / 2 - 1} 46 L${x(7) + box / 2 - 3} 55`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text
          x={(x(4) + x(7)) / 2 + box / 2}
          y={94}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 13 }}
        >
          later in the count: greater
        </text>
      </Frame>
    );
  }
  if (kind === "comparison-place-chart") {
    const columns = [
      ["Hundreds", "match"],
      ["Tens", "decides"],
      ["Ones", "not needed"],
    ] as const;
    const center = (i: number) => 86 + i * 74;
    const rows = ["607", "670"];
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 180"
        label="A place-value chart with 607 above 670. The hundreds match. The tens column is highlighted: 0 tens and 7 tens. The ones are not needed."
        caption="Compare from the left. The hundreds match; the tens decide: 0 tens < 7 tens, so 607 < 670."
      >
        <rect
          x={center(1) - 32}
          y={34}
          width={64}
          height={110}
          rx={8}
          {...highlight}
        />
        {columns.map(([title, status], i) => (
          <g key={title} data-place={title} opacity={i === 2 ? 0.55 : 1}>
            <text
              x={center(i)}
              y={24}
              textAnchor="middle"
              fill="currentColor"
              style={{ fontWeight: 600, fontSize: 14 }}
            >
              {title}
            </text>
            {rows.map((row, r) => (
              <text
                key={row}
                x={center(i)}
                y={80 + r * 48}
                textAnchor="middle"
                fill="currentColor"
                style={{ fontWeight: i === 1 ? 700 : 400, fontSize: 30 }}
              >
                {row[i]}
              </text>
            ))}
            <text
              x={center(i)}
              y={166}
              textAnchor="middle"
              fill="currentColor"
              style={{ fontSize: 13 }}
            >
              {status}
            </text>
          </g>
        ))}
        <line
          x1={44}
          x2={276}
          y1={34}
          y2={34}
          stroke="currentColor"
          strokeWidth="1"
        />
      </Frame>
    );
  }
  const places = [
    ["Hundreds", "3", "300,000"],
    ["Tens", "7", "70,000"],
    ["Ones", "2", "2,000"],
    ["Hundreds", "9", "900"],
    ["Tens", "4", "40"],
    ["Ones", "6", "6"],
  ] as const;
  const width = 52,
    left = 4;
  const center = (i: number) => left + width * i + width / 2;
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 172"
      label="A place-value chart for 372,946 in two periods, thousands and ones, with the value of each digit beneath it: 300,000, 70,000, 2,000, 900, 40 and 6. Arrows show that each place is worth ten of the place to its right."
      caption="Each place is worth ten of the place to its right. The 7 is in the ten thousands place: 7 × 10,000 = 70,000."
    >
      <rect
        x={left + width + 2}
        y={22}
        width={width - 4}
        height={100}
        rx={8}
        {...highlight}
      />
      {["Thousands", "Ones"].map((period, p) => (
        <g key={period}>
          <text
            x={left + width * (3 * p + 1.5)}
            y={13}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontWeight: 600, fontSize: 12 }}
          >
            {period}
          </text>
          <line
            x1={left + width * 3 * p + 6}
            x2={left + width * 3 * (p + 1) - 6}
            y1={18}
            y2={18}
            stroke="currentColor"
            strokeWidth="1"
          />
        </g>
      ))}
      {places.map(([name, digit, value], i) => (
        <g key={i}>
          <text
            x={center(i)}
            y={33}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontSize: 10.5 }}
          >
            {name}
          </text>
          <text
            x={center(i)}
            y={76}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontWeight: i === 1 ? 700 : 400, fontSize: 28 }}
          >
            {digit}
          </text>
          <text
            x={center(i)}
            y={110}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontWeight: i === 1 ? 700 : 400, fontSize: 11 }}
          >
            {value}
          </text>
        </g>
      ))}
      <line
        x1={left}
        x2={left + 6 * width}
        y1={40}
        y2={40}
        stroke="currentColor"
        strokeWidth="1"
      />
      {Array.from({ length: 5 }, (_, i) => {
        const from = center(i + 1),
          to = center(i);
        return (
          <g key={i}>
            <path
              d={`M${from - 4} 134 Q${(from + to) / 2} 154 ${to + 4} 134`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d={`M${to + 4} 134 l6 2 M${to + 4} 134 l1 6`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <text
              x={(from + to) / 2}
              y={168}
              textAnchor="middle"
              fill="currentColor"
              style={{ fontSize: 10.5 }}
            >
              ×10
            </text>
          </g>
        );
      })}
    </Frame>
  );
}
