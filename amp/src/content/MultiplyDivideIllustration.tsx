import React from "react";

export type MultiplyDivideIllustrationKind =
  | "multiply-tens-groups"
  | "area-model-product"
  | "standard-algorithm-product"
  | "partial-quotients"
  | "partial-quotients-two-digit";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const tint = { fill: "currentColor", fillOpacity: 0.1 };
const strong = { fill: "currentColor", fillOpacity: 0.22 };
// Inline, since the global `svg text` font rule outranks SVG attributes.
const digits = { fontVariantNumeric: "tabular-nums" as const, fontSize: 18 };
const algorithm = { ...digits, fontSize: 20 };
const comma = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: MultiplyDivideIllustrationKind;
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

/** Partial quotients by place, written as a subtraction ladder. */
function Ladder({
  kind,
  n,
  d,
}: {
  kind: MultiplyDivideIllustrationKind;
  n: number;
  d: number;
}) {
  const rows: { take: number; part: number; left: number }[] = [];
  let rest = n;
  for (let place = String(n).length - 1; place >= 0; place--) {
    const unit = 10 ** place,
      digit = Math.floor(rest / (d * unit));
    if (!digit) continue;
    rows.push({ part: digit * unit, take: digit * unit * d, left: 0 });
    rest -= digit * unit * d;
    rows[rows.length - 1]!.left = rest;
  }
  const q = rows.reduce((s, row) => s + row.part, 0);
  const right = 150,
    line = 26,
    top = 30;
  const height = top + rows.length * 2 * line + 34;
  return (
    <Frame
      kind={kind}
      viewBox={`0 0 320 ${height}`}
      label={`${comma(n)} divided by ${d} by partial quotients: ${rows.map((r) => `subtract ${comma(r.take)}, which is ${comma(r.part)} groups of ${d}`).join("; ")}. The partial quotients add to ${comma(q)}.`}
      caption={`${rows.map((r) => comma(r.part)).join(" + ")} = ${comma(q)}, so ${comma(n)} ÷ ${d} = ${comma(q)}.`}
    >
      <g fill="currentColor">
        <text x={right - 74} y={top} textAnchor="end" style={digits}>
          {d}
        </text>
        <path
          d={`M${right - 68} ${top + 6} Q${right - 60} ${top - 6} ${right - 66} ${top - 20} H${right + 4}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text x={right} y={top} textAnchor="end" style={digits}>
          {comma(n)}
        </text>
        {rows.map((row, i) => {
          const y = top + (2 * i + 1) * line;
          return (
            <g key={i}>
              <text x={right} y={y} textAnchor="end" style={digits}>
                − {comma(row.take)}
              </text>
              <line
                x1={right - 70}
                x2={right + 4}
                y1={y + 7}
                y2={y + 7}
                stroke="currentColor"
              />
              <text x={right} y={y + line} textAnchor="end" style={digits}>
                {comma(row.left)}
              </text>
              <rect
                x={right + 24}
                y={y - 18}
                width={128}
                height={24}
                rx={6}
                {...tint}
              />
              <text x={right + 34} y={y} style={{ fontSize: 15 }}>
                {comma(row.part)} × {d}
              </text>
            </g>
          );
        })}
      </g>
      <text
        x={right + 34}
        y={height - 10}
        fill="currentColor"
        style={{ fontWeight: 700, fontSize: 16 }}
      >
        quotient {comma(q)}
      </text>
    </Frame>
  );
}

/** Fixed teaching models with exact geometry; colors inherit the text color
 * so they read in print, light and dark. */
export function MultiplyDivideIllustration({
  kind,
}: {
  kind: MultiplyDivideIllustrationKind;
}) {
  if (kind === "partial-quotients")
    return <Ladder kind={kind} n={1476} d={6} />;
  if (kind === "partial-quotients-two-digit")
    return <Ladder kind={kind} n={1512} d={24} />;
  if (kind === "multiply-tens-groups") {
    const rod = { w: 9, h: 40, gap: 4 };
    return (
      <Frame
        kind={kind}
        viewBox="0 0 350 196"
        label="Six groups, each of seven ten-rods: 42 tens in all."
        caption="6 groups of 7 tens are 42 tens: 6 × 70 = 420."
      >
        {Array.from({ length: 6 }, (_, g) => {
          const x = 16 + (g % 2) * 172,
            y = 10 + Math.floor(g / 2) * 62;
          return (
            <g key={g} data-group={g}>
              <rect
                x={x - 8}
                y={y - 6}
                width={7 * (rod.w + rod.gap) + 12}
                height={rod.h + 12}
                rx={8}
                {...tint}
              />
              {Array.from({ length: 7 }, (_, i) => (
                <rect
                  key={i}
                  data-unit="ten"
                  x={x + i * (rod.w + rod.gap)}
                  y={y}
                  width={rod.w}
                  height={rod.h}
                  rx={1.5}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              ))}
              <text
                x={x + 7 * (rod.w + rod.gap) + 10}
                y={y + 26}
                fill="currentColor"
                style={{ fontSize: 15 }}
              >
                7 tens
              </text>
            </g>
          );
        })}
      </Frame>
    );
  }
  if (kind === "area-model-product") {
    const s = 6,
      x0 = 36,
      y0 = 28;
    const columns = [40, 6],
      rows = [20, 3];
    const xs = [x0, x0 + 40 * s],
      ys = [y0, y0 + 20 * s];
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 176"
        label="A 46 by 23 rectangle drawn to scale, split into 40 and 6 across and 20 and 3 down. Regions: 800, 120, 120 and 18."
        caption="(40 + 6) × (20 + 3) = 800 + 120 + 120 + 18 = 1,058."
      >
        {rows.flatMap((h, j) =>
          columns.map((w, i) => (
            <g key={`${i}${j}`} data-region={`${w}x${h}`}>
              <rect
                x={xs[i]}
                y={ys[j]}
                width={w * s}
                height={h * s}
                {...((i + j) % 2 ? strong : tint)}
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <text
                x={xs[i]! + (w * s) / 2}
                y={ys[j]! + (h * s) / 2 + 5}
                textAnchor="middle"
                fill="currentColor"
                style={{ fontSize: h * s < 24 || w * s < 40 ? 12 : 15 }}
              >
                {w * h}
              </text>
            </g>
          )),
        )}
        {columns.map((w, i) => (
          <text
            key={w}
            x={xs[i]! + (w * s) / 2}
            y={y0 - 9}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontWeight: 600, fontSize: 14 }}
          >
            {w}
          </text>
        ))}
        {rows.map((h, j) => (
          <text
            key={h}
            x={x0 - 8}
            y={ys[j]! + (h * s) / 2 + 5}
            textAnchor="end"
            fill="currentColor"
            style={{ fontWeight: 600, fontSize: 14 }}
          >
            {h}
          </text>
        ))}
      </Frame>
    );
  }
  const right = 150,
    line = 30;
  const rows: [string, string, string?][] = [
    ["346", ""],
    ["× 27", ""],
    ["2,422", "346 × 7", "rule"],
    ["6,920", "346 × 20"],
    ["9,342", "sum", "rule"],
  ];
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 184"
      label="346 times 27 written vertically. The first partial product, 346 times 7, is 2,422. The second, 346 times 20, is 6,920. Their sum is 9,342."
      caption="346 × 27 = 346 × 7 + 346 × 20 = 2,422 + 6,920 = 9,342."
    >
      <g fill="currentColor">
        {rows.map(([value, note, rule], i) => {
          const y = 30 + i * line;
          return (
            <g key={i}>
              {rule && (
                <line
                  x1={right - 82}
                  x2={right + 4}
                  y1={y - 22}
                  y2={y - 22}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              )}
              <text
                x={right}
                y={y}
                textAnchor="end"
                style={{ ...algorithm, fontWeight: i === 4 ? 700 : 400 }}
              >
                {value}
              </text>
              {note && (
                <>
                  <rect
                    x={right + 24}
                    y={y - 18}
                    width={104}
                    height={24}
                    rx={6}
                    {...tint}
                  />
                  <text x={right + 34} y={y} style={{ fontSize: 15 }}>
                    {note}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>
    </Frame>
  );
}
