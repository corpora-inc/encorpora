import styles from "./SkillKey.module.css";

/** Where a skill stands, the words every screen uses for it. One rule each:
 * Strong is `progress.ts`'s review-ready, Earned `learning/earned.ts`. */
export type SkillStanding = "strong" | "earned" | "tried" | "notAsked";

export const STANDING: Record<
  SkillStanding,
  { term: string; meaning: string }
> = {
  strong: { term: "Strong", meaning: "4 of the last 5 right without help" },
  earned: { term: "Earned", meaning: "right once without help" },
  tried: { term: "Tried", meaning: "not yet right without help" },
  notAsked: { term: "Not asked yet", meaning: "no problem on it so far" },
};
export const STANDINGS: readonly SkillStanding[] = [
  "strong",
  "earned",
  "tried",
  "notAsked",
];

/** The fill of a standing (with `data-standing`), for a bar's parts. */
export const STANDING_FILL = styles.fill;

/** A skill standing's swatch: the same fill as its part of a bar. */
export function StandingSwatch({ standing }: { standing: SkillStanding }) {
  return (
    <span
      className={`${styles.swatch} ${styles.fill}`}
      data-standing={standing}
      aria-hidden="true"
    />
  );
}

/**
 * The key to the skill bars, always on screen beside them (never a tooltip
 * or a paragraph): each standing's swatch, its name and what it means.
 * `level` adds the likely-level bar's own mark first.
 */
export function SkillKey({
  standings = STANDINGS,
  level,
  label = "Key",
}: {
  standings?: readonly SkillStanding[];
  /** The level bar's mark and its words ("Likely level"). */
  level?: string;
  label?: string;
}) {
  return (
    <ul className={styles.key} aria-label={label} data-skill-key="">
      {level && (
        <li>
          <span className={styles.levelMark} aria-hidden="true">
            <span />
          </span>
          <span className={styles.term}>{level}</span>
        </li>
      )}
      {standings.map((standing) => (
        <li key={standing}>
          <StandingSwatch standing={standing} />
          <span className={styles.term}>{STANDING[standing].term}</span>
          <span className={styles.meaning}>{STANDING[standing].meaning}</span>
        </li>
      ))}
    </ul>
  );
}
