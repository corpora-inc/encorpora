import { z } from "zod";
import type { AuthSession } from "../../auth";
import { track } from "../../lib/analytics";
import { request } from "../../lib/api";
import type {
  SETUP_ACTIONS,
  SETUP_STEPS,
  STARTER_ANSWERS,
} from "../../../analytics/events";

/* First-run measurement (docs/engagement-measurement.md#activation-milestones).
   Each setup screen says when it is shown and when its step is done, in the
   first-party funnel and within its consent and GPC rules (`track`). The
   persona an account chose is also recorded by the server, once, where no
   browser setting can drop it. */

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

/** The account's persona, recorded once by the server. Measurement only: a
 * failure is logged and never reaches the screen. */
const chosen = new Set<string>();
export function choosePersona(session: AuthSession, persona: Persona) {
  const key = `${session.accountId}:${persona}`;
  if (chosen.has(key)) return;
  chosen.add(key);
  request("/start/choice", z.unknown(), {
    token: session.token,
    body: { answer: persona },
  }).catch((error) => {
    chosen.delete(key);
    console.warn("The starter choice wasn't recorded", error);
  });
}
