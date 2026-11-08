import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AdultStart } from "../../../learning/starting-point";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { currentSession } from "../school/api";
import "../school/SchoolFrame.module.css";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
  TimeDetail,
} from "../school/classes/ProgressRecord";
import teacher from "../school/classes/Teacher.module.css";
import { ownPracticeOptions } from "./api";
import styles from "./Own.module.css";

const startNames: Record<AdultStart, string> = {
  counting: "Counting",
  elementary: "Elementary",
  "middle-school": "Middle school",
  "algebra-1": "Algebra",
  geometry: "Geometry",
  "algebra-2": "Algebra 2",
  precalculus: "Precalculus",
};

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

/** `/me`: the student record a teacher reads, pointed at the adult. */
export function OwnRecordScreen() {
  const session = currentSession();
  const record = useQuery(ownPracticeOptions(session));
  const data = record.data;
  return (
    <OwnPage>
      {record.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title="Your progress didn’t load"
          action={
            <Button variant="primary" onClick={() => void record.refetch()}>
              Try again
            </Button>
          }
        >
          Check your connection, then try again.
        </EmptyState>
      ) : (
        <div className={teacher.record}>
          <div className={teacher.recordHead}>
            <Avatar name={data.learner.name} size="large" />
            <div className={teacher.recordTitle}>
              <h1>{data.learner.name}</h1>
              <p>
                {data.learner.start
                  ? `Began at ${startNames[data.learner.start]}`
                  : "Your own practice"}
              </p>
            </div>
            <div className={teacher.recordAction}>
              {/* Practice is the bar's action; workbooks are theirs here. */}
              {data.learner.active ? (
                <Link
                  to="/$"
                  params={{
                    _splat: `learners/${data.learner.id}/workbooks`,
                  }}
                  className={buttonClass("secondary")}
                >
                  Workbooks
                </Link>
              ) : (
                <Badge>Practice paused</Badge>
              )}
              <Button variant="secondary" onClick={() => window.print()}>
                Print progress report
              </Button>
            </div>
          </div>
          {!data.learner.active && (
            <p className={styles.paused}>
              Your own practice is free while you teach a class at a school with
              AMP, or while a child of yours practices. Your progress stays
              here.
            </p>
          )}
          <div className={teacher.recordColumns}>
            <section className={teacher.recordSection}>
              <h2>Where you are</h2>
              <RecordLevels
                record={data.record}
                empty="Your levels appear here after your first problems."
              />
            </section>
            <section className={teacher.recordSection}>
              <h2>Time, last 12 weeks</h2>
              <RecordWeeks record={data.record} />
            </section>
            <section className={teacher.recordSection}>
              <h2>Time by day and skill</h2>
              <div className={teacher.evidence}>
                <TimeDetail time={data.time} who={data.learner.name} />
              </div>
            </section>
            <section className={teacher.recordSection}>
              <h2>Objectives gained</h2>
              <RecordObjectives record={data.record} />
            </section>
            <section className={teacher.recordSection}>
              <h2>Recent work</h2>
              <RecordWork record={data.record} />
            </section>
          </div>
        </div>
      )}
    </OwnPage>
  );
}
