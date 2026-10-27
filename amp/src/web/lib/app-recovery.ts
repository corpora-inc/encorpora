import { nativeRuntime } from "../native-runtime";

/** Recovery for a tab that outlived its release or its sign-in. A page left
 * open overnight can run yesterday's code against today's API, or hold a
 * session the server has ended. Neither is the visitor's mistake, so neither
 * shows an error: the tab loads the current release, or goes to sign-in
 * with its campaign and program context kept. */

const entryOf = (doc: Document): string | null => {
  const script = doc.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/"]',
  );
  return script ? new URL(script.src, location.origin).pathname : null;
};

// The hashed entry script names the web release exactly; a deploy that changes
// no browser code keeps it, so an open tab is only "stale" when its code is.
// Development builds have no hashed entry and are never stale; the native app
// ships its release inside the app and updates through the store.
let loadedEntry: string | null | undefined;
let stale = false;
let checkedAt = 0;
let checking: Promise<boolean> | null = null;

async function liveEntry(): Promise<string | null> {
  const response = await fetch("/", {
    cache: "no-store",
    headers: { Accept: "text/html" },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return entryOf(new DOMParser().parseFromString(html, "text/html"));
}

/** Whether a newer web release than this tab's is live. Checks at most once
 * per `maxAgeMs`; a failed check is "not stale", never an error. */
export function buildIsStale(maxAgeMs = 30_000): Promise<boolean> {
  loadedEntry ??= nativeRuntime ? null : entryOf(document);
  if (!loadedEntry || stale) return Promise.resolve(stale);
  if (Date.now() - checkedAt < maxAgeMs) return Promise.resolve(false);
  checking ??= liveEntry()
    .then((live) => {
      checkedAt = Date.now();
      stale = live !== null && live !== loadedEntry;
      return stale;
    })
    .catch(() => false)
    .finally(() => {
      checking = null;
    });
  return checking;
}

/** Whether a check has already found this tab stale (no request). */
export const knownStale = () => stale;

const RELOAD_KEY = "amp.release-reload";
/** Reloads the page at its current URL. The returned promise never settles,
 * so the caller shows nothing while the page is replaced. Returns null, and
 * does not reload, when this tab already reloaded for a release in the last
 * minute: a "/" that keeps naming another release (a rollout, a cache) must
 * not reload the page forever. */
export function reloadIntoCurrentRelease(): Promise<never> | null {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY)) < 60_000)
      return null;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return null;
  }
  location.reload();
  return new Promise<never>(() => {});
}

const AWAY_BEFORE_CHECK_MS = 5 * 60_000;
/** Returning to a tab after a while checks for a new release. A stale tab is
 * not reloaded under the visitor (an answer or form would be lost); its next
 * navigation loads the current release instead (see the root route). */
export function watchForNewRelease() {
  if (nativeRuntime) return;
  let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0;
  const returned = (awayMs: number) => {
    if (awayMs >= AWAY_BEFORE_CHECK_MS) void buildIsStale(0);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (hiddenAt) returned(Date.now() - hiddenAt);
  });
  // A page restored from the back-forward cache may be arbitrarily old.
  addEventListener("pageshow", (event) => {
    if (event.persisted) returned(Infinity);
  });
}

type SignedOutHandler = () => boolean;
let signedOutHandler: SignedOutHandler | null = null;
/** Registers what to do when the server no longer accepts this tab's
 * sign-in. The handler returns true when it has taken the visitor elsewhere. */
export function onSignedOut(handler: SignedOutHandler) {
  signedOutHandler = handler;
  return () => {
    if (signedOutHandler === handler) signedOutHandler = null;
  };
}
export const signedOut = () => signedOutHandler?.() ?? false;

/** Test-only: forget the loaded release and any check result. */
export function resetAppRecoveryForTest() {
  loadedEntry = undefined;
  stale = false;
  checkedAt = 0;
  checking = null;
  signedOutHandler = null;
}
