import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { standing } from "../../../../lib/AppError";
import { Button, buttonClass } from "../../../../ui/Button";
import { currentSession, orgOptions } from "../../api";
import { orgPath } from "../../paths";
import {
  RequestSeatsButton,
  StartPracticeButton,
  startDetail,
  useClassAccess,
  useRevokeOnRefusal,
} from "../../pilots/ClassAccess";
import { presenceOptions } from "../api";
import { SignInCode, type CodeProps } from "./SignInCode";
import styles from "./Today.module.css";

/** The widest code there is: the slot's height is measured on it. */
const WIDEST = "WWWWWW";

/** Today's header slot for practice, always about what to do next and
 * always one height (premium rule 1): before Start it is the Start action,
 * while practice runs the class code, after it ends the step that answers
 * why (seats, the next school year, the roster), and while the server is
 * asked a calm placeholder of the same shape. Every action it offers
 * succeeds for its reader. A hidden
 * copy of the code row on the widest code holds the height; each state sits
 * over it in the same two rows (one row wider up), so no transition moves
 * anything below and no state leaves an empty band. */
export function PracticeSlot(props: CodeProps) {
  const { place } = props;
  const access = useClassAccess(place);
  const session = currentSession();
  // The code, from the same read as every screen's (one store).
  const presence = useQuery({
    ...presenceOptions(session, place),
    refetchOnMount: false,
  });
  // Refused: no cached code stands, and the class is read again.
  const read = standing(presence);
  useRevokeOnRefusal(presence, place);
  const code = read?.class.joinCode || null;
  const rollover = !!useQuery({
    ...orgOptions(session, place.org),
    refetchOnMount: false,
  }).data?.can?.includes("year.rollover");
  // The server said practice opened after the code was read: read the code
  // again (CP-3 r7). Once per answer; "Checking" never outlives the reads.
  const stale =
    !access.closed &&
    !access.pending &&
    presence.isSuccess &&
    !code &&
    presence.dataUpdatedAt < access.answeredAt;
  useEffect(() => {
    if (stale && !presence.isFetching) void presence.refetch();
  }, [stale, access.answeredAt]);
  // A newer read of the code says practice is closed while the class's
  // answer says open: the class is asked again, once per such read.
  const disagrees =
    !access.closed &&
    !stale &&
    !!read &&
    presence.dataUpdatedAt >= access.answeredAt &&
    read.class.practice !== undefined &&
    read.class.practice !== "open";
  useEffect(() => {
    if (disagrees) access.retry();
  }, [disagrees, presence.dataUpdatedAt]);
  const again = () => {
    void presence.refetch();
    access.retry();
  };
  const tryAgain = (
    <Button variant="secondary" onClick={again}>
      Try again
    </Button>
  );
  const { view } = access;
  let state: string;
  let shown: ReactNode;
  if (access.pending) {
    state = "checking";
    shown = <Placeholder />;
  } else if (read === undefined && presence.isError) {
    // The code's first read failed: ask again.
    state = "unavailable";
    shown = <Line title="Couldn’t load the class code" action={tryAgain} />;
  } else if (read === undefined) {
    state = "checking";
    shown = <Placeholder />;
  } else if (code && !access.closed) {
    state = "open";
    shown = <SignInCode {...props} code={code} />;
  } else if (read === null || access.unavailable) {
    // Refused, or where practice stands couldn't be read.
    state = "unavailable";
    shown = <Line title="Couldn’t check practice" action={tryAgain} />;
  } else if (access.checking) {
    state = "checking";
    shown = <Placeholder />;
  } else if (access.practice === "ended") {
    state = `ended-${access.end ?? "coverage"}`;
    shown =
      access.end === "session" ? (
        // The school year is over: seats can't reopen it. The next year
        // is the school's to set up.
        rollover ? (
          <Line
            title="This class’s school year is over"
            action={
              <Link
                to="/$"
                params={{ _splat: orgPath(place.org, "year") }}
                className={buttonClass("primary")}
              >
                Set up next year
              </Link>
            }
          />
        ) : (
          <Line
            title="This class’s school year is over"
            detail="Its reports and grades stay here."
          />
        )
      ) : access.end === "roster" ? (
        <Line
          title="None of its students can sign in today"
          action={
            <Link
              to="/school/$org/classes/$class/roster"
              params={place}
              className={buttonClass("secondary")}
            >
              See students
            </Link>
          }
        />
      ) : access.teaches ? (
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
            place={place}
            pilot={access.pilot}
            label="Start"
          />
        }
      />
    );
  } else if (access.practice === "waiting") {
    state = "waiting";
    shown = <Line title="Waiting for the class’s teacher to start practice" />;
  } else if (presence.isError) {
    // Open, but the code couldn't be read: ask again.
    state = "unavailable";
    shown = <Line title="Couldn’t load the class code" action={tryAgain} />;
  } else if (presence.isFetching || stale || disagrees) {
    state = "checking";
    shown = <Placeholder />;
  } else {
    // Open by the class's answer, yet a newer read of the code has none.
    state = "unavailable";
    shown = <Line title="Couldn’t check practice" action={tryAgain} />;
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
