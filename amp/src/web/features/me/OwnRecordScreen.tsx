import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AdultStart } from "../../../learning/starting-point";
import { meOptions } from "../../lib/query";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { currentSession } from "../school/api";
import { AccountMenu } from "../school/OrgFrame";
import { SchoolFrame, type SchoolNavItem } from "../school/SchoolFrame";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
  TimeDetail,
} from "../school/classes/ProgressRecord";
import { PlaceSwitcher, placeEntries } from "../navigation/PlaceSwitcher";
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

/** The adult's own place: their record, practice, pathways and workbooks, in
 * the same frame a teacher works in, with the switcher to their other places. */
export function OwnFrame({ children }: { children: ReactNode }) {
  const session = currentSession();
  const me = useQuery(meOptions(session)).data;
  const account = me?.signedIn ? me : null;
  const own = account?.adultPractice?.learner;
  const items: SchoolNavItem[] = [
    ...(own?.active
      ? [{ id: "practice", label: "Practice", path: "practice" }]
      : []),
    { id: "progress", label: "My progress", path: "me" },
    { id: "pathways", label: "Pathways", path: "pathways" },
    ...(own?.active
      ? [
          {
            id: "workbooks",
            label: "Workbooks",
            path: `learners/${own.id}/workbooks`,
          },
        ]
      : []),
  ];
  return (
    <SchoolFrame
      title="My practice"
      brand={null}
      navLabel="My practice"
      orgSwitcher={
        account && placeEntries(account).length > 1 ? (
          <PlaceSwitcher me={account} current="me" />
        ) : undefined
      }
      sections={[{ items }]}
      activeNav="progress"
      account={<AccountMenu />}
    >
      {children}
    </SchoolFrame>
  );
}

/** `/me`: the student record a teacher reads, pointed at the adult. */
export function OwnRecordScreen() {
  const session = currentSession();
  const record = useQuery(ownPracticeOptions(session));
  const data = record.data;
  return (
    <OwnFrame>
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
              {data.learner.active ? (
                <Link
                  to="/$"
                  params={{ _splat: "practice" }}
                  className={buttonClass("primary")}
                >
                  Practice
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
    </OwnFrame>
  );
}
