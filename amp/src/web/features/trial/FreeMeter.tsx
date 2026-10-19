import styles from "./Trial.module.css";

/** A calm count of free problems used: "12 of 100 free". */
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
      <span className={styles.meterTrack} aria-hidden="true">
        <span
          className={styles.meterFill}
          style={{ transform: `scaleX(${share})` }}
        />
      </span>
      <span className={styles.meterText} aria-hidden="true">
        <strong>{used}</strong>
        <span className={styles.meterLong}> of {free} free</span>
        <span className={styles.meterShort}>/{free}</span>
      </span>
    </span>
  );
}
