import type { ComponentType } from "react";
import type { FamilyCockpitProps } from "./FamilyCockpit";

/*
 * The family's live cockpit is its own chunk (the roster, the totals, the
 * requests strip): a family with no session running never downloads it. It
 * loads when a session is running (the route's loader asks for it with the
 * snapshot, so the first paint has the cockpit in place) or when a parent
 * first touches Start (so it is there by the time the session is).
 */
let loaded: ComponentType<FamilyCockpitProps> | null = null;
let pending: Promise<void> | null = null;

export function loadFamilyCockpit(): Promise<void> {
  pending ??= import("./FamilyCockpit").then((module) => {
    loaded = module.FamilyCockpit;
  });
  // A failed load is tried again on the next ask.
  pending.catch((failure: unknown) => {
    console.error("The family’s live view didn’t load", failure);
    pending = null;
  });
  return pending;
}

/** The cockpit's component once its chunk is in; null before. */
export const familyCockpit = () => loaded;

/** Ask for the chunk ahead of need (a parent touching Start); a failure is
 * logged, and asked again when the cockpit is needed. */
export function warmFamilyCockpit() {
  loadFamilyCockpit().catch((failure: unknown) =>
    console.error("The family’s live view didn’t load ahead", failure),
  );
}
