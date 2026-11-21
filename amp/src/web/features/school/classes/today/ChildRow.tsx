import { Link } from "@tanstack/react-router";
import {
  lastPracticed,
  QUIET_WEEK,
  weekFigure,
} from "../../../learners/week-words";
// Moved to features/learners; kept here for the screens not yet moved.
export { lastPracticed, QUIET_WEEK, weekFigure };
import type { SignedInMe } from "../../../../../account/contracts";
import type { TodayStudentResource } from "../../../../../schools/teacher-contracts";
import { Button, buttonClass } from "../../../../ui/Button";
import styles from "./Today.module.css";
import { PayLink } from "../../../pay/link";

type Learner = SignedInMe["learners"][number];
/** One value over what it counts. */
function Fact({ value, label }: { value: string; label: string }) {
  return (
    <span className={styles.fact}>
      <span className={styles.factValue}>{value}</span>
      <span className={styles.factLabel}>{label}</span>
    </span>
  );
}

/** "Let Sam practice here": the child's own session on this device, straight
 * into practice (docs/families.md). Compact, wherever it appears. */
export function PracticeHere({
  learnerId,
  name,
  starting,
  primary = false,
  onPracticeHere,
}: {
  learnerId: string;
  name: string;
  starting: string | null;
  primary?: boolean;
  onPracticeHere: (learnerId: string) => void;
}) {
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      className={styles.practiceHere}
      aria-busy={starting === learnerId || undefined}
      disabled={starting !== null && starting !== learnerId}
      onClick={() => onPracticeHere(learnerId)}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 2.8v10.4L13 8 4.5 2.8Z" />
      </svg>
      Let {name} practice here
    </Button>
  );
}

/** A child on the family's Today, on one line: their week, when they last
 * practiced, and the one action that works now (docs/design/ia.md). Levels
 * are the Map's; access dates are Billing's. */
export function ChildRow({
  student,
  today,
  learner,
  holder,
  starting,
  onPracticeHere,
  onContinue,
}: {
  student: TodayStudentResource;
  /** Today in the class's zone. */
  today: string;
  /** This reader's own child (or, for the second parent, the family's). */
  learner?: Learner;
  /** The family's account holder, who alone buys access. */
  holder: boolean;
  starting: string | null;
  onPracticeHere: (learnerId: string) => void;
  onContinue: (learnerId: string) => void;
}) {
  const name = student.name;
  const figure = weekFigure(student.weekMinutes, student.weekProblems);
  return (
    <li className={styles.child} data-child={student.id}>
      <span className={styles.name}>{name}</span>
      <span className={styles.facts}>
        {!student.lastActive ? (
          <span className={styles.factWide}>
            <Fact value="Not started" label="no practice yet" />
          </span>
        ) : (
          <>
            {figure ? (
              <Fact value={figure.value} label={figure.label} />
            ) : (
              <span className={styles.fact} data-week-quiet="">
                <span className={styles.factLabel}>{QUIET_WEEK}</span>
              </span>
            )}
            <Fact
              value={lastPracticed(student.lastActive, today)}
              label="last practiced"
            />
          </>
        )}
      </span>
      <span className={styles.childAction}>
        {!learner ? null : learner.entitlement.active ? (
          <PracticeHere
            learnerId={learner.id}
            name={name}
            starting={starting}
            onPracticeHere={onPracticeHere}
          />
        ) : holder ? (
          <PayLink
            learnerId={learner.id}
            className={buttonClass("primary", styles.practiceHere)}
            onClick={() => onContinue(learner.id)}
          >
            Continue with AMP
          </PayLink>
        ) : null}
      </span>
    </li>
  );
}
