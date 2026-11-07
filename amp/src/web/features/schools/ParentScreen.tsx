import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { levelRange } from "../../../learning/level-check";
import type { ParentView } from "../../../schools/share-contracts";
import { shareToken, takeShareFragment } from "../../share-entry";
import { Button } from "../../ui/Button";
import { LevelAxis, levelScale, LevelTrack } from "../../ui/LevelChart";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { WaveMark } from "../../ui/NavigationSheet";
import { LinkEnded, readParentView } from "./api";
import styles from "./Parent.module.css";

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const gradeName = (level: number) =>
  level <= 0 ? "K" : `${Math.round(level)}`;
const hours = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const whole = Math.floor(minutes / 60);
  const rest = minutes - whole * 60;
  return rest ? `${whole} hr ${rest} min` : `${whole} hr`;
};

function Calm({
  title,
  children,
  action,
}: {
  title: string;
  children: string;
  action?: React.ReactNode;
}) {
  return (
    <main className={styles.calm}>
      <span className={styles.mark}>
        <WaveMark />
      </span>
      <h1>{title}</h1>
      <p>{children}</p>
      {action}
    </main>
  );
}
const Ended = () => (
  <Calm title="Ask the school for a new link">
    This progress link isn’t active anymore. The school can give you a new one.
  </Calm>
);

function Levels({ view }: { view: ParentView }) {
  const { level, reference } = view;
  if (!level)
    return (
      <p className={styles.quiet}>
        This fills in once {view.student.first} has done some work.
      </p>
    );
  const center = reference
    ? (reference.from + reference.to) / 2
    : level.overall.level;
  const scale = levelScale(center, [
    level.overall,
    ...Object.values(level.strands),
  ]);
  const row = (id: string, label: string, strand?: string) => {
    const estimate = strand ? level.strands[strand]! : level.overall;
    const [from, to] = levelRange(estimate);
    return (
      <li key={id} className={styles.levelRow} data-strand={strand}>
        <span className={styles.levelName}>{label}</span>
        <span
          className={styles.levelTrack}
          role="img"
          aria-label={`${label}: likely grade ${from.toFixed(1)} to ${to.toFixed(1)}`}
        >
          <LevelTrack
            estimate={estimate}
            scale={scale}
            reference={!!reference}
          />
        </span>
        <span className={styles.levelNumbers}>
          {from.toFixed(1)}–{to.toFixed(1)}
        </span>
      </li>
    );
  };
  return (
    <>
      <ul className={styles.levels}>
        {row("overall", "Overall")}
        {view.strands.map((strand) => row(strand.id, strand.label, strand.id))}
      </ul>
      <div className={styles.axisRow} aria-hidden="true">
        <span className={styles.axisLabel}>Grade</span>
        <LevelAxis scale={scale} name={gradeName} reference={!!reference} />
      </div>
      <p className={styles.key}>
        Each band is the likely grade level in that area of math, and the dot is
        the best estimate.
        {reference ? ` The tick marks grade ${gradeName(center)}.` : ""}
      </p>
    </>
  );
}

function Progress({ view }: { view: ParentView }) {
  const { student, schoolName, classes, term, objectives, grades } = view;
  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <p className={styles.school}>{schoolName}</p>
        <h1>{student.name}</h1>
        <p className={styles.classes}>{classes.join(", ")}</p>
      </div>
      <section className={styles.section} aria-labelledby="family-where">
        <h2 id="family-where">Where {student.first} is</h2>
        <Levels view={view} />
      </section>
      {term && (
        <section className={styles.section} aria-labelledby="family-term">
          <h2 id="family-term">{term.name}, so far</h2>
          <dl className={styles.stats}>
            <div>
              <dt>Active time</dt>
              <dd>{hours(term.activeMinutes)}</dd>
            </div>
            <div>
              <dt>Objectives gained</dt>
              <dd>{term.objectives}</dd>
            </div>
          </dl>
        </section>
      )}
      <section className={styles.section} aria-labelledby="family-recent">
        <h2 id="family-recent">Recent objectives</h2>
        {objectives.length ? (
          <ul className={styles.objectives}>
            {objectives.map((objective) => (
              <li
                key={`${objective.day}:${objective.title}`}
                data-strand={objective.strand}
              >
                <span className={styles.when}>{shortDay(objective.day)}</span>
                <span className={styles.dot} aria-hidden="true" />
                <span>{objective.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>
            New objectives show here as {student.first} shows them.
          </p>
        )}
      </section>
      {grades.length > 0 && (
        <section className={styles.section} aria-labelledby="family-grades">
          <h2 id="family-grades">Final grades</h2>
          <ul className={styles.grades}>
            {grades.map((grade) => (
              <li key={`${grade.className}:${grade.termName}`}>
                <span>
                  {grade.className}, {grade.termName}
                </span>
                <strong>{grade.final}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.note}>
        Shared by {schoolName}. Questions go to the school.
      </p>
    </main>
  );
}

/** `/p`: one student's progress, for their family. It has no navigation and no
 * analytics, and it reads the link it was opened with on every load. */
export function ParentScreen() {
  const [token, setToken] = useState(() => shareToken());
  // Another family's link, opened in this same tab.
  useEffect(() => {
    const changed = () => {
      takeShareFragment();
      setToken(shareToken());
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const view = useQuery({
    queryKey: ["family-link", token],
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => readParentView(token!),
  });
  if (!token) return <Ended />;
  if (view.isPending) return <LoadingScreen />;
  if (view.data) return <Progress view={view.data} />;
  if (view.error instanceof LinkEnded) return <Ended />;
  return (
    <Calm
      title="This page didn’t load"
      action={
        <Button
          variant="primary"
          aria-busy={view.isFetching}
          onClick={() => void view.refetch()}
        >
          Try again
        </Button>
      }
    >
      Check your connection and try again.
    </Calm>
  );
}
