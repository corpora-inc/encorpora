import React from "react";
import { ClockFace, MoneyPiece } from "../web/TimeMoneyFigure";
import {
  CENTS,
  handAngles,
  moneySize,
  type MoneyItem,
} from "../math/time-money-models";

const ink = "var(--color-figure-ink)",
  accent = "var(--color-figure-accent)",
  muted = "var(--color-figure-axis)";

function Text({
  x,
  y,
  children,
  size = 22,
  weight,
  fill = ink,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  weight?: number;
  fill?: string;
}) {
  // Inline fill: the global svg text color would override the attribute.
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      style={{ fill, fontSize: size, fontWeight: weight }}
    >
      {children}
    </text>
  );
}

function Clock({ cx, h, m }: { cx: number; h: number; m: number }) {
  const a = handAngles(h, m);
  return (
    <ClockFace cx={cx} cy={122} hourAngle={a.hour} minuteAngle={a.minute} />
  );
}

/** 3:00 beside 3:30: the long hand at 6 and the short hand halfway to 4. */
function HourHalf() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 300"
      role="img"
      aria-label="Two clocks. At 3:00 the long hand points at 12 and the short hand at 3. At 3:30 the long hand points at 6 and the short hand is halfway between 3 and 4."
    >
      <Clock cx={150} h={3} m={0} />
      <Clock cx={450} h={3} m={30} />
      <Text x={150} y={268} weight={700} size={26}>
        3:00
      </Text>
      <Text x={150} y={294} size={20}>
        three o'clock
      </Text>
      <Text x={450} y={268} weight={700} size={26}>
        3:30
      </Text>
      <Text x={450} y={294} size={20}>
        half past three
      </Text>
    </svg>
  );
}

/** 4:35 with the minutes counted by fives around the outside. */
function FiveMinutes() {
  const cx = 300,
    cy = 160,
    a = handAngles(4, 35);
  const at = (deg: number, r: number) => ({
    x: cx + Math.sin((deg * Math.PI) / 180) * r,
    y: cy - Math.cos((deg * Math.PI) / 180) * r,
  });
  const end = at(a.minute, 119);
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 340"
      role="img"
      aria-label="A clock showing 4:35. Around the outside, each numeral is labeled with its minutes: 5, 10, 15 and so on up to 55. The minutes from 12 to the long hand at 7 are shaded: 35 minutes."
    >
      <ClockFace cx={cx} cy={cy} hourAngle={a.hour} minuteAngle={a.minute} />
      {/* The minutes swept from 12, as a band just outside the face. */}
      <path
        d={`M ${cx} ${cy - 119} A 119 119 0 1 1 ${end.x} ${end.y}`}
        fill="none"
        stroke={accent}
        strokeWidth="8"
        strokeLinecap="round"
      />
      {Array.from({ length: 12 }, (_, i) => {
        const p = at((i + 1) * 30, 142);
        return (
          <Text
            key={i}
            x={p.x}
            y={p.y + 7}
            size={19}
            weight={i + 1 === 7 ? 700 : 400}
            fill={i + 1 <= 7 ? accent : muted}
          >
            {i === 11 ? "0" : (i + 1) * 5}
          </Text>
        );
      })}
      <Text x={480} y={60} weight={700} size={30}>
        4:35
      </Text>
    </svg>
  );
}

/** Generic coins and bills, each with its value written below. */
function CoinValues() {
  const items: MoneyItem[] = ["penny", "nickel", "dime", "quarter", "dollar"];
  const xs = [36, 104, 170, 246, 366];
  const names = ["penny", "nickel", "dime", "quarter", "one dollar"];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 440 144"
      role="img"
      aria-label="A penny is 1 cent, a nickel 5 cents, a dime 10 cents, a quarter 25 cents and a one-dollar bill 100 cents."
    >
      {items.map((item, i) => {
        const { w, h } = moneySize(item);
        return (
          <g key={item}>
            <g transform={`translate(${xs[i]!} 50) scale(1.2)`}>
              <MoneyPiece item={item} cx={0} cy={0} w={w} h={h} />
            </g>
            <Text x={xs[i]!} y={108} size={20}>
              {names[i]}
            </Text>
            <Text x={xs[i]!} y={134} size={20} weight={700}>
              {`${CENTS[item]}¢`}
            </Text>
          </g>
        );
      })}
    </svg>
  );
}

/** 2 quarters, a dime, a nickel and a penny, with running totals above. */
function CountOn() {
  const items: MoneyItem[] = ["quarter", "quarter", "dime", "nickel", "penny"];
  let run = 0;
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 440 120"
      role="img"
      aria-label="Two quarters, a dime, a nickel and a penny in a row from largest to smallest value. Above them the count goes 25, 50, 60, 65, 66: 66 cents."
    >
      {items.map((item, i) => {
        run += CENTS[item];
        const { w, h } = moneySize(item),
          x = 50 + i * 84;
        return (
          <g key={i}>
            <Text x={x} y={30} size={24} weight={700} fill={accent}>
              {i === items.length - 1 ? `${run}¢` : run}
            </Text>
            <g transform={`translate(${x} 82) scale(1.2)`}>
              <MoneyPiece item={item} cx={0} cy={0} w={w} h={h} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function TimeMoneyIllustration({
  kind,
}: {
  kind:
    "clock-hour-half" | "clock-five-minutes" | "coin-values" | "coin-count-on";
}) {
  if (kind === "clock-hour-half") return <HourHalf />;
  if (kind === "clock-five-minutes") return <FiveMinutes />;
  if (kind === "coin-values") return <CoinValues />;
  return <CountOn />;
}
