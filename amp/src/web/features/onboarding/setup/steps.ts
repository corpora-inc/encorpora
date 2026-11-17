/* A parent's or a tutor's setup, step by step: each step is its own URL,
   `/start/<kind>` then `/start/<kind>/<id>`. The route guard (`routeFor`) and
   the screens read this one list. */

export type SetupKind = "parent" | "tutor";
export type Step = { id: string; label: string };
export const SETUP_STEPS = {
  parent: [
    { id: "", label: "Your kids" },
    { id: "ready", label: "First practice" },
  ],
  tutor: [
    { id: "", label: "Your students" },
    { id: "join", label: "How they join" },
    { id: "ready", label: "Start" },
  ],
} as const satisfies Record<SetupKind, readonly Step[]>;

export const isSetupKind = (value: unknown): value is SetupKind =>
  value === "parent" || value === "tutor";

/** Old step addresses still in flight, and the step each opens now: the
 * retired name step opens the kids; how they practice and a second parent
 * open who practices first (both stay on Today and People). */
export const RETIRED_STEPS: Record<SetupKind, Record<string, string>> = {
  parent: { name: "", practice: "ready", "second-parent": "ready" },
  tutor: {},
};
