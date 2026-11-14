import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { strandNames } from "../../BirthYearPrompt";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
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
  areaRowLink,
  RecordObjectives,
  RecordWork,
} from "../school/classes/ProgressRecord";
import { LayerHost } from "../../nav/LayerHost";
import type { AreaSource } from "../../nav/AreaLayer";
import { skillCatalogOptions } from "../../lib/learning-view";
import { PrintButton } from "../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../lib/pdf-download";
import teacher from "../school/classes/Teacher.module.css";
import type { OwnPractice } from "../../../account/adult-contracts";
import type { Frontier } from "../pathways/model";
import { ownPracticeOptions } from "./api";
import { useHeroAction } from "../../lib/shell-slots";
import {
  useCurriculumDetails,
  useCurriculumPreferences,
} from "../curriculum/CurriculumDetails";
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
  // Recent work opens each answer's skill, by the catalog's titles.
  const catalog = useQuery(skillCatalogOptions);
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
  // An adult always sees their levels by name; the working level's decimals
  // only when they have switched grade numbers on for this device.
  const { scope } = useCurriculumDetails();
  const numbersShown = useCurriculumPreferences(
    (state) => state.shown[scope] === true,
  );
  if (record.isPending || (data && frontier.isPending))
    return (
      <OwnPage>
        <LoadingScreen overlay />
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
  // Before the first answer the page's own Start practicing is the one
  // Practice; after, the bar's is (one per screen).
  const hero = !started && data.learner.active;
  const freeLine = left != null && left > 0 && (
    <span className={styles.free} data-free-left={left}>
      {freeProblemsLeft(left)}
    </span>
  );
  const pause = !data.learner.active && (
    // Paused only when no access covers them and their free problems are
    // used: the one pause, with Continue with AMP for their own practice.
    <AllowancePause
      kind="problems"
      viewer="adult"
      learner={{ id: data.learner.id, name: data.learner.name }}
      compact
    />
  );
  // Day 0 (docs/design/ia.md, rule 7): one centred hero, its Start practicing
  // the only Practice on screen.
  if (!started)
    return (
      <OwnPage>
        <HeroAction active={hero} />
        <div className={styles.stack} data-own-page>
          {pause}
          <LevelRangeStart
            title="Where you are"
            heading={1}
            action={
              hero ? (
                <Link
                  to="/$"
                  params={{ _splat: "practice" }}
                  className={buttonClass("primary", styles.start)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
                  </svg>
                  Start practicing
                </Link>
              ) : undefined
            }
            secondary={
              <>
                {freeLine}
                <AtALevel />
              </>
            }
          />
        </div>
      </OwnPage>
    );
  const areas = levelAreas(level, data);
  const area: AreaSource = {
    overall: level.overall,
    areas,
    objectives: data.record.objectives,
    path: trend.data ?? null,
    practice: data.learner.active,
  };
  // An answer's skill, by its title in the catalog; a title two skills share
  // opens neither.
  const skillOf = new Map<string, string | null>();
  for (const skill of catalog.data?.skills ?? [])
    skillOf.set(skill.title, skillOf.has(skill.title) ? null : skill.id);
  return (
    <OwnPage>
      <div className={styles.stack} data-own-page data-wide="">
        {/* The title, then one quiet line: this week (opening their time)
            and the free problems left. Practicing at a level and the
            printed report sit beside the title; the bar holds the one
            Practice. */}
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h1 id="me-title">Where you are</h1>
            <div className={styles.titleTools}>
              <AtALevel />
              <PrintButton
                variant="quiet"
                download={() =>
                  downloadPdf({
                    path: `/me/practice/report.pdf?format=${paperFormat()}`,
                    token: session.token,
                    name: "amp-progress-report.pdf",
                  })
                }
              >
                Progress report
              </PrintButton>
            </div>
          </div>
          <p className={styles.meta}>
            <Link to="/me/time" className={styles.weekLink} data-this-week="">
              {shown.week ? (
                <>
                  <span className={styles.weekLabel}>This week</span>
                  {` · ${shown.week}`}
                </>
              ) : (
                <span className={styles.weekLabel}>Time, by week</span>
              )}
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </Link>
            {freeLine}
          </p>
        </header>
        {pause}
        <LevelRange
          title={null}
          labelledBy="me-title"
          overall={level.overall}
          answered={level.overall.answered}
          areas={areas}
          path={trend.data ?? null}
          pathState={
            trend.isError ? "failed" : trend.data ? "ready" : "loading"
          }
          decimals={numbersShown}
          rowLink={areaRowLink}
        />
        {shown.objectives && (
          <section className={teacher.recordSection}>
            <h2>Skills shown on their own</h2>
            <RecordObjectives record={data.record} openSkills />
          </section>
        )}
        {shown.work && (
          <section className={teacher.recordSection}>
            <h2>Recent work</h2>
            <RecordWork
              record={data.record}
              reader="self"
              // No replay of one's own answer exists yet (the replay is a
              // staff read): a row opens its skill, with the latest answers
              // on it.
              workPath={(_attempt, item) => {
                const id = skillOf.get(item.skill);
                return id ? { kind: "skill", id } : undefined;
              }}
            />
          </section>
        )}
      </div>
      {/* Details over the page (?open=): an area of the level, a skill. */}
      <LayerHost learner={data.learner.id} area={area} />
    </OwnPage>
  );
}

/** Practicing at a level (`/me/level`): a grade and a pace, then the main
 * loop there. One quiet link, the same on day 0 and after. */
function AtALevel() {
  return (
    <Link
      to="/$"
      params={{ _splat: "me/level" }}
      className={styles.quietLink}
      data-at-a-level=""
    >
      Practice at a level
    </Link>
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
            // A day of answers too quick to count as minutes says no
            // "0 min".
            ...(minutes > 0 ? [`${minutes} min`] : []),
            count(days.length, "day", "days"),
            count(problems, "problem", "problems"),
          ].join(" · ")
        : null,
    weeks: data.record.weeks.filter((week) => week.minutes > 0).length >= 2,
    objectives: data.record.objectives.length > 0,
    work: data.record.work.length > 0,
  };
}

/** Marks the bar's Practice as stood in for while `active`. */
function HeroAction({ active }: { active: boolean }) {
  useHeroAction(active);
  return null;
}
