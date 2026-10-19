import React from "react";

export type FactsIllustrationKind =
  | "five-frame-facts"
  | "count-on-hops"
  | "make-ten-frames"
  | "ten-hundred-digits";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const highlight = { fill: "currentColor", fillOpacity: 0.14 };
const line = { stroke: "currentColor", fill: "none" };

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: FactsIllustrationKind;
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

/** Ten-frame cells: `across` per row, cell size `s`, top-left (x, y). */
const cell = (x: number, y: number, s: number, i: number, across = 5) => ({
  x: x + (i % across) * s,
  y: y + Math.floor(i / across) * s,
});

/** Fixed teaching models with exact positions; colors inherit the text color so
 * they read in print, light and dark. */
export function FactsIllustration({ kind }: { kind: FactsIllustrationKind }) {
  if (kind === "five-frame-facts") {
    const s = 50,
      x0 = 35;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 128"
        label="A five-frame with 3 filled counters and 2 open counters. Below it: 3 + 2 = 5 and 5 − 2 = 3."
        caption="The same two parts give an addition and a subtraction."
      >
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i}>
            <rect
              x={x0 + i * s}
              y={10}
              width={s}
              height={s}
              {...line}
              strokeWidth="1.5"
            />
            <circle
              cx={x0 + i * s + s / 2}
              cy={35}
              r={15}
              fill={i < 3 ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </g>
        ))}
        <text
          x={160}
          y={92}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 18 }}
        >
          3 + 2 = 5
        </text>
        <text
          x={160}
          y={118}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 18 }}
        >
          5 − 2 = 3
        </text>
      </Frame>
    );
  }
  if (kind === "count-on-hops") {
    const x = (n: number) => 20 + (n - 5) * 35;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 120"
        label="A number line from 5 to 13. A dot marks 8. Three hops of one go from 8 to 9, 10 and 11; 11 is circled."
        caption="Start at 8 and hop 3 times: 9, 10, 11. Three hops add 3, so 8 + 3 = 11."
      >
        <line x1={10} x2={310} y1={84} y2={84} {...line} strokeWidth="2" />
        {Array.from({ length: 9 }, (_, i) => i + 5).map((n) => (
          <g key={n}>
            <line x1={x(n)} x2={x(n)} y1={78} y2={90} {...line} />
            <text
              x={x(n)}
              y={108}
              textAnchor="middle"
              fill="currentColor"
              style={{
                fontWeight: n === 8 || n === 11 ? 700 : 400,
                fontSize: 14,
              }}
            >
              {n}
            </text>
          </g>
        ))}
        <circle cx={x(8)} cy={84} r={6} fill="currentColor" />
        <circle cx={x(11)} cy={102} r={13} {...line} strokeWidth="1.5" />
        {[8, 9, 10].map((n, i) => (
          <g key={n}>
            <path
              d={`M${x(n) + 2} 76 Q${(x(n) + x(n + 1)) / 2} 46 ${x(n + 1) - 2} 76`}
              {...line}
              strokeWidth="1.8"
            />
            <path
              d={`M${x(n + 1) - 2} 76 l-7 -3 M${x(n + 1) - 2} 76 l-1 -7`}
              {...line}
              strokeWidth="1.8"
            />
            <text
              x={(x(n) + x(n + 1)) / 2}
              y={44}
              textAnchor="middle"
              fill="currentColor"
              style={{ fontSize: 13 }}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </Frame>
    );
  }
  if (kind === "make-ten-frames") {
    const s = 26,
      left = 10,
      right = 180,
      top = 46;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 120"
        label="Two ten-frames. The first holds 8 filled counters and 2 empty places; the second holds 5 open counters. Two of the squares, drawn dashed, move into the empty places, leaving 3."
        caption="8 + 5: move 2 to fill the ten, leaving 3. 10 + 3 = 13."
      >
        {[left, right].map((x0, frame) =>
          Array.from({ length: 10 }, (_, i) => {
            const { x, y } = cell(x0, top, s, i);
            return (
              <rect
                key={`${frame}-${i}`}
                x={x}
                y={y}
                width={s}
                height={s}
                {...(frame === 0 && i >= 8 ? highlight : { fill: "none" })}
                stroke="currentColor"
                strokeWidth="1.2"
              />
            );
          }),
        )}
        {Array.from({ length: 8 }, (_, i) => {
          const { x, y } = cell(left, top, s, i);
          return (
            <circle
              key={i}
              cx={x + s / 2}
              cy={y + s / 2}
              r={9}
              fill="currentColor"
            />
          );
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const { x, y } = cell(right, top, s, i);
          return (
            <rect
              key={i}
              x={x + 5}
              y={y + 5}
              width={s - 10}
              height={s - 10}
              {...line}
              strokeWidth="2"
              strokeDasharray={i >= 3 ? "3 2" : undefined}
            />
          );
        })}
        {[8, 9].map((i) => {
          const { x, y } = cell(left, top, s, i);
          return (
            <rect
              key={i}
              x={x + 5}
              y={y + 5}
              width={s - 10}
              height={s - 10}
              {...line}
              strokeWidth="2"
            />
          );
        })}
        <path
          d={`M${right - 6} ${top + s} H${left + 5 * s + 6}`}
          {...line}
          strokeWidth="1.8"
        />
        <path
          d={`M${left + 5 * s + 6} ${top + s} l7 -5 M${left + 5 * s + 6} ${top + s} l7 5`}
          {...line}
          strokeWidth="1.8"
        />
        <text
          x={(right + left + 5 * s) / 2}
          y={top - 12}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 12 }}
        >
          move 2
        </text>
        <text
          x={left + 65}
          y={top - 12}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 13 }}
        >
          8 → 10
        </text>
        <text
          x={right + 65}
          y={top - 12}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontSize: 13 }}
        >
          5 → 3
        </text>
      </Frame>
    );
  }
  const rows = [
    { left: "470 + 100", result: "570", changed: [0] },
    { left: "470 + 10", result: "480", changed: [1] },
    { left: "396 + 10", result: "406", changed: [0, 1] },
  ];
  const digitX = (i: number) => 214 + i * 24;
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 140"
      label="Three facts with the changed digits marked: 470 + 100 = 570 changes the hundreds; 470 + 10 = 480 changes the tens; 396 + 10 = 406 changes the tens and the hundreds."
      caption="Adding 100 changes the hundreds digit; adding 10 changes the tens digit. Ten tens make one more hundred."
    >
      {["H", "T", "O"].map((h, i) => (
        <text
          key={h}
          x={digitX(i)}
          y={16}
          textAnchor="middle"
          fill="currentColor"
          style={{ fontWeight: 600, fontSize: 12 }}
        >
          {h}
        </text>
      ))}
      {rows.map((row, r) => {
        const y = 52 + r * 38;
        return (
          <g key={row.left}>
            <text
              x={176}
              y={y}
              textAnchor="end"
              fill="currentColor"
              style={{ fontSize: 20 }}
            >
              {row.left} =
            </text>
            {[...row.result].map((d, i) => (
              <g key={i}>
                {row.changed.includes(i) && (
                  <rect
                    x={digitX(i) - 11}
                    y={y - 21}
                    width={22}
                    height={28}
                    rx={4}
                    {...highlight}
                  />
                )}
                <text
                  x={digitX(i)}
                  y={y}
                  textAnchor="middle"
                  fill="currentColor"
                  style={{
                    fontWeight: row.changed.includes(i) ? 700 : 400,
                    fontSize: 20,
                  }}
                >
                  {d}
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </Frame>
  );
}
