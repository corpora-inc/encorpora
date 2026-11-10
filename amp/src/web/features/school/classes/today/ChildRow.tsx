import { Link } from "@tanstack/react-router";
import type { SignedInMe } from "../../../../../account/contracts";
import { levelRange } from "../../../../../learning/level-check";
import type { TodayStudentResource } from "../../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../../ui/Button";
import { LevelTrack, levelScale } from "../../../../ui/LevelChart";
import { gradeLabel } from "../../parts";
import styles from "./Today.module.css";

type Learner = SignedInMe["learners"][number];
/** Before any work, a wide dashed band around their grade. */
const UNKNOWN_SD = 0.9;
const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const one = (value: number) => value.toFixed(1);

/** One value and what it counts, stacked: "12 min" over "18 problems today". */
function Fact({ value, label }: { value: string; label: string }) {
  return (
    <span className={styles.fact}>
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </span>
  );
}

/** Where a child works: a band for the likely range with a dot for the best
 * guess, the tick at their own grade. With too little work, dashed. */
function ChildLevel({ student }: { student: TodayStudentResource }) {
  const known = student.level && !student.provisional ? student.level : null;
  const grade = student.gradeLevel;
  const estimate = student.level ?? {
    level: grade ?? 5,
    sd: UNKNOWN_SD,
  };
  const scale = levelScale(grade ?? estimate.level, [estimate]);
  const [from, to] = levelRange(estimate);
  return (
    <span className={styles.level}>
      <LevelTrack
        estimate={estimate}
        scale={scale}
        estimated={!known}
        reference={grade !== null}
      />
      <span className={styles.factLabel}>
        {known
          ? `Likely grade ${one(from)} to ${one(to)}`
          : "Not enough work yet"}
      </span>
    </span>
  );
}

/** Access in a few words: dates once paid for, else the free problems. */
function access(learner: Learner): { value: string; label: string } | null {
  if (learner.entitlement.licensed && learner.entitlement.endsAt)
    return {
      value: DAY.format(new Date(learner.entitlement.endsAt)),
      label: "access through",
    };
  const left = learner.freeAllowance?.problems.remaining;
  if (left === undefined) return null;
  return {
    value: String(left),
    label: left === 1 ? "free problem left" : "free problems left",
  };
}

/** A child on the family's Today: their level, today's work, their access and
 * the one thing to do (practice here, or continue once the free problems are
 * used). A child from another family has no actions here. */
export function ChildRow({
  student,
  learner,
  holder,
  starting,
  onPracticeHere,
  onContinue,
}: {
  student: TodayStudentResource;
  /** This reader's own child (or, for the second parent, the family's). */
  learner?: Learner;
  /** The family's account holder, who alone buys access. */
  holder: boolean;
  /** The child whose practice is starting on this device. */
  starting: string | null;
  onPracticeHere: (learnerId: string) => void;
  onContinue: (learnerId: string) => void;
}) {
  const worked = student.todayMinutes > 0 || student.todayProblems > 0;
  const status = learner ? access(learner) : null;
  // The name the class shows everywhere, as the API gives it.
  const name = student.name;
  return (
    <li className={styles.child} data-child={student.id}>
      <span className={styles.childName}>
        <span className={styles.name}>{name}</span>
        <span className={styles.factLabel}>
          {student.gradeLevel === null
            ? "Grade not set"
            : student.gradeLevel === 0
              ? "Kindergarten"
              : `Grade ${gradeLabel(student.gradeLevel)}`}
        </span>
      </span>
      <ChildLevel student={student} />
      <span className={styles.facts}>
        {!worked && student.weekMinutes <= 0 && student.weekProblems <= 0 ? (
          // Nothing yet this week: one fact, not two "Not yet"s.
          <span className={styles.factWide}>
            <Fact value="No practice yet" label="this week" />
          </span>
        ) : (
          <>
            {worked ? (
              <Fact
                value={`${student.todayMinutes} min`}
                label={`${student.todayProblems} ${student.todayProblems === 1 ? "problem" : "problems"} today`}
              />
            ) : (
              <Fact value="Not yet" label="today" />
            )}
            <Fact value={`${student.weekMinutes} min`} label="this week" />
          </>
        )}
        {status ? <Fact value={status.value} label={status.label} /> : <span />}
      </span>
      <span className={styles.childAction}>
        {!learner ? null : learner.entitlement.active ? (
          <Button
            variant="secondary"
            className={styles.compactAction}
            aria-label={`Let ${name} practice here`}
            aria-busy={starting === learner.id || undefined}
            disabled={starting !== null && starting !== learner.id}
            onClick={() => onPracticeHere(learner.id)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
            </svg>
            Practice here
          </Button>
        ) : holder ? (
          <Link
            to="/continue/$learnerId"
            params={{ learnerId: learner.id }}
            className={buttonClass("primary", styles.compactAction)}
            onClick={() => onContinue(learner.id)}
          >
            Continue with AMP
          </Link>
        ) : null}
      </span>
    </li>
  );
}
