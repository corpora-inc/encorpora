import type { SVGProps } from "react";
import type { CoinKind } from "../../math/scene/art";
import { coinFaceUrl } from "./coin-art";

const copper = {
  metal: "var(--color-coin-copper)",
  edge: "var(--color-coin-copper-edge)",
};
const silver = {
  metal: "var(--color-coin-silver)",
  edge: "var(--color-coin-silver-edge)",
};
const metal: Record<CoinKind, typeof copper> = {
  penny: copper,
  nickel: silver,
  dime: silver,
  quarter: silver,
};
/** Ridges drawn around a reeded coin's rim; smooth coins have none. Fewer
 * than the real coin's (about 118), so they stay distinct on a phone. */
const ridges: Record<CoinKind, number> = {
  penny: 0,
  nickel: 0,
  dime: 61,
  quarter: 82,
};

/**
 * One United States coin, heads up, filling the circle (cx, cy, r): a
 * metal disc (so the coin is never a hole, even before the picture paints),
 * the United States Mint's photograph of its obverse, ridges on a reeded
 * edge, and a fine line on the rim. Takes exactly the room of a circle of
 * radius r outlined `edge` wide, and never draws beyond it. Emphasis (0 to
 * 1) grows the coin up to 25% about its centre, as a highlighted circle
 * grows, and lays an accent ring on its rim (no further out than that
 * circle's outline); the portrait itself is never recolored.
 */
export function CoinFace({
  coin,
  cx,
  cy,
  r,
  edge,
  emphasis = 0,
  ...rest
}: {
  coin: CoinKind;
  cx: number;
  cy: number;
  r: number;
  edge: number;
  emphasis?: number;
} & Omit<SVGProps<SVGGElement>, "children">) {
  const m = metal[coin],
    n = ridges[coin];
  const grow = 1 + 0.25 * emphasis;
  const band = Math.max(1, r * 0.07);
  const ring = Math.max(2.5, r * 0.09);
  return (
    <g {...rest}>
      <g
        transform={
          emphasis > 0
            ? `translate(${cx} ${cy}) scale(${grow}) translate(${-cx} ${-cy})`
            : undefined
        }
      >
        <circle cx={cx} cy={cy} r={r} fill={m.metal} />
        <image
          href={coinFaceUrl[coin]}
          x={cx - r}
          y={cy - r}
          width={2 * r}
          height={2 * r}
          preserveAspectRatio="xMidYMid meet"
        />
        {n > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r - band / 2}
            fill="none"
            stroke={m.edge}
            strokeOpacity={0.6}
            strokeWidth={band}
            pathLength={n}
            strokeDasharray="0.42 0.58"
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={m.edge}
          strokeOpacity={0.7}
          strokeWidth={edge / 2 / grow}
        />
      </g>
      {emphasis > 0 && (
        <circle
          data-coin-lit=""
          cx={cx}
          cy={cy}
          r={r * grow + edge / 2 - ring / 2}
          fill="none"
          stroke="var(--color-figure-accent)"
          strokeOpacity={emphasis}
          strokeWidth={ring}
        />
      )}
    </g>
  );
}
