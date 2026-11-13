import { PanelFrame } from "./PanelFrame";
import { CoinFace } from "./scene/CoinFace";
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

const COIN_VALUE: Record<Exclude<MoneyItem, "dollar" | "five">, string> = {
  penny: "1¢",
  nickel: "5¢",
  dime: "10¢",
  quarter: "25¢",
};
/** One coin (its real face, with its value on a tag across the lower rim)
 * or one generic bill, centred at (cx, cy). */
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
  const r = w / 2,
    value = COIN_VALUE[item];
  // The value tag keeps "read the cents written on the coin" true. It rests
  // on the lower rim, under the portrait, inside the coin's outline.
  const size = 11,
    tagW = value.length * size * 0.6 + size * 0.75,
    tagH = size * 1.3,
    tagY = cy + r + 1 - tagH;
  return (
    <g data-money={item}>
      <CoinFace coin={item} cx={cx} cy={cy} r={r} edge={2.5} />
      <rect
        x={cx - tagW / 2}
        y={tagY}
        width={tagW}
        height={tagH}
        rx={tagH / 2}
        fill="var(--color-figure-paper)"
        fillOpacity={0.94}
        stroke="var(--color-figure-ink)"
        strokeOpacity={0.35}
        strokeWidth={0.8}
      />
      <text
        x={cx}
        y={tagY + tagH / 2 + size * 0.36}
        textAnchor="middle"
        style={{ fill: ink, fontSize: size, fontWeight: 700 }}
      >
        {value}
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
    // Lettered clocks sit in their own panels with room around each face,
    // so a panel can be tapped (and outlined) without crowding the dial.
    const column = labelled ? 264 : 240,
      cy = labelled ? 126 : 118;
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
        viewBox={`0 0 ${column * n} ${labelled ? 284 : 236}`}
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        {figure.clocks.map((c, i) => {
          const a = handAngles(c.hour, c.minute);
          return (
            <g key={i} data-clock={c.label ?? i}>
              {labelled && (
                <PanelFrame
                  label={c.label}
                  x={column * i + 4}
                  y={2}
                  width={column - 8}
                  height={280}
                />
              )}
              <ClockFace
                cx={column / 2 + column * i}
                cy={cy}
                hourAngle={a.hour}
                minuteAngle={a.minute}
              />
              {c.label && (
                <text
                  x={column / 2 + column * i}
                  y="272"
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
          {labelled && (
            <PanelFrame
              label={set.label}
              x={2}
              y={Math.max(1, top - 6)}
              width={316}
              height={top + layout.height + 6 - Math.max(1, top - 6)}
            />
          )}
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
              data-panel-divider=""
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
