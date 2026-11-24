import { Link, useParams, useRouterState } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { practiceMinutes } from "../../lib/practice-minutes";
import { EntityLink } from "../../nav/links";
import { sheetOf, useSheetNav } from "../../nav/sheet";
import { Button } from "../../ui/Button";
import { LevelBar } from "../../ui/level-range";
import { QrCode } from "../../ui/QrCode";
import { Sheet } from "../../ui/Sheet";
import { AreaRows, gradeSpan, type AreaRow } from "../learners/AreaRows";
import { FocusMix } from "../learners/FocusMix";
import { WeekDots } from "../learners/WeekSummary";
import { WeekSummary } from "../learners/WeekSummary";
import { lastPracticed, percentRight } from "../learners/week-words";
import { showByGrade } from "../inventory/inventory-view";
import { childPath } from "../spaces/identity";
import { CopyButton } from "../school/parts";
import type { PracticeFilter } from "../practice/curriculum-filter";
import type {
  DashboardArea,
  DashboardChild,
  FamilyChild,
  FamilyDashboard,
} from "./api";
import styles from "./Dashboard.module.css";

/*
 * The parts of a family's Today that read the dashboard (family/api.ts
 * `familyDashboardOptions`): each child's week on their row, what AMP is
 * working on with them, their five areas with what was checked below, the
 * skills not asked yet (one tap to practice one), the family's week, and how
 * the children get in. The screen composes them (Today.tsx).
 */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** A child's week on their row: seven dots, then minutes, problems and how
 * many were right; in a quiet week the empty dots say so and the words say
 * when they last practiced (short enough never to be cut). */
export function ChildWeekFacts({
  child,
  board,
  today,
  from,
}: {
  child: FamilyChild;
  /** Their dashboard block; absent while it failed to load. */
  board: DashboardChild | undefined;
  today: string;
  from: string | undefined;
}) {
  const last = board?.week.lastPracticed ?? child.week.lastPracticed;
  if (!last)
    return (
      <span className={styles.facts} data-week-quiet="">
        Not started
      </span>
    );
  const minutes = board?.week.minutes ?? child.week.minutes;
  const problems = board?.week.problems ?? child.week.problems;
  const time = practiceMinutes(minutes, problems);
  const right = board ? percentRight(board.week.correct, problems) : null;
  return (
    <span className={styles.facts}>
      {board && from && (
        <WeekDots from={from} today={today} daily={board.daily} />
      )}
      {time ? (
        <span className={styles.figures} data-week-figures="">
          <strong>{time}</strong>
          <span aria-hidden="true"> · </span>
          <strong>{problems}</strong> {problems === 1 ? "problem" : "problems"}
          {right !== null && (
            <>
              <span aria-hidden="true"> · </span>
              <strong>{right}%</strong> right
            </>
          )}
        </span>
      ) : (
        <span className={styles.figures} data-week-quiet="">
          Last practiced{" "}
          {lastPracticed(last, today).replace(/^(Today|Yesterday)$/, (day) =>
            day.toLowerCase(),
          )}
        </span>
      )}
    </span>
  );
}

/** The address of the sheet listing one area's skills not asked yet. */
const notAskedSheet = (learner: string, area: string) =>
  `not-asked:${learner}:${area}`;

/**
 * What AMP is working on with a child and where they are, under their row:
 * the reasons behind their last problems, then the five areas with what
 * was checked below each and a way to the skills not asked yet. Before the
 * first answer, one line instead.
 */
export function ChildDashboard({
  child,
  board,
}: {
  child: FamilyChild;
  board: DashboardChild;
}) {
  const sheets = useSheetNav();
  if (!board.level)
    return (
      <p className={styles.notYet} data-child-not-started="">
        AMP finds {child.name}’s level in a few minutes of practice.
      </p>
    );
  const numbers = board.gradeLevelShown;
  const action = (row: AreaRow) => {
    const checked = row.checked;
    if (!checked) return null;
    if (!checked.notAsked)
      return <span className={styles.allAsked}>All asked</span>;
    return (
      <button
        type="button"
        className={styles.notAsked}
        data-not-asked={row.area}
        aria-label={`${row.title}: ${plural(checked.notAsked, "skill")} not asked yet. See them`}
        onClick={() => sheets.show(notAskedSheet(child.id, row.area))}
      >
        {checked.notAsked} not asked
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
        </svg>
      </button>
    );
  };
  return (
    <div className={styles.child}>
      <FocusMix
        answered={board.focus.answered}
        mix={board.focus.mix}
        label={
          board.focus.answered === 1
            ? "Last problem"
            : `Last ${board.focus.answered} problems`
        }
        skill={(skill) => (
          <EntityLink
            entity={{ kind: "skill", id: skill.id }}
            // This child's block: the skill, and what opens over it, offers
            // their practice, whoever was last selected on this device.
            with={{ for: child.id }}
            className={styles.skill}
          >
            {skill.title}
          </EntityLink>
        )}
      />
      <AreaRows
        areas={board.areas}
        overall={board.level}
        numbers={numbers}
        label={`${child.name}’s math areas`}
        checkedHead="Checked, two grades below"
        action={action}
        caption={`Levels from ${plural(board.level.answered, "answer")}. AMP started from ${child.name}’s birth year.`}
      />
      <SkillsByGrade child={child} />
    </div>
  );
}

