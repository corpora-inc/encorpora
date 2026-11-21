import { FREE_ONLINE_PROBLEMS } from "../../../learning/free-allowance";
import { TRIAL_WORKBOOKS_MAX } from "../../../learning/trial-workbooks";
import { track } from "../../lib/analytics";
import { Button } from "../../ui/Button";
import { usePitchNav } from "./nav";
import { choosePitchAction, pitchTarget } from "./targets";

/** Try it free: AMP's one way in for a new visitor, the same on the homepage
 * and on every public page that offers it (the comparisons, `/versus`). It
 * moves through `usePitchNav`, so it renders inside a `PitchNavProvider`. */
export function TryFreeButton({
  variant,
  className,
}: {
  variant: "primary" | "secondary";
  className?: string;
}) {
  const nav = usePitchNav();
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        track("try_click");
        choosePitchAction("try");
        nav.go(pitchTarget("try", nav.search));
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
