import type { SpaceWords } from "../../../spaces/words";
import { JoinClass } from "../../join/JoinClass";

export type CodeProps = {
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
