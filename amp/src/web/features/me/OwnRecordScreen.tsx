import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { strandNames } from "../../BirthYearPrompt";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { currentSession } from "../school/api";
import { meOptions } from "../../lib/query";
import { learnerFrontierOptions } from "../../lib/learning-view";
import { freeLeft, freeProblemsLeft } from "../../lib/free-allowance";
import { AllowancePause } from "../continue/AllowancePause";
import { levelTrendOptions } from "../level/api";
import {
  LevelRange,
  LevelRangeStart,
  type LevelRangeArea,
} from "../../ui/level-range";
import { strandEstimate } from "../../../learning/frontier";
import "../school/SchoolFrame.module.css";
import {
  RecordObjectives,
  RecordWeeks,
  RecordWork,
} from "../school/classes/ProgressRecord";
import teacher from "../school/classes/Teacher.module.css";
import type { OwnPractice } from "../../../account/adult-contracts";
import type { Frontier } from "../pathways/model";
import { ownPracticeOptions } from "./api";
import styles from "./Own.module.css";

/** The adult's own place, under the app frame's bar (logo, the Progress tabs
 * and Practice). The record reads in the teacher's dense styles, whose
 * element resets come with the school frame's stylesheet. */
function OwnPage({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page} data-dense>
      {children}
    </main>
  );
}

/** The areas they have practiced, in the curriculum's order, then any the
 * catalog adds later. */
function levelAreas(frontier: Frontier, data: OwnPractice): LevelRangeArea[] {
  const known = Object.keys(strandNames);
  const label = (id: string) =>
    strandNames[id] ??
    data.record.strands.find((strand) => strand.id === id)?.label ??
    id;
  return [
    ...known,
    ...Object.keys(frontier.strands).filter((id) => !known.includes(id)),
  ]
    .filter((id) => (frontier.strands[id]?.answered ?? 0) > 0)
    .map((id) => ({
      id,
      label: label(id),
      estimate: strandEstimate(frontier, id),
    }));
}

/** `/me`: the adult's own practice, mathematics first. Their level leads the
 * page; the free count, workbooks, the report and practicing as someone else
 * are quiet controls under it; their time and work follow once there is
 * some. Nothing here names them: it is their own place. */
export function OwnRecordScreen() {
  const session = currentSession();
  const record = useQuery(ownPracticeOptions(session));
  const data = record.data;
  const me = useQuery(meOptions(session)).data;
  const learnerId = data?.learner.id ?? "";
  const frontier = useQuery({
    ...learnerFrontierOptions(session, learnerId),
    enabled: !!data,
  });
  const answered = frontier.data?.overall.answered ?? 0;
  const trend = useQuery({
    ...levelTrendOptions(session, learnerId),
    enabled: !!data && answered > 0,
  });
  // Their free allowance, from the account's one store (`/me`).
  const own = me?.signedIn
    ? me.family.learners.find(
        (entry) => entry.adult && !entry.simulation && !entry.deletedAt,
      )
    : undefined;
  const left = freeLeft(own);
  if (record.isPending || (data && frontier.isPending))
    return (
      <OwnPage>
        <Loading />
      </OwnPage>
    );
  if (!data || frontier.isError)
    return (
      <OwnPage>
        <EmptyState
          title="Your progress didn’t load"
          action={
            <Button
              variant="primary"
              onClick={() => {
                void record.refetch();
                void frontier.refetch();
              }}
            >
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      </OwnPage>
    );
  const level = frontier.data!;
  const started = level.overall.answered > 0;
  const shown = activityShown(data);
  const practice = data.learner.active ? (
    <Link
      to="/$"
      params={{ _splat: "practice" }}
      className={buttonClass("primary", styles.practice)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
      </svg>
      {started ? "Practice" : "Start practicing"}
    </Link>
  ) : undefined;
  return (
    <OwnPage>
      <div className={styles.stack}>
        {/* The title names the content; the rare actions sit quietly on its
            row (docs/design/ia.md). Practicing as someone else is in the
            drawer, under My practice. */}
        <header className={styles.titleRow}>
          <h1 id="me-title">Where you are</h1>
          <div className={styles.toolActions} data-own-tools>
            {left != null && left > 0 && (
              <span className={styles.free} data-free-left={left}>
                {freeProblemsLeft(left)}
              </span>
            )}
            <Link
              to="/learners/$learnerId/workbooks"
              params={{ learnerId: data.learner.id }}
              className={buttonClass("quiet", styles.quiet)}
            >
              <BookIcon />
              Workbooks
            </Link>
          </div>
        </header>
        {/* Paused only when no access covers them and their free problems
            are used: the one pause, with Continue with AMP for their own
            practice. */}
        {!data.learner.active && (
          <AllowancePause
            kind="problems"
            viewer="adult"
            learner={{ id: data.learner.id, name: data.learner.name }}
            compact
          />
        )}
        {started ? (
          <LevelRange
            title={null}
            labelledBy="me-title"
            overall={level.overall}
            answered={level.overall.answered}
            areas={levelAreas(level, data)}
            path={trend.data ?? null}
            pathState={
              trend.isError ? "failed" : trend.data ? "ready" : "loading"
            }
            action={practice}
          />
        ) : (
          <LevelRangeStart
            title={null}
            labelledBy="me-title"
            start={level.overall}
            action={practice}
          />
        )}
        {/* Their time and work, each part only once it has something to
            say. Never an empty chart. */}
        {shown.week && (
          <section className={teacher.recordSection} data-this-week>
            <h2>This week</h2>
            <p className={styles.weekLine}>{shown.week}</p>
            {shown.weeks && <RecordWeeks record={data.record} />}
          </section>
        )}
        {shown.objectives && (
          <section className={teacher.recordSection}>
            <h2>Objectives gained</h2>
            <RecordObjectives record={data.record} />
          </section>
        )}
        {shown.work && (
          <section className={teacher.recordSection}>
            <h2>Recent work</h2>
            <RecordWork record={data.record} reader="self" />
          </section>
        )}
      </div>
    </OwnPage>
  );
}

/** Which parts of their time and work have something to show: this week as
 * one line (with the 12-week strip once two weeks have time), objectives
 * once one is gained, recent work once there is some. */
export function activityShown(data: Pick<OwnPractice, "record" | "time">) {
  const thisWeek = data.record.weeks.at(-1);
  const days = data.time.days.filter(
    (day) => !thisWeek || day.day >= thisWeek.week,
  );
  const minutes = Math.round(days.reduce((sum, day) => sum + day.minutes, 0));
  const problems = days.reduce((sum, day) => sum + day.problems, 0);
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  return {
    week:
      minutes > 0 || problems > 0
        ? [
            count(minutes, "minute", "minutes"),
            count(days.length, "day", "days"),
            count(problems, "problem", "problems"),
          ].join(" · ")
        : null,
    weeks: data.record.weeks.filter((week) => week.minutes > 0).length >= 2,
    objectives: data.record.objectives.length > 0,
    work: data.record.work.length > 0,
  };
}

function BookIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.icon}>
      <path d="M3.5 4.5c2.2-.9 4.4-.9 6.5.6 2.1-1.5 4.3-1.5 6.5-.6v11c-2.2-.9-4.4-.9-6.5.6-2.1-1.5-4.3-1.5-6.5-.6z" />
      <path d="M10 5.1v11" />
    </svg>
  );
}
