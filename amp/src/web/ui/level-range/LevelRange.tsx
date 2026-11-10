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
  estimate: Estimate;
  estimated?: boolean;
};

/** Whole sentences with named slots, so each translates as a unit. */
const words = {
  likely: (from: string, to: string) =>
    from === to ? `Likely ${from}` : `Likely ${from} to ${to}`,
  summary: (answered: number, from: string, to: string) =>
    from === to
      ? `After ${answered} ${answered === 1 ? "problem" : "problems"}, our estimate is near ${from}.`
      : `After ${answered} ${answered === 1 ? "problem" : "problems"}, we think you’re somewhere between ${from} and ${to}.`,
  row: (area: string, level: string, from: string, to: string) =>
    `${area}: best guess ${level}, likely ${from} to ${to}`,
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
  action,
  footer,
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
  title?: string;
  /** The next step, beside the best guess: Practice. */
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const [from, to] = likelyRange(overall);
  const detail = levelDetails(overall);
  const scale = fitScale([overall, ...areas.map((area) => area.estimate)], {
    minSpan: 5,
    include: grade ? [...grade] : [],
  });
  // The path says something once it has a few points; before that it would
  // be a lone segment, so it waits.
  const pathShown = answered >= PATH_FROM;
  return (
    <section className={styles.view} aria-labelledby="level-range-title">
      <div className={styles.head}>
        <div className={styles.estimate}>
          <h2 id="level-range-title" className={styles.eyebrow}>
            {title}
          </h2>
          <p className={styles.bestLabel}>Best guess</p>
          <p className={styles.best} data-testid="level-best">
            <span className={styles.bestName}>{gradeName(overall.level)}</span>
            <span className={styles.bestPoint}>{detail.point}</span>
          </p>
          <p className={styles.likely}>
            {words.likely(gradeName(from), gradeName(to))}
            <span className={styles.likelyNumbers}>
              {detail.from}–{detail.to}
            </span>
          </p>
          <p className={styles.summary}>
            {words.summary(answered, gradeName(from), gradeName(to))}
          </p>
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      <div className={styles.areas}>
        <h3 className={styles.caption}>By area</h3>
        <ul className={styles.rows}>
          <AreaRow
            area={{ id: "", label: "Overall", estimate: overall }}
            scale={scale}
            grade={grade}
            strong
          />
          {areas.map((area) => (
            <AreaRow key={area.id} area={area} scale={scale} grade={grade} />
          ))}
        </ul>
        <div className={styles.axisRow}>
          <span />
          <LevelAxis scale={scale} />
          <span />
        </div>
      </div>
      {pathShown && (
        <figure className={styles.pathFigure}>
          <figcaption className={styles.caption}>How it narrowed</figcaption>
          <LevelPath points={path} state={pathState} />
          <Legend grade={!!grade} />
        </figure>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

/** Answers before the path of the estimate is drawn: two steps of five. */
const PATH_FROM = 10;

function AreaRow({
  area,
  scale,
  grade,
  strong = false,
}: {
  area: LevelRangeArea;
  scale: RangeScale;
  grade: readonly [number, number] | null;
  strong?: boolean;
}) {
  const [from, to] = likelyRange(area.estimate);
  return (
    <li
      className={`${styles.row} ${strong ? styles.rowStrong : ""}`}
      data-strand={area.id || undefined}
      aria-label={words.row(
        area.label,
        gradeName(area.estimate.level),
        gradeName(from),
        gradeName(to),
      )}
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
        {from.toFixed(1)}–{to.toFixed(1)}
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

/**
 * Before the first answer: the starting estimate as a quiet, dashed range on
 * a labelled scale, the line that says it sharpens with practice, and the one
 * step that starts it. Never an empty chart.
 */
export function LevelRangeStart({
  start,
  action,
  title = "Where you are",
  body,
}: {
  /** Where AMP begins: from a birth year, or the start an adult chose. */
  start: Estimate;
  action?: ReactNode;
  title?: string;
  /** Instead of the default line, for someone reading another's level. */
  body?: ReactNode;
}) {
  const [from, to] = likelyRange(start);
  const scale = fitScale([start], { minSpan: 6, pad: 1 });
  return (
    <section
      className={`${styles.view} ${styles.start}`}
      aria-labelledby="level-range-title"
    >
      <div className={styles.startText}>
        <h2 id="level-range-title" className={styles.eyebrow}>
          {title}
        </h2>
        <p className={styles.startTitle}>Your level appears as you practice</p>
        <p className={styles.startBody}>
          {body ??
            `AMP starts near ${gradeName(start.level)}, somewhere between ${gradeName(from)} and ${gradeName(to)}. Every answer narrows the range.`}
        </p>
        {action && <div className={styles.startAction}>{action}</div>}
      </div>
      <figure className={styles.startFigure}>
        <figcaption className={styles.caption}>Starting estimate</figcaption>
        <div
          className={styles.startBar}
          role="img"
          aria-label={`Starting estimate: ${gradeName(start.level)}, likely ${gradeName(from)} to ${gradeName(to)}`}
        >
          <LevelBar estimate={start} scale={scale} estimated size="large" />
        </div>
        <LevelAxis scale={scale} />
        <p className={styles.startNote}>
          <span className={styles.startNoteBefore} aria-hidden="true" />
          Now
          <svg viewBox="0 0 24 12" aria-hidden="true">
            <path d="M2 6h18M16 2l4 4-4 4" />
          </svg>
          <span className={styles.startNoteAfter} aria-hidden="true" />
          After practice
        </p>
      </figure>
    </section>
  );
}
