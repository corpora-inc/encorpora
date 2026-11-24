import type { ComponentType } from "react";
import type { FamilyCockpitProps } from "./FamilyCockpit";

/*
 * The family's live cockpit is its own chunk (the roster, the totals, the
 * requests strip): a family with no session running never downloads it. It
 * loads when a session is running (the route's loader asks for it with the
 * snapshot, so the first paint has the cockpit in place) or when a parent
 * first touches Start (so it is there by the time the session is).
 */
type Cockpit = ComponentType<FamilyCockpitProps>;
/** The chunk's promise, marked settled the way React's `use` reads one
 * (`status`, `value`): asked for after the chunk is in, it answers in the
 * same render, with no wait and no fallback frame. */
type Chunk = Promise<Cockpit> & { status?: "fulfilled"; value?: Cockpit };

let loaded: Cockpit | null = null;
let pending: Chunk | null = null;

export function loadFamilyCockpit(): Promise<Cockpit> {
  if (pending) return pending;
  const chunk: Chunk = import("./FamilyCockpit").then((module) => {
    loaded = module.FamilyCockpit;
    chunk.status = "fulfilled";
    chunk.value = loaded;
    return loaded;
  });
  pending = chunk;
  // A failed load is tried again on the next ask.
  chunk.catch((failure: unknown) => {
    console.error("The family’s live view didn’t load", failure);
    if (pending === chunk) pending = null;
  });
  return chunk;
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
