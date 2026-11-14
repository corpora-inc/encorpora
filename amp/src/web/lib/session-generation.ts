/**
 * Sessions this tab has left behind (docs/architecture/spaces.md, "Session
 * identity"). A session ends when another replaces it (sign-out, another
 * account, a new token for the same account): its token is retired, and a
 * request carrying it is refused when it is asked and as soon as it is
 * answered, before anything handles the answer (a late 401 included), so
 * nothing the old session asked can act in the new one. The list is never
 * trimmed: a tab changes session a handful of times. A token is current
 * again only when its session explicitly is again (`changeSession`: a
 * parent's, after a child's handover), never because a cache changed.
 *
 * A session is confirmed once its own `/me` has answered: until then the
 * shell knows only that the account is the same. A renewal keeps the
 * account's drafts visible, but cannot send mutations until confirmed.
 */
const retired = new Set<string>();
const confirmed = new Set<string>();
const renewing = new Set<string>();

/** The session on screen changed from `previous` to `next`. */
export function changeSession(
  previous: string | null | undefined,
  next: string | null | undefined,
) {
  if (previous && previous !== next) retired.add(previous);
  if (next) retired.delete(next);
}

export const isRetired = (token: string | null | undefined) =>
  !!token && retired.has(token);

/** A replacement token for the same account must establish its authority. */
export function beginRenewal(token: string) {
  confirmed.delete(token);
  renewing.add(token);
}
export const isRenewing = (token: string | null | undefined) =>
  !!token && renewing.has(token);

/** This session's own `/me` answered. */
export function confirmSession(token: string | null | undefined) {
  if (token) {
    confirmed.add(token);
    renewing.delete(token);
  }
}
export const isConfirmed = (token: string | null | undefined) =>
  !!token && confirmed.has(token);

/** For tests that reuse one synthetic token across sessions. */
export function forgetRetiredSessions() {
  retired.clear();
  confirmed.clear();
  renewing.clear();
}
