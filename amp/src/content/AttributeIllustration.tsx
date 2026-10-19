import React from "react";
import { BalanceScale, LiquidScale } from "../web/AttributeFigure";

const ink = "var(--color-figure-ink)",
  accent = "var(--color-figure-accent)",
  fill = "var(--color-figure-accent-fill)",
  gold = "var(--color-figure-gold-fill)",
  warm = "var(--color-figure-warm)",
  axis = "var(--color-figure-axis)";

function Text({
  x,
  y,
  children,
  size = 20,
  weight,
  anchor = "middle",
  color = ink,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  color?: string;
}) {
  // Inline fill: the global svg text color would override the attribute.
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      style={{ fill: color, fontSize: size, fontWeight: weight }}
    >
      {children}
    </text>
  );
}
const Strip = (p: { x: number; y: number; w: number; color: string }) => (
  <rect
    x={p.x}
    y={p.y}
    width={p.w}
    height="26"
    rx="5"
    fill={p.color}
    stroke={ink}
    strokeWidth="2.5"
  />
);

/** The same two strips, unaligned and then lined up at the left. */
function LineUpEnds() {
  const u = 30,
    x0 = 44;
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 360 330"
      role="img"
      aria-label="Top: strip A is 8 units long from the start line; strip B is 6 units long but starts 4 units to the right, so it ends further right. Bottom: lined up at the same start, strip A reaches further, so A is longer."
    >
      {[0, 1].map((panel) => {
        const y0 = panel * 166;
        return (
          <g key={panel}>
            <line
              x1={x0}
              x2={x0}
              y1={y0 + 6}
              y2={y0 + 110}
              stroke={axis}
              strokeDasharray="5 4"
            />
            <Text x={20} y={y0 + 32} size={24} weight={700}>
              A
            </Text>
            <Strip x={x0} y={y0 + 12} w={8 * u} color={fill} />
            <Text x={20} y={y0 + 82} size={24} weight={700}>
              B
            </Text>
            <Strip
              x={x0 + (panel ? 0 : 4 * u)}
              y={y0 + 62}
              w={6 * u}
              color={gold}
            />
            <Text x={180} y={y0 + 140} size={22}>
              {panel ? "Lined up: A is longer" : "B ends further right, but…"}
            </Text>
          </g>
        );
      })}
    </svg>
  );
}

/** A small ball outweighs a big box: the left pan is lower. */
function BalanceHeavier() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 360 272"
      role="img"
      aria-label="A balance with a small ball A on the left and a big box B on the right. The left pan is lower, so the small ball is heavier."
    >
      <BalanceScale
        figure={{
          kind: "mass-balance",
          tilt: "left",
          left: { shape: "ball", size: 1, label: "A" },
          right: { shape: "box", size: 3, label: "B" },
        }}
      />
      <Text x={180} y={264}>
        Lower side is heavier: A, though smaller
      </Text>
    </svg>
  );
}

/** One object measured three ways: correct, with gaps, with overlaps. */
function UnitIteration() {
  const u = 30,
    x0 = 136;
  const rows = [
    { name: "correct", at: [0, 1, 2, 3, 4, 5], note: "6 cubes", ok: true },
    { name: "gaps", at: [0, 1.5, 3, 4.5], note: "4: too few", ok: false },
    {
      name: "overlaps",
      at: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
      note: "11: too many",
      ok: false,
    },
  ];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 470 270"
      role="img"
      aria-label="A pencil 6 cubes long measured three ways. With cubes end to end from the start: 6 cubes, correct. With gaps: 4 cubes, too few. With overlapping cubes: 11 cubes, too many."
    >
      {rows.map((row, i) => {
        const y = 14 + i * 86;
        return (
          <g key={row.name}>
            <Text x={64} y={y + 40} anchor="middle" size={22} weight={700}>
              {row.name === "correct" ? "end to end" : row.name}
            </Text>
            <rect
              x={x0}
              y={y}
              width={6 * u}
              height="18"
              rx="9"
              fill={gold}
              stroke={ink}
              strokeWidth="2"
            />
            {row.at.map((a, j) => (
              <rect
                key={j}
                x={x0 + a * u}
                y={y + 26 + (row.name === "overlaps" ? (j % 2) * 10 : 0)}
                width={u}
                height={u * 0.75}
                fill={fill}
                stroke={ink}
                strokeWidth="1.5"
                opacity={row.name === "overlaps" ? 0.85 : 1}
              />
            ))}
            <Text
              x={x0 + 6 * u + 16}
              y={y + 44}
              anchor="start"
              size={22}
              weight={700}
              color={row.ok ? accent : warm}
            >
              {row.note}
            </Text>
          </g>
        );
      })}
    </svg>
  );
}

