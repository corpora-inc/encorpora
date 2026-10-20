import React from "react";

export type FactArrayIllustrationKind =
  | "array-rows-columns"
  | "array-turn"
  | "split-array"
  | "fact-family-array"
  | "share-measure"
  | "missing-factor-skip"
  | "table-patterns";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const text = { fill: "currentColor", fontSize: 14 };

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: FactArrayIllustrationKind;
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

/** rows × columns dots at pitch p from (x, y); `hollow(row)` draws a row open. */
function Dots({
  rows,
  columns,
  x,
  y,
  p,
  hollow = () => false,
}: {
  rows: number;
  columns: number;
  x: number;
  y: number;
  p: number;
  hollow?: (row: number) => boolean;
}) {
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++)
      out.push(
        <circle
          key={`${r}-${c}`}
          cx={x + (c + 0.5) * p}
          cy={y + (r + 0.5) * p}
          r={p * 0.3}
          fill={hollow(r) ? "none" : "currentColor"}
          stroke="currentColor"
          strokeWidth="1.5"
        />,
      );
  return <>{out}</>;
}

/** Fixed teaching models with exact counts; colors inherit the text color so
 * they read in print, light and dark. Open and filled dots carry the contrast. */
export function FactArrayIllustration({
  kind,
}: {
  kind: FactArrayIllustrationKind;
}) {
  if (kind === "array-rows-columns")
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 150"
        label="An array of 4 rows with 6 dots in each row. The running totals at the row ends are 6, 12, 18 and 24. Below: 4 × 6 = 24."
        caption="Each new row adds one more 6. Four rows of six: 4 × 6 = 24."
      >
        <Dots rows={4} columns={6} x={60} y={10} p={24} />
        {[6, 12, 18, 24].map((n, r) => (
          <text key={n} x={222} y={10 + (r + 0.5) * 24 + 5} {...text}>
            {n}
          </text>
        ))}
        <text
          x={132}
          y={134}
          textAnchor="middle"
          {...text}
          style={{ fontSize: 16 }}
        >
          4 × 6 = 24
        </text>
      </Frame>
    );
  if (kind === "array-turn")
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 146"
        label="Left: an array of 3 rows of 5 dots, labeled 3 × 5 = 15. Right: the same array turned a quarter turn, 5 rows of 3 dots, labeled 5 × 3 = 15."
        caption="A quarter turn makes rows into columns. The dots do not change, so 3 × 5 = 5 × 3."
      >
        <Dots rows={3} columns={5} x={18} y={30} p={22} />
        <text x={73} y={124} textAnchor="middle" {...text}>
          3 × 5 = 15
        </text>
        <path
          d="M 146 62 A 22 22 0 1 1 168 84"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M 168 84 l -9 -1 l 6 -7 z" fill="currentColor" />
        <Dots rows={5} columns={3} x={228} y={6} p={22} />
        <text x={261} y={138} textAnchor="middle" {...text}>
          5 × 3 = 15
        </text>
      </Frame>
    );
  if (kind === "split-array")
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 168"
        label="An array of 7 rows of 6 dots, split after 5 rows. The top 5 rows of filled dots make 5 × 6 = 30; the bottom 2 rows of open dots make 2 × 6 = 12. Below: 7 × 6 = 30 + 12 = 42."
        caption="Seven rows split into five rows and two rows: two easy facts make the hard one."
      >
        <Dots rows={7} columns={6} x={60} y={6} p={18} hollow={(r) => r >= 5} />
        <line
          x1={54}
          x2={174}
          y1={96}
          y2={96}
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <text x={186} y={56} {...text}>
          5 × 6 = 30
        </text>
        <text x={186} y={119} {...text}>
          2 × 6 = 12
        </text>
        <text
          x={160}
          y={156}
          textAnchor="middle"
          {...text}
          style={{ fontSize: 16 }}
        >
          7 × 6 = 30 + 12 = 42
        </text>
      </Frame>
    );
  if (kind === "fact-family-array")
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 110"
        label="An array of 4 rows of 7 dots, with four facts beside it: 4 × 7 = 28, 7 × 4 = 28, 28 ÷ 4 = 7 and 28 ÷ 7 = 4."
        caption="One array, four facts. Each division asks for the side of the array that is not given."
      >
        <Dots rows={4} columns={7} x={18} y={14} p={20} />
        {["4 × 7 = 28", "7 × 4 = 28", "28 ÷ 4 = 7", "28 ÷ 7 = 4"].map(
          (fact, i) => (
            <text
              key={fact}
              x={196}
              y={32 + i * 21}
              {...text}
              style={{ fontSize: 15 }}
            >
              {fact}
            </text>
          ),
        )}
      </Frame>
    );
  if (kind === "share-measure") {
    const plate = (cx: number) => (
      <g key={cx}>
        <circle
          cx={cx}
          cy={62}
          r={22}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {[
          [-7, -7],
          [7, -7],
          [-7, 7],
          [7, 7],
        ].map(([dx, dy]) => (
          <circle
            key={`${dx}${dy}`}
            cx={cx + dx!}
            cy={62 + dy!}
            r={4.5}
            fill="currentColor"
          />
        ))}
      </g>
    );
    const group = (x: number, y: number) => (
      <g key={`${x}-${y}`}>
        <rect
          x={x}
          y={y}
          width={56}
          height={22}
          rx={8}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={x + 12 + i * 16}
            cy={y + 11}
            r={4.5}
            fill="currentColor"
          />
        ))}
      </g>
    );
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 160"
        label="Left, sharing: 12 counters dealt onto 3 plates, 4 on each plate. Right, measuring: 12 counters put into groups of 3, making 4 groups. Below: 12 ÷ 3 = 4 both ways."
        caption="Sharing knows the number of groups and finds their size. Measuring knows the size and finds the number of groups. Both are 12 ÷ 3."
      >
        <text x={78} y={18} textAnchor="middle" {...text}>
          Share among 3
        </text>
        {[30, 78, 126].map(plate)}
        <text x={78} y={110} textAnchor="middle" {...text}>
          4 in each
        </text>
        <line
          x1={160}
          x2={160}
          y1={8}
          y2={116}
          stroke="currentColor"
          strokeOpacity={0.4}
        />
        <text x={240} y={18} textAnchor="middle" {...text}>
          Groups of 3
        </text>
        {group(180, 34)}
        {group(244, 34)}
        {group(180, 68)}
        {group(244, 68)}
        <text x={240} y={110} textAnchor="middle" {...text}>
          4 groups
        </text>
        <text
          x={160}
          y={146}
          textAnchor="middle"
          {...text}
          style={{ fontSize: 16 }}
        >
          12 ÷ 3 = 4
        </text>
      </Frame>
    );
  }
  if (kind === "missing-factor-skip") {
    const x = (n: number) => 22 + (n * 276) / 42;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 104"
        label="A number line from 0 to 42 with seven jumps of 6: 6, 12, 18, 24, 30, 36, 42. Seven jumps reach 42, so 6 × 7 = 42."
        caption="6 × □ = 42: skip-count by 6 and count the jumps. Seven jumps reach 42."
      >
        <line
          x1={x(0)}
          x2={x(42)}
          y1={70}
          y2={70}
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <line
              x1={x(6 * i)}
              x2={x(6 * i)}
              y1={64}
              y2={76}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x={x(6 * i)}
              y={94}
              textAnchor="middle"
              {...text}
              style={{ fontSize: 13 }}
            >
              {6 * i}
            </text>
            {i > 0 && (
              <>
                <path
                  d={`M ${x(6 * i - 6)} 64 Q ${(x(6 * i - 6) + x(6 * i)) / 2} 34 ${x(6 * i)} 64`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <text
                  x={(x(6 * i - 6) + x(6 * i)) / 2}
                  y={38}
                  textAnchor="middle"
                  {...text}
                  style={{ fontSize: 12 }}
                >
                  {i}
                </text>
              </>
            )}
          </g>
        ))}
      </Frame>
    );
  }
  const columns = [4, 5, 6, 7, 8],
    rows = [3, 6],
    w = 38,
    h = 28,
    x0 = 8,
    y0 = 8;
  const box = (
    key: string,
    x: number,
    y: number,
    label: string,
    bold = false,
  ) => (
    <g key={key}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={bold ? "currentColor" : "none"}
        fillOpacity={bold ? 0.12 : undefined}
        stroke="currentColor"
        strokeWidth="1"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 5}
        textAnchor="middle"
        {...text}
        style={{ fontWeight: bold ? 600 : 400 }}
      >
        {label}
      </text>
    </g>
  );
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 96"
      label="Part of a multiplication table. Row 3: 12, 15, 18, 21, 24, going up by 3 each step. Row 6: 24, 30, 36, 42, 48, each double the product above it."
      caption="Across a row, each product grows by that row's factor. The row for 6 is the row for 3 doubled."
    >
      {box("corner", x0, y0, "×", true)}
      {columns.map((c, j) => box(`c${c}`, x0 + w * (j + 1), y0, `${c}`, true))}
      {rows.map((r, i) => (
        <g key={r}>
          {box(`r${r}`, x0, y0 + h * (i + 1), `${r}`, true)}
          {columns.map((c, j) =>
            box(`${r}-${c}`, x0 + w * (j + 1), y0 + h * (i + 1), `${r * c}`),
          )}
        </g>
      ))}
      <text x={244} y={y0 + h * 1.5 + 5} {...text} style={{ fontSize: 12 }}>
        +3 each step
      </text>
      <text x={244} y={y0 + h * 2.5 + 5} {...text} style={{ fontSize: 12 }}>
        double row 3
      </text>
    </Frame>
  );
}
