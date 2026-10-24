import { gradeName, levelDetails } from "../../learning/level-check";
import styles from "./LevelReadout.module.css";

/** A continuous working level beside its uncertainty, on the curriculum scale.
 * Hundredths make small changes visible; they do not imply measured precision. */
export function LevelReadout({
  estimate,
}: {
  estimate: { level: number; sd: number };
}) {
  const { point, from, to } = levelDetails(estimate);
  const label =
    estimate.level < 0 ? "Before kindergarten" : gradeName(estimate.level);
  return (
    <div className={styles.readout} data-testid="level-readout">
      <div className={styles.values}>
        <div>
          <span className={styles.label}>Working level</span>
          <div className={styles.point}>
            <strong>{point}</strong>
            <span>{label}</span>
          </div>
        </div>
        <div className={styles.range}>
          <span className={styles.label}>Estimated range</span>
          <strong>
            {from}–{to}
          </strong>
        </div>
      </div>
      <p className={styles.scale}>
        K = 0 · Grades 1–8 · High-school courses = 9–12
      </p>
    </div>
  );
}
