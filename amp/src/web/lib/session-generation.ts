/**
 * Sessions this tab has left behind (docs/architecture/spaces.md, "Session
 * identity"). When a session ends or is replaced, its token is retired: a
 * request with it is refused before it is sent, and an answer to one sent
 * earlier is refused before anything reads or caches it. So an old loader
 * that resumes after a new sign-in can neither ask with the old session
 * nor write its answer where the new session reads.
 */
const retired = new Set<string>();
const KEPT = 32;

export function retireToken(token: string | null | undefined) {
  if (!token) return;
  retired.add(token);
  // Only the last few: a tab rarely changes session more than that.
  while (retired.size > KEPT) retired.delete(retired.values().next().value!);
}

export const isRetired = (token: string | null | undefined) =>
  !!token && retired.has(token);

/** A session that is current again (a parent's, back after a child's
 * handover on this device): its own requests are its own again. */
export function reviveToken(token: string | null | undefined) {
  if (token) retired.delete(token);
}

/** For tests that reuse one synthetic token across sessions. */
export function forgetRetiredSessions() {
  retired.clear();
}
