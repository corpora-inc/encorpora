/**
 * Closing returns to where a view was opened (Q-67).
 *
 * Every close (X), Done or Back on an overlay or full-screen view goes
 * through `closeTo`. Each history entry records the address of the entry it
 * was pushed from (`stampPrevious`, installed in app/router.tsx). The record
 * lives in the browser's history entry, so it survives a refresh.
 *
 * - Opened in the app, closing goes Back (`closesBack`): to exactly where it
 *   was opened, with its scroll and selection. X and the browser's Back do
 *   the same thing, and Back never reopens what was closed.
 * - A view with an address of its own (a lesson film) carries where it was
 *   opened as `?from=`, checked by `returnTarget` as a path inside this app.
 *   It goes Back only when the entry before it is that screen.
 * - With nothing to go Back to (a shared link, a new tab, a full page load),
 *   closing replaces the view with its `from`, or else its logical parent in
 *   its context (an answer's lesson closes to the answer), never the
 *   learner's home.
 */

/** The longest return target an address carries. */
const MAX_TARGET = 2048;
/** A base no real address has, to parse relative paths against. */
const BASE = "https://amp.invalid";

/**
 * A return target from an address (`?from=`), or undefined: a path inside
 * this app, normalized. Never another site (`//host`, `/\host`, `https:`),
 * never the API, never control characters.
 */
export function returnTarget(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_TARGET) return undefined;
  // One leading slash: a browser reads `//host` and `/\host` as another site.
  if (!/^\/(?![/\\])/.test(value)) return undefined;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE) return undefined;
  if (/^\/api(?:\/|$)/i.test(url.pathname)) return undefined;
  return url.pathname + url.search + url.hash;
}

/** The address keys that hold a list's view (its sort, area, year, chart…),
 * not what is open. A detail carries them to and from its list. */
export const VIEW_KEYS = [
  "sort",
  "lens",
  "area",
  "strand",
  "year",
  "chart",
  "rows",
  "dot",
  "status",
  "period",
  "view",
] as const;
const viewKey = new Set<string>(VIEW_KEYS);

/**
 * Whether an entry's address (`entry`) is the screen a close goes to
 * (`target`): the same path and the same search, except view keys the target
 * leaves to the list (the list keeps its own sort, area or year).
 */
export function sameScreen(entry: string, target: string) {
  let a: URL, b: URL;
  try {
    a = new URL(entry, BASE);
    b = new URL(target, BASE);
  } catch {
    return false;
  }
  const path = (url: URL) => url.pathname.replace(/\/+$/, "") || "/";
  if (a.origin !== BASE || b.origin !== BASE || path(a) !== path(b))
    return false;
  const keys = new Set([...a.searchParams.keys(), ...b.searchParams.keys()]);
  for (const key of keys) {
    if (!b.searchParams.has(key) && viewKey.has(key)) continue;
    const left = a.searchParams.getAll(key);
    const right = b.searchParams.getAll(key);
    if (left.length !== right.length || left.some((v, i) => v !== right[i]))
      return false;
  }
  return true;
}

/** Where each history entry records the address of the entry before it. */
const PREVIOUS = "ampPrevious";

/** The address of the entry before this one, as recorded when it was pushed. */
export function previousEntry(state: unknown): string | undefined {
  const value =
    state && typeof state === "object"
      ? (state as Record<string, unknown>)[PREVIOUS]
      : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * The history state for a navigation about to commit, stamped with the
 * address of the entry before it: a push records the current address; a
 * replace, or a push to the same address, keeps the current entry's record.
 * The stamp lives in the history entry, so it survives a refresh.
 */
export function stampPrevious(
  next: { href: string; replace?: boolean; state?: object },
  here: { href: string; state: unknown },
): object {
  const trim = (href: string) => href.replace(/\/+(?=$|[?#])/, "") || "/";
  const previous =
    next.replace || trim(next.href) === trim(here.href)
      ? previousEntry(here.state)
      : here.href;
  return previous === undefined
    ? { ...next.state }
    : { ...next.state, [PREVIOUS]: previous };
}

/** Entries a close never goes Back to: signing in, joining, starting. */
const PASSAGE = /^\/(?:sign-in|sign-up|reset-password|join|c|start|account)(?:[/?#]|$)/;

/** The little of the router a close needs. */
export type ClosingRouter = {
  history: {
    location: { href: string; state: unknown };
    back: () => void;
  };
  navigate: (options: { href: string; replace: boolean }) => unknown;
};

const pathOf = (href: string) =>
  new URL(href, BASE).pathname.replace(/\/+$/, "") || "/";

/**
 * Whether closing goes Back. The entry before this one was recorded in the
 * app, and is where the view was opened: its `from` when the address names
 * one; otherwise its parent, or any other screen. An earlier state of this
 * same screen (another student in the same sheet) is not where it was
 * opened: closing then goes to the parent instead.
 */
export function closesBack(
  here: { href: string; state: unknown },
  parent: string,
  from?: string,
) {
  const previous = previousEntry(here.state);
  if (previous === undefined || PASSAGE.test(previous)) return false;
  if (from !== undefined) return sameScreen(previous, from);
  return sameScreen(previous, parent) || pathOf(previous) !== pathOf(here.href);
}

/**
 * Closes the current view. `parent` is its logical parent in its context;
 * `from`, when the view's address carries one (checked with `returnTarget`),
 * is the screen it names as its opener. Back where it was opened
 * (`closesBack`); otherwise a replace to `from`, or else `parent`.
 */
export function closeTo(router: ClosingRouter, parent: string, from?: string) {
  if (closesBack(router.history.location, parent, from)) router.history.back();
  else void router.navigate({ href: from ?? parent, replace: true });
}

/** Closes what search keys opened over this screen (a sheet, a lesson). */
export function closeSearch(router: ClosingRouter, ...keys: string[]) {
  closeTo(router, withoutSearch(router.history.location.href, ...keys));
}

/** An address with search keys removed, as a return target. */
export function withoutSearch(href: string, ...keys: string[]) {
  const url = new URL(href, BASE);
  for (const key of keys) url.searchParams.delete(key);
  return url.pathname + url.search + url.hash;
}
