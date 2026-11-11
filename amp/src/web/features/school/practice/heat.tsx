import type { CSSProperties } from "react";
import { heatColor, heatPosition, heatTicks } from "../heat-scale";
import styles from "./Practice.module.css";

export type HeatMeasure = "minutes" | "problems";
/** The measure in the address bar: one `chart` value for every practice view
 * on a page, so the weekly chart and the heat map switch together. */
export const measureOf = (raw: unknown): HeatMeasure =>
  raw === "problems" ? "problems" : "minutes";
export const MEASURES: { value: HeatMeasure; label: string }[] = [
  { value: "minutes", label: "Minutes" },
  { value: "problems", label: "Problems" },
];

const format = (value: number) =>
  Math.round(value).toLocaleString("en-US");
/** "42.5" to one place below 10, whole above: a cell's figures. */
export const figure = (value: number, places?: number) =>
  places !== undefined
    ? value.toFixed(places)
    : Math.abs(value) < 10 && value % 1 !== 0
      ? value.toFixed(1)
      : Math.round(value).toLocaleString("en-US");
export const unitWord = (measure: HeatMeasure, count = 2) =>
  measure === "minutes"
    ? count === 1
      ? "minute"
      : "minutes"
    : count === 1
      ? "problem"
      : "problems";

/** One heat cell. `value` null with `future` is a week still to come; null
 * without it is a week with nobody to count. */
export function HeatCell({
  value,
  midpoint,
  tip,
  current = false,
  future = false,
  className,
  style,
}: {
  value: number | null;
  midpoint: number | null;
  tip?: string;
  current?: boolean;
  future?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const background =
    value === null ? undefined : heatColor(heatPosition(value, midpoint));
  return (
    <span
      className={`${styles.cell} ${className ?? ""}`}
      data-empty={(value === null && !future) || undefined}
      data-future={future || undefined}
      data-current={current || undefined}
      data-tip={tip}
      style={{ ...style, background }}
    />
  );
}

/** The scale, continuous, with the midpoint named: 0, half, the midpoint,
 * one and a half, twice and over. Keys for "so far" and "no one on the
 * roster" only when the map shows them. */
export function HeatLegend({
  caption,
  midpoint,
  midpointWord,
  unit,
  current = true,
  empty = false,
}: {
  caption: string;
  midpoint: number;
  /** What the midpoint is: "target", "median week". */
  midpointWord: string;
  unit: string;
  current?: boolean;
  empty?: boolean;
}) {
  const ticks = heatTicks(midpoint);
  return (
    <div className={styles.legend}>
      <span className={styles.legendCaption}>{caption}</span>
      <span className={styles.legendBar} aria-hidden="true" />
      <span className={styles.legendTicks} aria-hidden="true">
        {ticks.map((tick, index) => (
          <span
            key={index}
            data-mid={index === 2 || undefined}
            style={{ left: `${(index / (ticks.length - 1)) * 100}%` }}
          >
            {index === 2
              ? `${format(tick)} ${midpointWord}`
              : index === ticks.length - 1
                ? `${format(tick)}+`
                : format(tick)}
          </span>
        ))}
      </span>
      <span className={styles.legendKeys}>
        <span>
          Cold: 0 {unit}. Neutral: the {midpointWord}. Hot: twice it or more.
        </span>
        {current && (
          <span>
            <span className={styles.cell} data-current="" /> This week, so far
          </span>
        )}
        {empty && (
          <span>
            <span className={styles.cell} data-empty="" /> Not on the roster yet
          </span>
        )}
      </span>
    </div>
  );
}

/** "n 24 · median 38 · mean 42 · sd 21": a distribution, every time. */
export function StatsLine({
  label,
  n,
  median,
  mean,
  sd,
  unit = "",
  places,
}: {
  label?: string;
  n: number;
  median: number;
  mean: number;
  sd: number;
  unit?: string;
  /** Fixed decimal places, for figures like grade levels. */
  places?: number;
}) {
  return (
    <p className={styles.stats}>
      {label ? `${label}: ` : ""}n <b>{n.toLocaleString("en-US")}</b> · median{" "}
      <b>{figure(median, places)}</b> · mean <b>{figure(mean, places)}</b> ·
      sd <b>{figure(sd, places)}</b>
      {unit ? ` ${unit}` : ""}
    </p>
  );
}
export const statsWords = (
  stat: { median: number; mean: number; sd: number },
  n?: number,
) =>
  `${n === undefined ? "" : `n ${n.toLocaleString("en-US")} · `}median ${figure(stat.median)} · mean ${figure(stat.mean)} · sd ${figure(stat.sd)}`;
