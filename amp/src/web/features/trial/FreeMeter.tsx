import styles from "./Trial.module.css";

/**
 * The free level check's count. It leads with what has been done ("Level
 * check · 11 answered") and shows the allowance quietly ("of 100"), because
 * the picture is useful long before the last free problem.
 */
export function FreeMeter({
  answered,
  free,
  variant = "bar",
}: {
  answered: number;
  free: number;
  /** `pill` sits in the practice toolbar; `bar` heads the map and paywall. */
  variant?: "bar" | "pill";
}) {
  const used = Math.min(answered, free);
  const share = free > 0 ? used / free : 1;
  return (
    <span className={`${styles.meter} ${styles[variant]}`}>
      <span className="sr-only">
        {used} of {free} free problems used
      </span>
      {variant === "bar" ? (
        <span className={styles.meterText} aria-hidden="true">
          Level check · <strong>{used}</strong> answered
        </span>
      ) : (
        <span className={styles.meterText} aria-hidden="true">
          <strong>{used}</strong>
          <span className={styles.meterLong}> answered</span>
        </span>
      )}
      <span className={styles.meterTrack} aria-hidden="true">
        <span
          className={styles.meterFill}
          style={{ transform: `scaleX(${share})` }}
        />
      </span>
      <span className={styles.meterQuiet} aria-hidden="true">
        <span className={styles.meterLong}>of {free}</span>
        <span className={styles.meterShort}>/{free}</span>
      </span>
    </span>
  );
}
