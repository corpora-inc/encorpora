import type { AuthSession } from "../../../auth";
import { notifyDeviceSessionChanged } from "../../../auth";
import { meOptions, queryClient } from "../../../lib/query";

// Kept apart from ./api so the router, which runs this on every screen, never
// carries the join screens' contracts into the entry's code.

/** The identity a hand-over is waiting to show with practice. */
let waiting: AuthSession | null = null;
export function deferIdentity(session: AuthSession) {
  waiting = session;
}
/** The identity the next screen will show, while a hand-over waits: a
 * route's loader reads it to load what that person's screen holds. */
export const deferredIdentity = (): AuthSession | null => waiting;
/** Shows the handed child's identity, if one waits: called as the router
 * mounts the next screen, so the switch renders with practice. Keeps the
 * child's `/me`, fetched before the move, across the switch. */
export function applyDeferredIdentity() {
  const session = waiting;
  if (!session) return;
  waiting = null;
  const me = queryClient.getQueryData(meOptions(session).queryKey);
  // A family hand-over: Providers keeps the tree and the parent's cache.
  notifyDeviceSessionChanged(session, { handoff: true });
  if (me) queryClient.setQueryData(meOptions(session).queryKey, me);
}
