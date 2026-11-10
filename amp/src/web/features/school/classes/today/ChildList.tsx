import { Link, useRouterState } from "@tanstack/react-router";
import type { SignedInMe } from "../../../../../account/contracts";
import type { TodayStudentResource } from "../../../../../schools/teacher-contracts";
import type { AuthSession } from "../../../../auth";
import { buttonClass } from "../../../../ui/Button";
import { EmptyState } from "../../../../ui/EmptyState";
import { Toast } from "../../../../ui/Toast";
import { rememberContinuation } from "../../../continue/memory";
import { ChildRow } from "./ChildRow";
import styles from "./Today.module.css";
import { useHandOver } from "./use-hand-over";

/** The family's children on Today, one row each, matched to the reader's own
 * learners for access and "Practice here". The holder and the second parent
 * hand this device over; a co-teacher sees the rows alone. */
export function ChildList({
  students,
  session,
  me,
  classId,
}: {
  students: readonly TodayStudentResource[];
  session: AuthSession;
  me: SignedInMe | undefined;
  classId: string;
}) {
  const here = useRouterState({
    select: (state) => state.location.pathname + state.location.searchStr,
  });
  const { starting, error, clearError, handOver } = useHandOver(session);
  const holder = me?.familyClass?.classId === classId;
  const learners = holder
    ? me!.learners
    : (me?.secondParentOf?.find((entry) => entry.classId === classId)
        ?.learners ?? []);
  const byId = new Map(learners.map((learner) => [learner.id, learner]));
  if (!students.length)
    return holder ? (
      <EmptyState
        title="Add your children"
        action={
          <Link
            to="/$"
            params={{ _splat: "family/learners" }}
            className={buttonClass("primary")}
          >
            Add a child
          </Link>
        }
      >
        Each child gets a row here with their level, today’s work and a way to
        practice on this device.
      </EmptyState>
    ) : null;
  const fresh = students.every((student) => !student.level);
  return (
    <section aria-labelledby="today-children">
      <h2 id="today-children" className={styles.sectionTitle}>
        Children
      </h2>
      {fresh && (
        <p className={styles.lead}>
          Levels, today’s work and the week fill in as they practice.
        </p>
      )}
      <ul className={styles.children}>
        {students.map((student) => (
          <ChildRow
            key={student.id}
            student={student}
            learner={
              student.learnerId ? byId.get(student.learnerId) : undefined
            }
            holder={holder}
            starting={starting}
            onPracticeHere={(learnerId) => void handOver(learnerId)}
            onContinue={(learnerId) =>
              rememberContinuation({
                accountId: session.accountId,
                learnerId,
                returnTo: here,
              })
            }
          />
        ))}
      </ul>
      <Toast message={error} onDismiss={clearError} />
    </section>
  );
}
