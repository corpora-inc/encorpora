import { track } from "../../lib/analytics";
import type {
  SETUP_ACTIONS,
  SETUP_STEPS,
  STARTER_ANSWERS,
} from "../../../analytics/events";

/* First-run measurement (docs/engagement-measurement.md#activation-milestones).
   Each setup screen says when it is shown and when its step is done, in the
   first-party funnel and within its consent and GPC rules (`track`). The
   answer an account chose is recorded by the server when it is chosen
   (`useChooseSetup`), where no browser setting can drop it. */

export type Persona = (typeof STARTER_ANSWERS)[number];
type SetupStep = (typeof SETUP_STEPS)[number];

/** Once per screen and persona in this tab: a re-render or a refresh of the
 * same screen is one view. */
const seen = new Set<string>();
export function setupStep(
  step: SetupStep,
  action: (typeof SETUP_ACTIONS)[number],
  persona?: Persona,
) {
  const key = `${persona ?? ""}:${step}:${action}`;
  if (action === "view") {
    if (seen.has(key)) return;
    seen.add(key);
  }
  track("setup_step", { step, action, ...(persona ? { persona } : {}) });
}
