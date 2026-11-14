import type { SpaceDescriptor } from "./resolve";

/** The frame last shown, and whose it was. */
export type Held = { account: string; frame: SpaceDescriptor } | null;

const key = (frame: SpaceDescriptor) => `${frame.space}|${frame.place ?? ""}`;

/**
 * While the same place is asked again for the same account (a token renewed,
 * a refetch after a change), its last ready frame stays: nothing in the bar
 * blinks out. Only for the same principal and the same place; another
 * account, another place, or a refusal (`unavailable`) never shows an old
 * frame.
 */
export function holdFrame(
  held: Held,
  next: SpaceDescriptor | null,
  account: string | null,
): SpaceDescriptor | null {
  if (
    next &&
    account &&
    "status" in next &&
    next.status === "loading" &&
    held?.account === account &&
    key(held.frame) === key(next)
  )
    return held.frame;
  return next;
}

/** What to hold after showing `shown`: a ready frame only. */
export function nextHeld(
  shown: SpaceDescriptor | null,
  account: string | null,
): Held {
  return shown && account && (!("status" in shown) || shown.status === "ready")
    ? { account, frame: shown }
    : null;
}