/** One tap from a child's block to every skill of their own grade, with
 * where they stand on each: their Inventory, by grade (features/inventory).
 * One quiet link under their areas, the block's last line. */
function SkillsByGrade({ child }: { child: FamilyChild }) {
  const { family = "" } = useParams({ strict: false }) as { family?: string };
  if (!family || !child.capabilities.readProgress) return null;
  const path = childPath(family, child.id, "inventory");
  return (
    <Link
      to="/$"
      params={{ _splat: path.slice(1) }}
      className={`${styles.notAsked} ${styles.byGrade}`}
      aria-label={`${child.name}’s skills by grade`}
      data-skills-by-grade={child.id}
      // The address names the screen; its view opens on their own grade.
      onClick={() => showByGrade(path)}
    >
      Skills by grade
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="m4.5 2.5 3.5 3.5-3.5 3.5" />
      </svg>
    </Link>
  );
}

/**
 * The skills of one area AMP hasn't asked a child yet, nearest their level
 * first, each one tap from practice on this device (the child's own session,
 * held to that skill). Opened from an area's "not asked" over Today; the
 * sheet lives in the history entry (nav/sheet.ts).
 */
export function NotAskedSheet({
  dashboard,
  children,
  starting,
  onPractice,
}: {
  dashboard: FamilyDashboard | undefined;
  children: readonly FamilyChild[];
  starting: string | null;
  onPractice: (learnerId: string, filter: PracticeFilter) => void;
}) {
  const sheets = useSheetNav();
  const open = useRouterState({
    select: (state) => sheetOf(state.location.state),
  });
  const [kind, learner, area] = (open ?? "").split(":");
  const child = children.find((entry) => entry.id === learner);
  const board = dashboard?.children.find((entry) => entry.id === learner);
  const row: DashboardArea | undefined = board?.areas.find(
    (entry) => entry.area === area,
  );
  const shown = kind === "not-asked" && !!child && !!row?.checked;
  const checked = row?.checked;
  const name = notAskedSheet(learner ?? "", area ?? "");
  const canPractice =
    !!child?.capabilities.practiceHere && !!child.access.canPractice;
  const grades =
    checked && board?.gradeLevelShown
      ? gradeSpan(checked.from, checked.to)
      : null;
  return (
    <Sheet
      open={shown}
      onOpenChange={(next) => (next ? sheets.show(name) : sheets.close(name))}
      title={row ? `${row.title}: not asked yet` : "Not asked yet"}
      description={
        child && checked
          ? `${child.name}’s skills ${grades ? `in ${grades}` : "two grades below"} with no problem so far, nearest first.`
          : undefined
      }
    >
      {child && checked && (
        <div className={styles.sheet} data-not-asked-sheet="">
          <ul className={styles.skills}>
            {checked.nearestNotAsked.map((skill) => (
              <li key={skill.id} className={styles.skillRow}>
                <span>{skill.title}</span>
                {canPractice && (
                  <Button
                    variant="secondary"
                    aria-label={`Practice ${skill.title} with ${child.name}`}
                    aria-busy={starting === child.id || undefined}
                    disabled={starting !== null}
                    data-practice-skill={skill.id}
                    onClick={() => onPractice(child.id, { skill: skill.id })}
                  >
                    Practice
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {checked.notAsked > checked.nearestNotAsked.length && (
            <p className={styles.sheetNote}>
              The nearest {checked.nearestNotAsked.length} of {checked.notAsked}
              .
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** The family's week: every child's minutes each day, with the week's
 * totals. Nothing before the week's first practice. */
export function FamilyWeekSummary({
  dashboard,
  objectives,
}: {
  dashboard: FamilyDashboard;
  /** Skills earned this week, every child's (the projection's). */
  objectives: number;
}) {
  const days = new Map<string, { minutes: number; problems: number }>();
  let minutes = 0,
    problems = 0,
    correct = 0;
  for (const child of dashboard.children) {
    minutes += child.week.minutes;
    problems += child.week.problems;
    correct += child.week.correct;
    for (const day of child.daily) {
      const sum = days.get(day.day) ?? { minutes: 0, problems: 0 };
      sum.minutes += day.minutes;
      sum.problems += day.problems;
      days.set(day.day, sum);
    }
  }
  const time = practiceMinutes(minutes, problems);
  if (!time) return null;
  const right = percentRight(correct, problems);
  const practicedDays = [...days.values()].filter(
    (day) => day.minutes > 0 || day.problems > 0,
  ).length;
  return (
    <WeekSummary
      headingId="family-week"
      data-family-week=""
      facts={[
        { value: time, label: "practice" },
        { value: problems.toLocaleString("en-US"), label: "problems" },
        ...(right !== null ? [{ value: `${right}%`, label: "right" }] : []),
        ...(objectives > 0
          ? [
              {
                value: objectives.toLocaleString("en-US"),
                label: objectives === 1 ? "skill earned" : "skills earned",
              },
            ]
          : []),
      ]}
      // One day of practice is a fact, not a chart (ia.md rule 1).
      days={
        practicedDays > 1
          ? {
              from: dashboard.week.from,
              today: dashboard.today,
              daily: [...days].map(([day, sum]) => ({ day, ...sum })),
            }
          : undefined
      }
    />
  );
}

/**
 * How the children get in on a device of their own: the QR, the link with
 * Copy, and the family code, all in view. `more` opens the rest (printed
 * cards, a new code).
 */
export function GetIn({
  join,
  more,
  heading = "How your kids get in",
}: {
  join: NonNullable<FamilyDashboard["join"]>;
  more?: ReactNode;
  heading?: string;
}) {
  const link = `${location.origin}${join.path}`;
  const text = link.replace(/^https?:\/\//, "");
  return (
    <section
      aria-labelledby="family-get-in"
      className={styles.getIn}
      data-get-in=""
    >
      <h2 id="family-get-in">{heading}</h2>
      <div className={styles.getInBody}>
        <QrCode
          value={link}
          label={`QR code for ${text}`}
          className={styles.qr}
        />
        <div className={styles.getInWays}>
          <p className={styles.getInLead}>
            Scan it on their device, or open the link. They tap their name.
          </p>
          <p className={styles.link} data-join-link="">
            <span translate="no">{text}</span>
            <CopyButton
              text={link}
              label="Copy"
              copied="Copied"
              shareUrl={link}
            />
          </p>
          <p className={styles.code}>
            Family code{" "}
            <strong translate="no" data-family-code={join.code}>
              {join.code}
            </strong>
          </p>
          {more}
        </div>
      </div>
    </section>
  );
}

/**
 * Day 0 (docs/design/ia.md rule 7): before any child has answered, Today is
 * one centred column. The level scale every child will fill, one sentence,
 * each child with Practice, and how they get in on their own devices below.
 */
export function FamilyHero({
  single,
  children,
  getIn,
}: {
  /** The one child's name, when there is one. */
  single: string | null;
  /** The children's rows, each with Practice. */
  children: ReactNode;
  getIn: ReactNode;
}) {
  return (
    <section
      className={styles.hero}
      aria-labelledby="family-start"
      data-family-hero=""
    >
      <span className={styles.heroScale} aria-hidden="true">
        <LevelBar
          estimate={null}
          scale={{ lo: 0, hi: 12 }}
          size="large"
          moving
        />
      </span>
      <h2 id="family-start">
        {single ? `Where ${single} starts` : "Where your kids start"}
      </h2>
      <p className={styles.heroLead}>
        {single
          ? `AMP finds ${single}’s level in a few minutes of practice.`
          : "AMP finds each child’s level in a few minutes of practice."}
      </p>
      {children}
      {getIn}
    </section>
  );
}

/** The width every child's action takes, so their buttons line up. */
export const actionWidth = (children: readonly FamilyChild[]) =>
  ({
    "--learner-action": children.some(
      (child) =>
        !(child.capabilities.practiceHere && child.access.canPractice) &&
        child.capabilities.continuePurchase,
    )
      ? "11.5rem"
      : "8.5rem",
  }) as CSSProperties;
