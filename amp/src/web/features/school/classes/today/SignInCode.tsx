import { JoinClass } from "../../join/JoinClass";

/** Today's header: the compact form of the one Join element (code, Copy
 * link, and, where the bar doesn't offer it, the full-screen board). */
export function SignInCode({
  code,
  place,
  family,
  board,
}: {
  code: string;
  place: { org: string; class: string };
  family: boolean;
  /** Offer the full-screen code here: the bar doesn't. */
  board: boolean;
}) {
  return (
    <JoinClass
      compact
      code={code}
      place={place}
      family={family}
      boardLink={board}
    />
  );
}
