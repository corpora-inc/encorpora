import type { SpaceDescriptor } from "./resolve";

/** The frame last shown, and the session it was shown in (`sessionIdentity`). */
export type Held = { session: string; frame: SpaceDescriptor } | null;

/** One session: the account and its token. A new sign-in, even as the
 * same account, is another session, and no frame crosses to it. */
export const sessionIdentity = (
  session: { accountId: string; token: string } | null | undefined,
) => (session ? `${session.accountId}\u0000${session.token}` : null);

const key = (frame: SpaceDescriptor) => `${frame.space}|${frame.place ?? ""}`;

/**
 * While the same place is asked again in the same session (a refetch after a
 * change), its last ready frame stays: nothing in the bar blinks out. Only
 * in the same session and the same place; another session (even the same
 * account signed in again), another place, or a refusal never shows an old
 * frame or its actions.
 */
export function holdFrame(
  held: Held,
  next: SpaceDescriptor | null,
  session: string | null,
): SpaceDescriptor | null {
  if (
    next &&
    session &&
    "status" in next &&
    next.status === "loading" &&
    held?.session === session &&
    key(held.frame) === key(next)
  )
    return held.frame;
  return next;
}

/** What to hold after showing `shown`: a ready frame only. */
export function nextHeld(
  shown: SpaceDescriptor | null,
  session: string | null,
): Held {
  return shown && session && (!("status" in shown) || shown.status === "ready")
    ? { session, frame: shown }
    : null;
}

/**
 * Whether the screen itself stays out (the content guard): a place this
 * person can no longer open, or one whose lookup failed. Nothing of it
 * renders, so nothing of it asks the server; the shell shows why instead.
 */
export function blockedBy(
  space: SpaceDescriptor | null,
): "unavailable" | "failed" | null {
  return space &&
    "status" in space &&
    (space.status === "unavailable" || space.status === "failed")
    ? space.status
    : null;
}
