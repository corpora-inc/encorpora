import type { ReactNode } from "react";
import { Button } from "../../../../ui/Button";
import {
  RequestSeatsButton,
  StartPracticeButton,
  startDetail,
  useClassAccess,
} from "../../pilots/ClassAccess";
import { SignInCode, type CodeProps } from "./SignInCode";
import styles from "./Today.module.css";

/** The widest code there is: the slot's height is measured on it. */
const WIDEST = "WWWWWW";

/** Today's header slot for practice, always about what to do next and
 * always one height (premium rule 1): before Start it is the Start action,
 * while practice runs the class code, after it ends Request seats, and
 * while the server is asked a calm placeholder of the same shape. A hidden
 * copy of the code row on the widest code holds the height; each state sits
 * over it in the same two rows (one row wider up), so no transition moves
 * anything below and no state leaves an empty band. */
export function PracticeSlot({
  code,
  ...props
}: CodeProps & {
  /** The class's code, when the server sent it. */
  code: string | null;
}) {
  const access = useClassAccess(props.place);
  const { view } = access;
  let state: string;
  let shown: ReactNode;
  if (access.pending) {
    state = "checking";
    shown = <Placeholder />;
  } else if (code && !access.closed) {
    state = "open";
    shown = <SignInCode {...props} code={code} />;
  } else if (access.unavailable) {
    state = "unavailable";
    shown = (
      <Line
        title="Couldn’t check practice"
        action={
          <Button variant="secondary" onClick={access.retry}>
            Try again
          </Button>
        }
      />
    );
  } else if (access.checking) {
    state = "checking";
    shown = <Placeholder />;
  } else if (access.practice === "ended") {
    state = "ended";
    shown = access.teaches ? (
      <Line
        title="Practice has ended"
        action={<RequestSeatsButton primary />}
      />
    ) : (
      <Line
        title="Practice has ended"
        detail="The class’s teacher can request seats."
      />
    );
  } else if (view.kind === "start") {
    state = "start";
    shown = (
      <Line
        title="Start practice"
        detail={startDetail(view)}
        action={
          <StartPracticeButton
            place={props.place}
            pilot={access.pilot}
            label="Start"
          />
        }
      />
    );
  } else if (access.practice === "waiting") {
    state = "waiting";
    shown = <Line title="Waiting for the class’s teacher to start practice" />;
  } else {
    // Open, its code on the way.
    state = "checking";
    shown = <Placeholder />;
  }
  return (
    <div className={styles.codeSlot} data-code-slot={state}>
      <div className={styles.codeSlotHold} aria-hidden="true" inert>
        <SignInCode {...props} code={WIDEST} />
      </div>
      <div className={styles.codeSlotShown}>{shown}</div>
    </div>
  );
}

/** One state of the slot: what it is, in two lines, and its one action. */
function Line({
  title,
  detail,
  action,
}: {
  title: string;
  /** A second line, where the title alone would leave the slot empty. */
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`${styles.slotLine} ${action ? "" : styles.slotText}`}
      data-slot-line=""
    >
      <div className={styles.slotInfo}>
        <h2 className={styles.slotTitle}>{title}</h2>
        {detail && <p className={styles.slotDetail}>{detail}</p>}
      </div>
      {action && <div className={styles.slotAction}>{action}</div>}
    </div>
  );
}

/** While the server is asked: the code row's shape, quiet. */
function Placeholder() {
  return (
    <div
      className={styles.slotPlaceholder}
      role="status"
      aria-label="Checking practice"
    >
      <span />
      <span />
    </div>
  );
}
