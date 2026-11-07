import type { CSSProperties } from "react";
import styles from "./Meter.module.css";

/** A tiny readable meter for a table row: a thin bar and its number. One hue:
 * length carries the value, so a color never reads as a verdict. */
export function Meter({
  value,
  label,
  max = 100,
}: {
  value: number;
  /** What it measures, for assistive technology. */
  label: string;
  max?: number;
}) {
  const share = Math.min(1, Math.max(0, value / max));
  return (
    <span
      className={styles.meter}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span className={styles.track}>
        <span
          className={styles.fill}
          style={{ "--share": share.toFixed(4) } as CSSProperties}
        />
      </span>
      <span className={styles.value}>{value.toLocaleString("en-US")}</span>
    </span>
  );
}
