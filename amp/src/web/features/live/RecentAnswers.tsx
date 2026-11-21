import type { LiveOutcome } from "../../../schools/live/contracts";
import { Changed } from "./Changed";
import styles from "./RecentAnswers.module.css";

const SLOTS = 5;

const outcomeWord = (outcome: LiveOutcome) =>
  !outcome.correct ? "wrong" : outcome.assisted ? "right with help" : "right";

/** The last five answers, oldest first, in words. */
export function recentWords(recent: readonly LiveOutcome[]) {
  const shown = recent.slice(-SLOTS);
  if (shown.length === 0) return "No answers yet";
  return `Last ${shown.length === 1 ? "answer" : `${shown.length} answers`}, oldest first: ${shown.map(outcomeWord).join(", ")}`;
}

/**
 * The last five answers as marks, newest at the right: a filled dot is
 * right, a ring is right with help, a cross is wrong. Five slots always,
 * so the strip never changes width; a slot with no answer yet is a faint
 * dot. The newest settles in when it arrives.
 */
export function RecentAnswers({
  recent,
  answered,
}: {
  recent: readonly LiveOutcome[];
  /** The answer count: when it changes, the newest mark is new. */
  answered: number;
}) {
  const shown = recent.slice(-SLOTS);
  const slots: (LiveOutcome | null)[] = [
    ...Array.from({ length: SLOTS - shown.length }, () => null),
    ...shown,
  ];
  return (
    <span className={styles.strip} role="img" aria-label={recentWords(recent)}>
      {slots.map((outcome, index) => {
        const mark = (
          <svg viewBox="0 0 12 12" className={styles.slot} aria-hidden="true">
            {outcome === null ? (
              <circle className={styles.empty} cx="6" cy="6" r="1.6" />
            ) : !outcome.correct ? (
              <path
                className={styles.wrong}
                d="M2.6 2.6l6.8 6.8M9.4 2.6l-6.8 6.8"
              />
            ) : outcome.assisted ? (
              <circle className={styles.assisted} cx="6" cy="6" r="4" />
            ) : (
              <circle className={styles.right} cx="6" cy="6" r="5" />
            )}
          </svg>
        );
        return index === SLOTS - 1 && outcome !== null ? (
          <Changed
            key={index}
            value={answered}
            className={styles.newest}
            motion="pop"
          >
            {mark}
          </Changed>
        ) : (
          <span key={index} className={styles.cell}>
            {mark}
          </span>
        );
      })}
    </span>
  );
}
