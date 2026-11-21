import { Fragment, type ReactNode } from "react";
import styles from "./FocusMix.module.css";

/** Why AMP chose a problem, as a dashboard groups them. */
export type FocusKey =
  | "catching-up"
  | "reviewing"
  | "checking-earlier"
  | "new-ground"
  | "chosen";
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

/** Skills named on a line before the rest are counted. */
const NAMED = 2;

/**
 * What AMP has been working on with a learner and why: their last answered
 * problems grouped by the reason each was chosen (catching up an earlier
 * skill, reviewing, checking earlier skills, new ground, or a focus someone
 * chose), each with how many and the skills behind it, most often first.
 * `skill` draws a skill's name (a link that opens it); plain text without.
 */
export function FocusMix({
  answered,
  mix,
  label,
  skill = (entry) => entry.title,
}: {
  answered: number;
  mix: readonly FocusEntry[];
  /** The block's heading: "Last 20 problems". */
  label: string;
  skill?: (entry: FocusSkill) => ReactNode;
}) {
  if (!answered || !mix.length) return null;
  return (
    <section className={styles.focus} data-focus-mix="">
      <h3 className={styles.label}>{label}</h3>
      <dl className={styles.lines}>
        {mix.map((entry) => {
          const named = entry.skills.slice(0, NAMED);
          const more = entry.skills.length - named.length;
          return (
            <div key={entry.key} className={styles.line} data-focus={entry.key}>
              <dt>
                <span className={styles.reason}>{FOCUS_WORDS[entry.key]}</span>
                <span className={styles.count}>{entry.count}</span>
              </dt>
              <dd>
                {named.map((entrySkill, index) => (
                  <Fragment key={entrySkill.id}>
                    {index > 0 && ", "}
                    {skill(entrySkill)}
                  </Fragment>
                ))}
                {more > 0 && (
                  <span className={styles.more}>
                    {" "}
                    and {more} more
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
