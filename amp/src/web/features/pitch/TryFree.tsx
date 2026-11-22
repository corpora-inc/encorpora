import { FREE_ONLINE_PROBLEMS } from "../../../learning/free-allowance";
import { TRIAL_WORKBOOKS_MAX } from "../../../learning/trial-workbooks";
import { track } from "../../lib/analytics";
import { Button } from "../../ui/Button";
import type { PitchPlace } from "./nav";
import { choosePitchAction, pitchTarget } from "./targets";

/** Try it free: AMP's one way in for a new visitor, the same on the homepage
 * and on every public page that offers it (the comparisons, `/versus`).
 * `go` moves the page: the pitch's own navigation, or the router's. */
export function TryFreeButton({
  variant,
  className,
  go,
}: {
  variant: "primary" | "secondary";
  className?: string;
  go: (place: PitchPlace) => void;
}) {
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        track("try_click");
        choosePitchAction("try");
        // Try needs no program: its place is sign-up, whatever the arrival.
        go(pitchTarget("try", {}));
      }}
    >
      Try it free
    </Button>
  );
}

/** What free means, under the button. */
export function FreeNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      No credit card. {FREE_ONLINE_PROBLEMS} free problems and{" "}
      {TRIAL_WORKBOOKS_MAX} workbooks.
    </p>
  );
}
