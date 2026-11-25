import type { ReactNode } from "react";
import styles from "./FocusMix.module.css";

/** Why AMP chose a problem, as a dashboard groups them. */
export type FocusKey =
  "catching-up" | "reviewing" | "checking-earlier" | "new-ground" | "chosen";
export type FocusSkill = { id: string; title: string };
export type FocusEntry = {
  key: FocusKey;
  count: number;
  skills: readonly FocusSkill[];
};

/** Each reason in plain words. */
export const FOCUS_WORDS: Record<FocusKey, string> = {
  "catching-up": "Catching up",
  reviewing: "Reviewing",
  "checking-earlier": "Checking earlier skills",
  "new-ground": "New ground",
  chosen: "Chosen practice",
};

/** The four reasons AMP chooses by, in the order the line names them. A
 * learner's line names all four whatever their counts (a 0 is a 0), so every
 * learner's line is the same shape and the counts line up down a list. */
export const LINE_REASONS = [
  "catching-up",
  "reviewing",
  "checking-earlier",
  "new-ground",
] as const satisfies readonly FocusKey[];
/** The line's words: the reason's own, the longest short enough to keep
 * four on a line. */
const LINE_WORDS: Record<(typeof LINE_REASONS)[number], string> = {
  "catching-up": FOCUS_WORDS["catching-up"],
  reviewing: FOCUS_WORDS.reviewing,
  "checking-earlier": "Checking earlier",
  "new-ground": FOCUS_WORDS["new-ground"],
};

const countOf = (mix: readonly FocusEntry[], key: FocusKey) =>
  mix.find((entry) => entry.key === key)?.count ?? 0;

/**
 * What AMP has been working on with a learner, as one line: their last
 * answered problems counted by the reason each was chosen (catching up an
 * earlier skill, reviewing, checking earlier skills, new ground), and how
 * many someone chose, when any. Words and numbers only; the skills behind
 * each are a tap away (`FocusSkills`, in the sheet `onOpen` opens).
 *
 * The whole line is one control of a fixed height: 44 px on one line with
 * room, 60 px on two under it, 80 px on a phone (the label, then the four
 * reasons two to a line). Nothing in it depends on the counts.
 */
export function FocusLine({
  answered,
  mix,
  label,
  openLabel,
  onOpen,
}: {
  answered: number;
  mix: readonly FocusEntry[];
  /** What is counted: "Last 20 problems". */
  label: string;
  /** The control, for assistive technology: "Pip’s last 20 problems". */
  openLabel: string;
  onOpen: () => void;
}) {
  if (!answered || !mix.length) return null;
  const chosen = countOf(mix, "chosen");
  const counts = LINE_REASONS.map((key) => ({
    key,
    words: LINE_WORDS[key],
    count: countOf(mix, key),
  }));
  return (
    <div className={styles.focus} data-focus-mix="">
      <button
        type="button"
        className={styles.line}
        data-focus-line=""
        aria-haspopup="dialog"
        aria-label={`${openLabel}: ${[
          ...counts.map((entry) => `${FOCUS_WORDS[entry.key]} ${entry.count}`),
          ...(chosen > 0 ? [`${FOCUS_WORDS.chosen} ${chosen}`] : []),
        ].join(", ")}. See the skills`}
        onClick={onOpen}
      >
        <span className={styles.label}>
          {label}
          {chosen > 0 && (
            <span data-focus="chosen">
              <span aria-hidden="true"> · </span>
              {chosen} chosen
            </span>
          )}
        </span>
        <span className={styles.reasons}>
          {counts.map((entry) => (
            <span
              key={entry.key}
              className={styles.reason}
              data-focus={entry.key}
              data-zero={entry.count === 0 || undefined}
            >
              {entry.words} <strong>{entry.count}</strong>
            </span>
          ))}
        </span>
        <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
        </svg>
      </button>
    </div>
  );
}

/**
 * The skills behind a learner's last problems, by the reason each was
 * chosen: every reason that has any, its count, then all of its skills, most
 * often first. `skill` draws a skill's name (a link that opens it); plain
 * text without.
 */
export function FocusSkills({
  mix,
  skill = (entry) => entry.title,
}: {
  mix: readonly FocusEntry[];
  skill?: (entry: FocusSkill) => ReactNode;
}) {
  return (
    <div className={styles.detail} data-focus-skills="">
      {mix.map((entry) => (
        <section
          key={entry.key}
          className={styles.group}
          data-focus={entry.key}
          aria-labelledby={`focus-${entry.key}`}
        >
          <h3 id={`focus-${entry.key}`} className={styles.groupTitle}>
            {FOCUS_WORDS[entry.key]}
            <span className={styles.groupCount}>{entry.count}</span>
          </h3>
          {entry.skills.length > 0 && (
            <ul className={styles.skills}>
              {entry.skills.map((entrySkill) => (
                <li key={entrySkill.id}>{skill(entrySkill)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
