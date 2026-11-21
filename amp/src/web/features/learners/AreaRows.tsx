import type { CSSProperties, ReactNode } from "react";
import {
  fitScale,
  LevelAxis,
  LevelBar,
  LevelNotStarted,
  shortGrade,
  type Estimate,
} from "../../ui/level-range";
import { STANDING, STANDING_FILL, STANDINGS } from "./SkillKey";
import styles from "./AreaRows.module.css";

/** A level on the grade axis (K = 0 … Precalculus = 12): the best guess,
 * the likely range and the answers behind it. */
export type AreaLevel = {
  level: number;
  low: number;
  high: number;
  answered: number;
};
/** What was checked in the whole grades `from`…`to` below an area's level:
 * each skill there counted once, in its standing. */
export type AreaChecked = {
  from: number;
  to: number;
  skills: number;
  strong: number;
  earned: number;
  tried: number;
  notAsked: number;
};
export type AreaRow = {
  area: string;
  title: string;
  level: AreaLevel | null;
  checked: AreaChecked | null;
};

/** Fewer answers than this behind an area's level: drawn as an estimate. */
const FEW_ANSWERS = 10;

const estimate = (level: AreaLevel): Estimate => ({
  level: level.level,
  sd: Math.max(0.1, (level.high - level.low) / 4),
  low: level.low,
  high: level.high,
});
/** Whole grades in short words: "Gr 3–4", "K–Gr 1", "Gr 8–Alg 1". */
export const gradeSpan = (from: number, to: number) => {
  const [a, b] = [Math.round(from), Math.round(to)];
  if (a === b) return shortGrade(a);
  if (a >= 1 && b <= 8) return `Gr ${a}–${b}`;
  return `${shortGrade(a)}–${shortGrade(b)}`;
};
const grades = gradeSpan;
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** An area's checked skills in words, for a screen reader and a tip. */
export function checkedWords(checked: AreaChecked, numbers: boolean) {
  const parts = STANDINGS.map(
    (standing) =>
      `${checked[standing]} ${STANDING[standing].term.toLowerCase()}`,
  ).join(", ");
  return `${plural(checked.skills, "skill")} ${
    numbers ? `in ${grades(checked.from, checked.to)}` : "below"
  }: ${parts}`;
}

/**
 * A learner's five areas of math, one fixed-height row each: where they are
 * working (the likely range and best guess, on one scale for all five, in
 * the area's hue), and what was checked below it, as one bar of strong,
 * earned, tried and not-asked skills (the `SkillKey` reads it). The caller
 * gives each row its action (the skills not asked yet) and the caption.
 * Grade names show only with `numbers`; the bars draw either way.
 */
export function AreaRows({
  areas,
  overall,
  numbers,
  label,
  levelHead = "Working at",
  checkedHead = "Checked below",
  action,
  caption,
}: {
  areas: readonly AreaRow[];
  overall: AreaLevel | null;
  /** Grade names and numbers (the learner's own switch). */
  numbers: boolean;
  /** The list's name for a screen reader. */
  label: string;
  levelHead?: string;
  checkedHead?: string;
  action?: (row: AreaRow) => ReactNode;
  caption?: ReactNode;
}) {
  const scale = fitScale(
    [overall, ...areas.map((row) => row.level)]
      .filter((level): level is AreaLevel => !!level)
      .map(estimate),
    { minSpan: 4 },
  );
  const checking = areas.some((row) => row.checked);
  return (
    <div
      className={styles.areas}
      data-checking={checking || undefined}
      data-area-rows=""
    >
      <div className={styles.head} aria-hidden="true">
        <span className={styles.levelHead}>
          {levelHead}
          {numbers && <LevelAxis scale={scale} />}
        </span>
        {checking && <span className={styles.checkedHead}>{checkedHead}</span>}
      </div>
      <ul className={styles.rows} aria-label={label}>
        {areas.map((row) => (
          <li
            key={row.area}
            className={styles.row}
            data-strand={row.area}
            data-area={row.area}
          >
            <span className={styles.title}>{row.title}</span>
            <span
              className={styles.level}
              role="img"
              aria-label={
                row.level
                  ? numbers
                    ? `${row.title}: likely ${grades(
                        Math.round(row.level.low),
                        Math.round(row.level.high),
                      )}, best guess ${shortGrade(row.level.level)}`
                    : `${row.title}: a likely range, narrowing with practice`
                  : `${row.title}: no answers yet`
              }
            >
              {row.level ? (
                <LevelBar
                  estimate={estimate(row.level)}
                  scale={scale}
                  estimated={row.level.answered < FEW_ANSWERS}
                />
              ) : (
                <LevelNotStarted label="No answers yet" />
              )}
            </span>
            {checking && (
              <span className={styles.checked}>
                {row.checked ? (
                  <CheckedBar checked={row.checked} numbers={numbers} />
                ) : (
                  <span className={styles.none} aria-label="Nothing below yet">
                    –
                  </span>
                )}
              </span>
            )}
            <span className={styles.action}>{action?.(row)}</span>
          </li>
        ))}
      </ul>
      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  );
}

/** The skills of the grades below, one part per standing, in the key's
 * order, each as wide as its share. */
function CheckedBar({
  checked,
  numbers,
}: {
  checked: AreaChecked;
  numbers: boolean;
}) {
  const total = Math.max(1, checked.skills);
  return (
    <span
      className={styles.checkedCell}
      role="img"
      aria-label={checkedWords(checked, numbers)}
      data-checked-bar=""
    >
      {numbers && (
        <span className={styles.grades}>
          {grades(checked.from, checked.to)}
        </span>
      )}
      <span className={styles.bar}>
        {STANDINGS.filter((standing) => checked[standing] > 0).map(
          (standing) => (
            <span
              key={standing}
              className={STANDING_FILL}
              data-standing={standing}
              style={
                { "--share": checked[standing] / total } as CSSProperties
              }
            />
          ),
        )}
      </span>
    </span>
  );
}
