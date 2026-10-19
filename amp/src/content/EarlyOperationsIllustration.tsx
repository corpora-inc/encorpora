import React from "react";

export type EarlyOperationsIllustrationKind =
  | "number-bond-split"
  | "tape-missing-part"
  | "balance-level"
  | "three-addends-ten"
  | "change-chain-steps";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 10, lineHeight: 1.6 };
const svgStyle = { display: "block", width: "100%", maxWidth: 480 };
const text = { fill: "currentColor", fontSize: 15 };
const line = { stroke: "currentColor", fill: "none", strokeWidth: 1.5 };

function Frame({
  kind,
  viewBox,
  label,
  caption,
  children,
}: {
  kind: EarlyOperationsIllustrationKind;
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

const dot = (x: number, y: number, open = false, r = 6) => (
  <circle
    key={`${x}-${y}`}
    cx={x}
    cy={y}
    r={r}
    fill={open ? "none" : "currentColor"}
    stroke="currentColor"
    strokeWidth="1.5"
  />
);

/** Fixed teaching models with exact counts; colors inherit the text color so
 * they read in print, light and dark. Filled and open marks carry contrast. */
export function EarlyOperationsIllustration({
  kind,
}: {
  kind: EarlyOperationsIllustrationKind;
}) {
  if (kind === "number-bond-split") {
    const circle = (x: number, y: number, n: string) => (
      <g key={n + x}>
        <circle cx={x} cy={y} r={24} {...line} strokeWidth={2} />
        <text x={x} y={y + 6} textAnchor="middle" {...text} fontSize={18}>
          {n}
        </text>
      </g>
    );
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 150"
        label="Eight counters, three filled and five open, beside a number bond: whole 8, parts 3 and 5."
        caption="The same eight counters, split into 3 and 5: 8 = 3 + 5."
      >
        {Array.from({ length: 8 }, (_, i) =>
          dot(24 + i * 18 + (i >= 3 ? 12 : 0), 75, i >= 3),
        )}
        <line x1={212} y1={52} x2={190} y2={92} {...line} />
        <line x1={236} y1={52} x2={258} y2={92} {...line} />
        {circle(224, 32, "8")}
        {circle(180, 112, "3")}
        {circle(268, 112, "5")}
      </Frame>
    );
  }
  if (kind === "tape-missing-part") {
    const u = 30,
      x0 = 25;
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 110"
        label="A bar 9 units long labeled 9. Below it, a bar of 5 units labeled 5 and a bar of 4 units labeled with a question mark, together as long as the 9 bar."
        caption="The whole bar is 9. One part is 5, so the other part fills the rest: 5 + □ = 9, and □ = 4."
      >
        <rect x={x0} y={10} width={9 * u} height={34} {...line} />
        <text x={x0 + 4.5 * u} y={33} textAnchor="middle" {...text}>
          9
        </text>
        <rect
          x={x0}
          y={58}
          width={5 * u}
          height={34}
          fill="currentColor"
          fillOpacity={0.14}
          stroke="currentColor"
          strokeWidth={1.5}
        />
        <text x={x0 + 2.5 * u} y={81} textAnchor="middle" {...text}>
          5
        </text>
        <rect
          x={x0 + 5 * u}
          y={58}
          width={4 * u}
          height={34}
          {...line}
          strokeDasharray="5 4"
        />
        <text x={x0 + 7 * u} y={81} textAnchor="middle" {...text}>
          ?
        </text>
      </Frame>
    );
  }
  if (kind === "balance-level") {
    const pan = (cx: number, groups: number[]) => (
      <g>
        <line x1={cx - 60} y1={40} x2={cx - 54} y2={110} {...line} />
        <line x1={cx + 60} y1={40} x2={cx + 54} y2={110} {...line} />
        <path
          d={`M ${cx - 62} 110 Q ${cx} 124 ${cx + 62} 110`}
          {...line}
          strokeWidth={2}
        />
        {groups.map((n, g) =>
          Array.from({ length: n }, (_, i) =>
            dot(
              cx - 50 + (g ? groups[0]! * 14 + 10 : 0) + i * 14,
              102,
              g === 1,
            ),
          ),
        )}
      </g>
    );
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 150"
        label="A level balance. The left pan holds 3 filled and 4 open counters; the right pan holds 2 filled and 5 open counters. Below: 3 + 4 = 2 + 5."
        caption="Both pans hold seven, so the beam is level: 3 + 4 = 2 + 5. The equal sign means the two sides have the same value."
      >
        <line x1={18} y1={40} x2={302} y2={40} {...line} strokeWidth={3} />
        <line x1={160} y1={40} x2={160} y2={128} {...line} strokeWidth={2} />
        <path d="M 140 138 L 160 126 L 180 138 Z" fill="currentColor" />
        {pan(80, [3, 4])}
        {pan(240, [2, 5])}
        <text x={160} y={20} textAnchor="middle" {...text} fontSize={17}>
          3 + 4 = 2 + 5
        </text>
      </Frame>
    );
  }
  if (kind === "three-addends-ten") {
    const s = 24,
      x0 = 40,
      y0 = 20;
    // 6 + 2 + 4: the 6 and the 4 fill a ten-frame; the 2 starts the next.
    const marks = [
      ...Array.from({ length: 6 }, () => "filled"),
      ...Array.from({ length: 4 }, () => "open"),
    ];
    return (
      <Frame
        kind={kind}
        viewBox="0 0 320 120"
        label="A full ten-frame holding 6 filled and 4 open counters, and a second frame holding 2 counters marked with crosses. Below: 6 + 4 = 10, and 10 + 2 = 12."
        caption="For 6 + 2 + 4, join the 6 and the 4 first to fill a ten. Then 10 + 2 = 12. The order of adding does not change the total."
      >
        {[0, 1].map((frame) =>
          Array.from({ length: 10 }, (_, i) => (
            <rect
              key={`${frame}-${i}`}
              x={x0 + frame * 130 + (i % 5) * s}
              y={y0 + Math.floor(i / 5) * s}
              width={s}
              height={s}
              {...line}
              strokeWidth={1}
            />
          )),
        )}
        {marks.map((m, i) =>
          dot(
            x0 + (i % 5) * s + s / 2,
            y0 + Math.floor(i / 5) * s + s / 2,
            m === "open",
            7,
          ),
        )}
        {[0, 1].map((i) => {
          const cx = x0 + 130 + i * s + s / 2,
            cy = y0 + s / 2;
          return (
            <g key={i}>
              <line
                x1={cx - 6}
                y1={cy - 6}
                x2={cx + 6}
                y2={cy + 6}
                {...line}
                strokeWidth={2.5}
              />
              <line
                x1={cx - 6}
                y1={cy + 6}
                x2={cx + 6}
                y2={cy - 6}
                {...line}
                strokeWidth={2.5}
              />
            </g>
          );
        })}
        <text x={160} y={100} textAnchor="middle" {...text} fontSize={16}>
          6 + 4 = 10, then 10 + 2 = 12
        </text>
      </Frame>
    );
  }
  const box = (x: number, n: string, dashed = false) => (
    <g key={x}>
      <rect
        x={x - 30}
        y={56}
        width={60}
        height={36}
        rx={6}
        {...line}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <text x={x} y={80} textAnchor="middle" {...text} fontSize={17}>
        {n}
      </text>
    </g>
  );
  const arrow = (x1: number, x2: number, t: string) => (
    <g key={t}>
      <line x1={x1} y1={74} x2={x2 - 8} y2={74} {...line} />
      <path d={`M ${x2} 74 l -9 -5 l 0 10 z`} fill="currentColor" />
      <text x={(x1 + x2) / 2} y={44} textAnchor="middle" {...text}>
        {t}
      </text>
    </g>
  );
  return (
    <Frame
      kind={kind}
      viewBox="0 0 320 110"
      label="A chain: 23, then plus 15 gives 38, then minus 9 gives 29."
      caption="Each change starts from the amount the last change made: 23 + 15 = 38, then 38 − 9 = 29."
    >
      {box(46, "23")}
      {arrow(78, 128, "+15")}
      {box(160, "38")}
      {arrow(192, 242, "−9")}
      {box(274, "29", true)}
    </Frame>
  );
}
