import type { CSSProperties } from "react";
import {
  handAngles,
  moneyLayout,
  type MoneyItem,
  type TimeMoneyFigure as Data,
} from "../math/time-money-models";

const ink = "var(--color-figure-ink)";
const at = (cx: number, cy: number, angle: number, length: number) => ({
  x: cx + Math.sin((angle * Math.PI) / 180) * length,
  y: cy - Math.cos((angle * Math.PI) / 180) * length,
});

/** Words for the hands' positions; never the time itself. */
export function describeHands(hour: number, minute: number) {
  const next = (hour % 12) + 1;
  const hourHand =
    minute === 0
      ? `points at ${hour}`
      : minute < 20
        ? `is just past ${hour}`
        : minute <= 40
          ? `is about halfway between ${hour} and ${next}`
          : `is close to ${next} but has not reached it`;
  const minuteHand =
    minute % 5 === 0
      ? `points at ${minute === 0 ? 12 : minute / 5}`
      : `is between two numerals`;
  return `The short hour hand ${hourHand}. The long minute hand ${minuteHand}.`;
}

/** A clock face centred at (cx, cy) with radius 108: 60 minute ticks, every
 * fifth heavier, numerals 1–12, and hands at their exact angles. Hands can be
 * given as angles so animations can sweep them. */
