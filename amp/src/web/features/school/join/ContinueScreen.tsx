import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { studentGrantResource } from "../../../../schools/contracts";
import { claimGrant } from "../../../card-entry";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import { finishingSignIn, useFinishSignIn } from "./api";

/** `/join/continue`: a school account's sign-in, on its way to practice. Without a
 * grant (a reload, or Back), there's nothing to do here, so this goes to `/join`. */
export function ContinueScreen() {
  const navigate = useNavigate();
  const finish = useFinishSignIn();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || finishingSignIn()) return;
    started.current = true;
    const held = claimGrant();
    if (!held) {
      void navigate({ to: "/join", replace: true });
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
      void navigate({ to: "/join", replace: true });
    }
  }, [finish, navigate]);
  return <LoadingScreen />;
}
