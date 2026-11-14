import type { SpaceWords } from "../../../spaces/words";
import { JoinClass } from "../../join/JoinClass";

/** Today's header: the compact form of the one Join element (the code, Copy
 * link, the full-screen board where the bar doesn't offer it, the QR, and
 * More with New code for someone who can make one). */
export function SignInCode({
  code,
  place,
  words,
  board,
  manage,
  locked,
}: {
  code: string;
  place: { org: string; class: string };
  words: Pick<SpaceWords, "names" | "signIn" | "Learners">;
  /** Offer the full-screen code here: the bar doesn't. */
  board: boolean;
  manage: boolean;
  locked: boolean;
}) {
  return (
    <JoinClass
      compact
      code={code}
      place={place}
      words={words}
      boardLink={board}
      manage={manage}
      locked={locked}
    />
  );
}