export function ClockFace({
  cx,
  cy,
  hourAngle,
  minuteAngle,
  handStyle,
  handClassName,
}: {
  cx: number;
  cy: number;
  hourAngle: number;
  minuteAngle: number;
  handStyle?: CSSProperties;
  /** Animation class for the hands (its transition respects reduced motion). */
  handClassName?: string;
}) {
  // Static figures rotate with the SVG attribute; animations rotate with CSS
  // so the hands can sweep.
  const turn = (angle: number) =>
    handStyle
      ? {
          className: handClassName,
          style: {
            ...handStyle,
            transform: `rotate(${angle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          },
        }
      : { transform: `rotate(${angle} ${cx} ${cy})` };
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r="108"
        fill="var(--color-figure-paper)"
        stroke={ink}
        strokeWidth="4"
      />
      {Array.from({ length: 60 }, (_, n) => {
        const p = at(cx, cy, n * 6, n % 5 ? 100 : 94),
          q = at(cx, cy, n * 6, 105);
        return (
          <line
            key={n}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={ink}
            strokeWidth={n % 5 ? 1.2 : 3}
          />
        );
      })}
      <line
        data-hand="hour"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - 52}
        stroke={ink}
        strokeWidth="9"
        strokeLinecap="round"
        {...turn(hourAngle)}
      />
      <line
        data-hand="minute"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - 92}
        stroke="var(--color-figure-accent)"
        strokeWidth="4.5"
        strokeLinecap="round"
        {...turn(minuteAngle)}
      />
      {Array.from({ length: 12 }, (_, i) => {
        const p = at(cx, cy, (i + 1) * 30, 78);
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + 9}
            textAnchor="middle"
            // A paper halo keeps each numeral whole where a hand passes under it.
            style={{
              fill: ink,
              stroke: "var(--color-figure-paper)",
              strokeWidth: 6,
              paintOrder: "stroke",
              strokeLinejoin: "round",
              fontSize: 25,
              fontWeight: 600,
            }}
          >
            {i + 1}
          </text>
        );
      })}
      <circle cx={cx} cy={cy} r="7" fill={ink} />
    </g>
  );
}

const COIN_STYLE: Record<
  Exclude<MoneyItem, "dollar" | "five">,
  { fill: string; stroke: string; text: string }
> = {
  penny: {
    fill: "var(--color-figure-gold-fill)",
    stroke: "var(--color-figure-gold)",
    text: "1¢",
  },
  nickel: { fill: "var(--color-figure-grid)", stroke: ink, text: "5¢" },
  dime: { fill: "var(--color-figure-grid)", stroke: ink, text: "10¢" },
  quarter: { fill: "var(--color-figure-grid)", stroke: ink, text: "25¢" },
};
/** One generic coin or bill centred at (cx, cy). */
export function MoneyPiece({
  item,
  cx,
  cy,
  w,
  h,
}: {
  item: MoneyItem;
  cx: number;
  cy: number;
  w: number;
  h: number;
}) {
  if (item === "dollar" || item === "five")
    return (
      <g data-money={item}>
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx="4"
          fill="var(--color-figure-accent-fill)"
          stroke="var(--color-figure-accent)"
          strokeWidth="2.5"
        />
        <rect
          x={cx - w / 2 + 5}
          y={cy - h / 2 + 5}
          width={w - 10}
          height={h - 10}
          rx="2"
          fill="none"
          stroke="var(--color-figure-accent)"
          strokeWidth="1"
        />
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          style={{ fill: ink, fontSize: 22, fontWeight: 700 }}
        >
          {item === "dollar" ? "$1" : "$5"}
        </text>
      </g>
    );
  const s = COIN_STYLE[item],
    r = w / 2;
  return (
    <g data-money={item}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth="2.5"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r - 4}
        fill="none"
        stroke={s.stroke}
        strokeWidth="0.8"
      />
      <text
        x={cx}
        y={cy + r * 0.27}
        textAnchor="middle"
        style={{
          fill: ink,
          // Two-digit labels fit inside the inner ring of the smallest coin.
          fontSize: Math.round(r * (s.text.length > 2 ? 0.64 : 0.78)),
          fontWeight: 700,
        }}
      >
        {s.text}
      </text>
    </g>
  );
}

const MONEY_NAMES: Record<MoneyItem, string> = {
  five: "five-dollar bill",
  dollar: "one-dollar bill",
  quarter: "quarter",
  dime: "dime",
  nickel: "nickel",
  penny: "penny",
};
export function describeMoney(items: readonly MoneyItem[]) {
  return items.map((item) => MONEY_NAMES[item]).join(", ");
}

export function TimeMoneyFigure({ figure }: { figure: Data }) {
  if (figure.kind === "analog-clocks") {
    const n = figure.clocks.length,
      labelled = n > 1;
    const description = figure.clocks
      .map(
        (c) =>
          `${c.label ? `Clock ${c.label}: ` : "An analog clock. "}${describeHands(c.hour, c.minute)}`,
      )
      .join(" ");
    return (
      <svg
        data-kind={figure.kind}
        className="figure time-money-figure"
        viewBox={`0 0 ${240 * n} ${labelled ? 272 : 236}`}
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        {figure.clocks.map((c, i) => {
          const a = handAngles(c.hour, c.minute);
          return (
            <g key={i} data-clock={c.label ?? i}>
              <ClockFace
                cx={120 + 240 * i}
                cy={118}
                hourAngle={a.hour}
                minuteAngle={a.minute}
              />
              {c.label && (
                <text
                  x={120 + 240 * i}
                  y="262"
                  textAnchor="middle"
                  fill={ink}
                  style={{ fontSize: 28, fontWeight: 700 }}
                >
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }
  const labelled = figure.sets.length > 1,
    left = labelled ? 44 : 4,
    width = 320 - left - 4;
  let y = 4;
  const rows = figure.sets.map((set) => {
    const layout = moneyLayout(set.items, width);
    const row = { set, layout, y };
    y += layout.height + (labelled ? 18 : 8);
    return row;
  });
  const description = figure.sets
    .map(
      (s) =>
        `${s.label ? `Set ${s.label}: ` : "Money: "}${describeMoney(s.items)}.`,
    )
    .join(" ");
  return (
    <svg
      data-kind={figure.kind}
      className="figure time-money-figure"
      viewBox={`0 0 320 ${y}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {rows.map(({ set, layout, y: top }, i) => (
        <g key={i} data-set={set.label ?? i}>
          {set.label && (
            <text
              x="16"
              y={top + layout.height / 2 + 9}
              textAnchor="middle"
              fill={ink}
              style={{ fontSize: 26, fontWeight: 700 }}
            >
              {set.label}
            </text>
          )}
          {layout.items.map((p, j) => (
            <MoneyPiece
              key={j}
              item={p.item}
              cx={left + p.cx}
              cy={top + p.cy}
              w={p.w}
              h={p.h}
            />
          ))}
          {labelled && i < rows.length - 1 && (
            <line
              x1="0"
              x2="320"
              y1={top + layout.height + 9}
              y2={top + layout.height + 9}
              stroke="var(--color-figure-grid)"
            />
          )}
        </g>
      ))}
    </svg>
  );
}