/** A crayon from 0 to 5 on a ruler of equal units. */
function RulerUnits() {
  const u = 52,
    x0 = 34;
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 440 200"
      role="img"
      aria-label="A crayon above a ruler. Its left end is at 0 and its right end is at 5, so it is 5 units long. Each unit on the ruler is the same length."
    >
      <path
        d={`M${x0} 30 H${x0 + 5 * u - 22} L${x0 + 5 * u} 46 L${x0 + 5 * u - 22} 62 H${x0} Z`}
        fill={gold}
        stroke={ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect
        x={x0 - 14}
        y="74"
        width={7 * u + 28}
        height="70"
        rx="6"
        fill="var(--color-figure-paper)"
        stroke={ink}
        strokeWidth="2.5"
      />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <line
            x1={x0 + i * u}
            x2={x0 + i * u}
            y1="74"
            y2="104"
            stroke={ink}
            strokeWidth="2.5"
          />
          {i < 7 && (
            <line
              x1={x0 + i * u + u / 2}
              x2={x0 + i * u + u / 2}
              y1="74"
              y2="90"
              stroke={ink}
              strokeWidth="1.5"
            />
          )}
          <Text x={x0 + i * u} y={132} size={24} weight={i === 5 ? 700 : 400}>
            {i}
          </Text>
        </g>
      ))}
      {[0, 5].map((i) => (
        <line
          key={i}
          x1={x0 + i * u}
          x2={x0 + i * u}
          y1="24"
          y2="104"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      ))}
      <Text x={220} y={184} size={24} weight={700}>
        From 0 to 5: 5 units long
      </Text>
    </svg>
  );
}

/** A bag balanced by 200 g, 50 g and 5 g: 255 g. */
function BalanceGrams() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 360 272"
      role="img"
      aria-label="A level balance with a bag on the left and standard masses of 200, 50 and 5 grams on the right. The bag has a mass of 255 grams."
    >
      <BalanceScale
        figure={{
          kind: "mass-balance",
          tilt: "level",
          left: { shape: "bag", size: 2 },
          right: { grams: [200, 50, 5] },
        }}
      />
      <Text x={180} y={264} weight={700}>
        Level: 200 + 50 + 5 = 255 g
      </Text>
    </svg>
  );
}

/** Labels every 10 liters, 5 spaces between: each tick is 2 liters. */
function LiquidTicks() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 520 210"
      role="img"
      aria-label="A container scale labeled 0, 10, 20 and 30 liters with 5 spaces between labels, so each tick is 2 liters. The water is 3 ticks above 20: 26 liters."
    >
      <LiquidScale
        figure={{
          kind: "liquid-scale",
          unit: "L",
          max: 30,
          step: 2,
          labelEvery: 5,
          level: 26,
        }}
      />
      <Text x={262} y={70} anchor="start" size={23}>
        10 L ÷ 5 spaces
      </Text>
      <Text x={262} y={100} anchor="start" size={23}>
        = 2 L per tick
      </Text>
      <Text x={262} y={148} anchor="start" size={23} weight={700}>
        20 + 3 × 2 = 26 L
      </Text>
    </svg>
  );
}

export type AttributeIllustrationKind =
  | "line-up-ends"
  | "balance-heavier"
  | "unit-iteration"
  | "ruler-units"
  | "balance-grams"
  | "liquid-scale-ticks";
export function AttributeIllustration({
  kind,
}: {
  kind: AttributeIllustrationKind;
}) {
  if (kind === "line-up-ends") return <LineUpEnds />;
  if (kind === "balance-heavier") return <BalanceHeavier />;
  if (kind === "unit-iteration") return <UnitIteration />;
  if (kind === "ruler-units") return <RulerUnits />;
  if (kind === "balance-grams") return <BalanceGrams />;
  return <LiquidTicks />;
}
