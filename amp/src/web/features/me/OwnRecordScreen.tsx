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
  TimeDetail,
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
  const tryLevel = (
    <Link
      to="/$"
      params={{ _splat: "me/profiles/new" }}
      className={buttonClass("quiet", styles.quiet)}
      data-try-level
    >
      <PersonIcon />
      Practice as someone else
    </Link>
  );
  return (
    <OwnPage>
      <div className={styles.stack}>
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
          <LevelRangeStart start={level.overall} action={practice} />
        )}
        <div className={styles.tools} data-own-tools>
          {/* Early on, what they did, in one line instead of a chart; and
              the free problems left, quietly. */}
          <p className={styles.free}>
            {shown.line && <span data-activity-line>{shown.line}</span>}
            {left != null && left > 0 && (
              <span data-free-left={left}>{freeProblemsLeft(left)}</span>
            )}
          </p>
          <div className={styles.toolActions}>
            {/* Practice is the bar's action; workbooks are theirs here. */}
            <Link
              to="/learners/$learnerId/workbooks"
              params={{ learnerId: data.learner.id }}
              className={buttonClass("quiet", styles.quiet)}
            >
              <BookIcon />
              Workbooks
            </Link>
            {started && (
              <Button
                variant="quiet"
                className={styles.quiet}
                onClick={() => window.print()}
              >
                <PrintIcon />
                Print progress report
              </Button>
            )}
            {tryLevel}
          </div>
        </div>
        {/* Their time and work, each part only once it has enough to say.
            Never an empty chart. */}
        {(shown.weeks || shown.days || shown.objectives || shown.work) && (
          <div className={styles.record}>
            {shown.weeks && (
              <section className={teacher.recordSection}>
                <h2>Time, last 12 weeks</h2>
                <RecordWeeks record={data.record} />
              </section>
            )}
            {shown.days && (
              <section className={teacher.recordSection}>
                <h2>Time by day and skill</h2>
                <div className={teacher.evidence}>
                  <TimeDetail time={data.time} who="You" />
                </div>
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
        )}
      </div>
    </OwnPage>
  );
}

/** Practice settled enough for charts: three days and half an hour. */
const SETTLED_DAYS = 3;
const SETTLED_MINUTES = 30;
/** Weeks with time before the 12-week chart has a shape. */
const WEEKS_FOR_CHART = 3;

/** Which parts of their time and work have enough to show. Early on, one
 * compact line says what they did; each chart joins once it has a shape. */
export function activityShown(data: Pick<OwnPractice, "record" | "time">) {
  const minutes = Math.round(
    data.time.days.reduce((sum, day) => sum + day.minutes, 0),
  );
  const problems = data.time.days.reduce((sum, day) => sum + day.problems, 0);
  const today = data.time.days.find((day) => day.day === data.time.range.to);
  const settled =
    data.time.days.length >= SETTLED_DAYS && minutes >= SETTLED_MINUTES;
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const line =
    settled || (!minutes && !problems)
      ? null
      : today && (today.minutes > 0 || today.problems > 0)
        ? `${count(Math.round(today.minutes), "minute", "minutes")} today · ${count(today.problems, "problem", "problems")}`
        : `${count(minutes, "minute", "minutes")} · ${count(problems, "problem", "problems")} so far`;
  return {
    line,
    weeks:
      settled &&
      data.record.weeks.filter((week) => week.minutes > 0).length >=
        WEEKS_FOR_CHART,
    days: settled,
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
function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.icon}>
      <path d="M6 7.5V3.5h8v4" />
      <rect x="3" y="7.5" width="14" height="7" rx="2" />
      <path d="M6 12.5h8v4H6z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.icon}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M4 16.5c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6" />
    </svg>
  );
}
