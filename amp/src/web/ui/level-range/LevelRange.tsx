import type { ReactNode } from "react";
import { gradeName, levelDetails } from "../../../learning/level-check";
import { LevelAxis, LevelBar } from "./LevelBar";
import { LevelPath, type PathPoint } from "./LevelPath";
import { fitScale, likelyRange, type Estimate, type RangeScale } from "./scale";
import styles from "./LevelRange.module.css";

/** One area of the curriculum as the view draws it. `id` is its strand, for
 * its hue; `estimated` marks an estimate with too little work behind it. */
export type LevelRangeArea = {
  id: string;
  label: string;
  /** Null: nothing answered yet (only ever the overall row). */
  estimate: Estimate | null;
  estimated?: boolean;
};

/** Whole sentences with named slots, so each translates as a unit. `who`
 * is a learner's name when someone else reads their level; without it the
 * sentences speak to the learner. */
const problems = (n: number) => `${n} ${n === 1 ? "problem" : "problems"}`;
const words = {
  likely: (from: string, to: string) =>
    from === to ? `Likely ${from}` : `Likely ${from} to ${to}`,
  /** What the estimate rests on; the likely range above already says where. */
  summary: (answered: number) => `${problems(answered)} answered.`,
  /** With grade numbers hidden: what the bands mean, without a grade. */
  unnumbered: (answered: number, who?: string) =>
    who
      ? `${problems(answered)} answered. Each band is where ${who} is likely working.`
      : `${problems(answered)} answered. Each band is where you’re likely working.`,
  row: (area: string, level: string, from: string, to: string) =>
    `${area}: best guess ${level}, likely ${from} to ${to}`,
  rowUnnumbered: (area: string) =>
    `${area}: a likely range, narrowing with practice`,
  /** Before the first answer: no grade named, only how soon it's known. */
  notYet: "Level not measured yet: anywhere from kindergarten to precalculus",
  find: (who?: string) =>
    who
      ? `We’ll find ${who}’s level in a few minutes of practice.`
      : "We’ll find your level in a few minutes. Just start answering.",
  premise: (who?: string) =>
    who
      ? "No planning needed: AMP makes every minute count."
      : "Spend the time; AMP makes every minute count.",
};

/**
 * One learner's level: the best guess with its likely range, the path that
 * range took as the answers came in, and every area on one shared scale,
 * each with its own error bar. Plain numbers in, nothing fetched.
 */
