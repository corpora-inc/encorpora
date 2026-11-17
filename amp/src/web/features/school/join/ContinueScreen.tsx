import { useEffect, useRef, useState } from "react";
import { studentGrantResource } from "../../../../schools/contracts";
import { claimGrant } from "../../../card-entry";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { finishingSignIn, useFinishSignIn } from "./api";
import { JoinProblem } from "./ClassScreen";

/** `/join/continue`: a school account's sign-in, on its way to practice.
 * Without a grant (a reload, or Back) there's nothing to finish: the next
 * step in place, never a hop to `/join` that Back returns to. */
export function ContinueScreen() {
  const finish = useFinishSignIn();
  const [over, setOver] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || finishingSignIn()) return;
    started.current = true;
    const held = claimGrant();
    if (!held) {
      setOver(true);
      return;
    }
    try {
      const grant = studentGrantResource.parse(
        JSON.parse(
          atob(held.replaceAll("-", "+").replaceAll("_", "/")),
        ) as unknown,
      );
      void finish(grant);
    } catch (error) {
      console.error("The sign-in grant couldn’t be read", error);
      setOver(true);
    }
  }, [finish]);
  if (over)
    return <JoinProblem message="This sign-in already finished. Sign in again." />;
  return <LoadingScreen />;
}
