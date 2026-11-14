import type { SpaceWords } from "../../../spaces/words";
import { JoinClass } from "../../join/JoinClass";
import styles from "./Today.module.css";

type CodeProps = {
  place: { org: string; class: string };
  words: Pick<SpaceWords, "names" | "signIn" | "Learners">;
  /** Offer the full-screen code here: the bar doesn't. */
  board: boolean;
  manage: boolean;
  locked: boolean;
};

/** Today's header: the compact form of the one Join element (the code, Copy
 * link, the full-screen board where the bar doesn't offer it, the QR, and
 * More with New code for someone who can make one). */
export function SignInCode({ code, ...props }: CodeProps & { code: string }) {
  return (
    <JoinClass
      compact
      code={code}
      place={props.place}
      words={props.words}
      boardLink={props.board}
      manage={props.manage}
      locked={props.locked}
    />
  );
}

/** The widest code there is: the slot's height is measured on it. */
const WIDEST = "WWWWWW";

/** The code's place in Today's header, the same height whether practice is
 * open or not (premium rule 1): a hidden copy of the code row, on the
 * widest code, holds the height in every state, and over it sits either the
 * code or one quiet line. Practice opening or closing during a visit swaps
 * what is shown and moves nothing below it. */
export function CodeSlot({
  code,
  closedLine,
  ...props
}: CodeProps & {
  /** The class's code while practice is open; null while it isn't. */
  code: string | null;
  /** What the slot says while there is no code. */
  closedLine: string;
}) {
  return (
    <div className={styles.codeSlot} data-code-slot={code ? "open" : "closed"}>
      <div className={styles.codeSlotHold} aria-hidden="true" inert>
        <SignInCode {...props} code={WIDEST} />
      </div>
      {code ? (
        <div className={styles.codeSlotShown}>
          <SignInCode {...props} code={code} />
        </div>
      ) : (
        <p className={`${styles.codeSlotShown} ${styles.codeSlotQuiet}`}>
          {closedLine}
        </p>
      )}
    </div>
  );
}