export function LevelRange({
  overall,
  answered,
  areas,
  path = null,
  pathState = "ready",
  grade = null,
  title = "Where you are",
  labelledBy,
  action,
  footer,
  numbers = true,
  decimals = numbers,
  who,
}: {
  overall: Estimate;
  /** Problems the estimate rests on. */
  answered: number;
  /** In display order. */
  areas: readonly LevelRangeArea[];
  path?: readonly PathPoint[] | null;
  pathState?: "ready" | "loading" | "failed";
  /** The learner's own grade, painted behind every bar. */
  grade?: readonly [from: number, to: number] | null;
  /** The view's own heading; null where the page title already names it
   * (then `labelledBy` names the page title's id). */
  title?: string | null;
  labelledBy?: string;
  /** The next step, beside the best guess: Practice. */
  action?: ReactNode;
  footer?: ReactNode;
  /** Grade names and numbers; off where a learner's levels are hidden, which
   * leaves the bars, their bands and the learner's own grade. */
  numbers?: boolean;
  /** The working level's decimals ("10.69", "8.02–13.00") beside the grade
   * names: only where grade numbers are switched on. */
  decimals?: boolean;
  /** The learner's name when someone else reads it. */
  who?: string;
}) {
  const [from, to] = likelyRange(overall);
  const detail = levelDetails(overall);
  const scale = fitScale(
    [overall, ...areas.flatMap((area) => area.estimate ?? [])],
    {
      minSpan: 5,
      include: grade ? [...grade] : [],
    },
  );
  // The path says something once the range has really narrowed; before
  // that it would be a lone segment or a flat band, so it waits.
  const pathShown =
    answered >= PATH_FROM && !!path && pathState === "ready" && narrowed(path);
  return (
    <section
      className={styles.view}
      aria-labelledby={labelledBy ?? "level-range-title"}
      data-level-view
    >
      <div className={styles.head}>
        {numbers ? (
          <div className={styles.estimate} data-testid="level-readout">
            {title && (
              <h2 id="level-range-title" className={styles.eyebrow}>
                {title}
              </h2>
            )}
            <p className={styles.bestLabel}>Best guess</p>
            <p className={styles.best}>
              <span className={styles.bestName}>
                {gradeName(overall.level)}
              </span>
              {decimals && (
                <span className={styles.bestPoint}>{detail.point}</span>
              )}
            </p>
            <p className={styles.likely}>
              {words.likely(gradeName(from), gradeName(to))}
              {decimals && (
                <span className={styles.likelyNumbers}>
                  {detail.from}–{detail.to}
                </span>
              )}
            </p>
            <p className={styles.summary}>{words.summary(answered)}</p>
          </div>
        ) : (
          <div className={styles.estimate}>
            {title && (
              <h2 id="level-range-title" className={styles.eyebrow}>
                {title}
              </h2>
            )}
            <p className={styles.summary}>{words.unnumbered(answered, who)}</p>
          </div>
        )}
        {action && <div className={styles.action}>{action}</div>}
      </div>
      <div className={styles.areas}>
        <h3 className={styles.caption}>By area</h3>
        <LevelRows
          overall={overall}
          areas={areas}
          scale={scale}
          grade={grade}
          numbers={numbers}
          decimals={decimals}
        />
      </div>
      {pathShown && (
        <figure className={styles.pathFigure}>
          <figcaption className={styles.caption}>How it narrowed</figcaption>
          <LevelPath points={path} state={pathState} labels={numbers} />
          <Legend grade={!!grade} />
        </figure>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

/** Answers before the path of the estimate is drawn: two steps of five. */
const PATH_FROM = 10;
/** Grades the likely range must have narrowed by for its path to be worth
 * a chart. */
const NARROWED_BY = 0.75;
function narrowed(path: readonly PathPoint[]) {
  const width = (point: PathPoint) => {
    const [from, to] = likelyRange(point);
    return to - from;
  };
  return (
    path.length >= 3 && width(path[0]!) - width(path.at(-1)!) >= NARROWED_BY
  );
}

/**
 * Every area as an error bar on one scale, the overall estimate first and
 * larger, with the grade axis under them. The parts of `LevelRange`, for a
 * place that shows several learners on one shared scale (the class map).
 */
export function LevelRows({
  overall,
  overallLabel = "Overall",
  areas,
  scale,
  grade = null,
  numbers = true,
  decimals = numbers,
  overallEstimated = false,
  axis = true,
  moving = false,
}: {
  /** Null before the first answer: the row is not measured yet. */
  overall: Estimate | null;
  overallLabel?: string;
  areas: readonly LevelRangeArea[];
  scale: RangeScale;
  grade?: readonly [from: number, to: number] | null;
  numbers?: boolean;
  /** Each row's likely range in numbers, at the row's end. */
  decimals?: boolean;
  /** The overall estimate is a starting guess, drawn dashed. */
  overallEstimated?: boolean;
  axis?: boolean;
  /** A lone learner's unmeasured row searches (LevelBar's `moving`); a
   * column of many stays still. */
  moving?: boolean;
}) {
  return (
    <>
      <ul className={`${styles.rows} ${decimals ? "" : styles.rowsBare}`}>
        <AreaRow
          area={{
            id: "",
            label: overallLabel,
            estimate: overall,
            estimated: overallEstimated,
          }}
          scale={scale}
          grade={grade}
          numbers={numbers}
          decimals={decimals}
          moving={moving}
          strong
        />
        {areas.map((area) => (
          <AreaRow
            key={area.id}
            area={area}
            scale={scale}
            grade={grade}
            numbers={numbers}
            decimals={decimals}
          />
        ))}
      </ul>
      {numbers && axis && (
        <div className={`${styles.axisRow} ${decimals ? "" : styles.rowsBare}`}>
          <span />
          <LevelAxis scale={scale} />
          <span />
        </div>
      )}
    </>
  );
}

function AreaRow({
  area,
  scale,
  grade,
  numbers,
  decimals,
  strong = false,
  moving = false,
}: {
  area: LevelRangeArea;
  scale: RangeScale;
  grade: readonly [number, number] | null;
  numbers: boolean;
  decimals: boolean;
  strong?: boolean;
  moving?: boolean;
}) {
  if (!area.estimate)
    return (
      <li
        className={`${styles.row} ${strong ? styles.rowStrong : ""}`}
        data-strand={area.id || undefined}
        aria-label={`${area.label}: ${words.notYet}`}
      >
        <span className={styles.rowName} aria-hidden="true">
          {area.label}
        </span>
        <span className={styles.rowBar} aria-hidden="true">
          <LevelBar
            estimate={null}
            scale={scale}
            size={strong ? "large" : "regular"}
            moving={moving}
          />
        </span>
        <span className={styles.rowNumbers} aria-hidden="true">
          {numbers ? "Not yet" : ""}
        </span>
      </li>
    );
  const [from, to] = likelyRange(area.estimate);
  return (
    <li
      className={`${styles.row} ${strong ? styles.rowStrong : ""}`}
      data-strand={area.id || undefined}
      aria-label={
        numbers
          ? words.row(
              area.label,
              gradeName(area.estimate.level),
              gradeName(from),
              gradeName(to),
            )
          : words.rowUnnumbered(area.label)
      }
    >
      <span className={styles.rowName} aria-hidden="true">
        {area.label}
      </span>
      <span className={styles.rowBar} aria-hidden="true">
        <LevelBar
          estimate={area.estimate}
          scale={scale}
          band={grade}
          estimated={area.estimated}
          size={strong ? "large" : "regular"}
        />
      </span>
      <span className={styles.rowNumbers} aria-hidden="true">
        {!numbers
          ? ""
          : area.estimated
            ? strong
              ? "Starting"
              : "Not yet"
            : decimals
              ? `${from.toFixed(1)}–${to.toFixed(1)}`
              : ""}
      </span>
    </li>
  );
}

function Legend({ grade }: { grade: boolean }) {
  return (
    <div className={styles.legend} aria-hidden="true">
      <span>
        <i className={styles.legendBand} />
        Likely range
      </span>
      <span>
        <i className={styles.legendGuess} />
        Best guess
      </span>
      {grade && (
        <span>
          <i className={styles.legendGrade} />
          Grade for age
        </span>
      )}
    </div>
  );
}

/** The whole curriculum, kindergarten to precalculus: the scale a level
 * that isn't measured yet spans. */
export const WHOLE_SCALE: RangeScale = { lo: 0, hi: 12 };

/**
 * Day 0 (docs/design/ia.md, rule 7): one centred column. One heading, the
 * level not yet measured (the whole scale, its dot searching with a "?"),
 * one promise and the premise under it, the one prominent action, and quiet
 * secondary items below. It names no grade: the first answers find it.
 */
export function LevelRangeStart({
  action,
  title = "Where you are",
  heading = 2,
  secondary,
  who,
}: {
  /** The one prominent action: Start practicing. */
  action?: ReactNode;
  /** The hero's one heading. */
  title?: string;
  /** The heading's level: 1 when the hero is the page. */
  heading?: 1 | 2;
  /** Quiet items under the action: the free problems left, a link. */
  secondary?: ReactNode;
  /** The learner's name when someone else reads it. */
  who?: string;
}) {
  const Heading = heading === 1 ? "h1" : "h2";
  return (
    <section
      className={styles.hero}
      aria-labelledby="level-start-title"
      data-level-view
      data-level-start
    >
      <Heading id="level-start-title" className={styles.heroTitle}>
        {title}
      </Heading>
      <figure className={styles.heroFigure}>
        <div className={styles.heroBar} role="img" aria-label={words.notYet}>
          <LevelBar estimate={null} scale={WHOLE_SCALE} size="large" moving />
        </div>
        <LevelAxis scale={WHOLE_SCALE} />
      </figure>
      <div className={styles.heroWords}>
        <p className={styles.heroBody}>{words.find(who)}</p>
        <p className={styles.heroPremise}>{words.premise(who)}</p>
      </div>
      {action && <div className={styles.heroAction}>{action}</div>}
      {secondary && <div className={styles.heroSecondary}>{secondary}</div>}
    </section>
  );
}
