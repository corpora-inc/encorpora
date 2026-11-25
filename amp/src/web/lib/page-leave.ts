/**
 * Whether this page is being left (#2465): from `beforeunload` or
 * `pagehide` until the page is known to be here after all.
 *
 * A navigation cuts every fetch still in flight, and WebKit reports each cut
 * as a console error ("… due to access control checks"); an aborted fetch is
 * not reported. WebKit cuts right after `beforeunload`, before `pagehide`
 * (measured in Playwright's WebKit). So the live channel lets go of its reads
 * on the first of the two, and starts none while the page is leaving: a
 * screen that mounts, or a timer that fires, as the navigation begins waits
 * instead.
 *
 * The page is known to be here again when it is shown from the back-forward
 * cache (`pageshow`), or, after a `beforeunload` that no `pagehide` followed
 * (a leave the person cancelled, a `mailto:` link), when they use it again:
 * a press, a key, or the window's focus coming back. No timer decides it: a
 * slow navigation still holds the old page, and a read started then would be
 * cut.
 *
 * The listeners are installed when this module loads, at boot
 * (app/boot.ts), so a screen that mounts after `beforeunload` already sees
 * the page leaving.
 */

export type PageLeaveHandlers = {
  /** The page started leaving: abort every read now. */
  leave: () => void;
  /** It is here after all: read again. */
  back: () => void;
};

type Target = Pick<Window, "addEventListener" | "removeEventListener">;

export type PageLeave = {
  leaving(): boolean;
  /** Called on each leave and return; the returned function unsubscribes. */
  subscribe(handlers: PageLeaveHandlers): () => void;
  /** Resolves when the page is not leaving; rejects when `signal` aborts. */
  untilHere(signal?: AbortSignal): Promise<void>;
  /** A signal that aborts when the page starts leaving (now, if it is). */
  leaveSignal(): AbortSignal;
};

/** Events that show the page is still here after a `beforeunload`. */
const PRESENCE = ["pointerdown", "keydown", "focus"] as const;

export function createPageLeave(target: Target | undefined): PageLeave {
  let leaving = false;
  /** Leaving for sure: `pagehide` came, so only `pageshow` brings it back. */
  let hidden = false;
  let controller = new AbortController();
  const handlers = new Set<PageLeaveHandlers>();
  const waiting = new Set<() => void>();

  const leave = (event: Event) => {
    if (event.type === "pagehide") hidden = true;
    if (leaving) return;
    leaving = true;
    // Abort first, synchronously, in this one listener: the browser cuts
    // what is left as soon as it returns.
    controller.abort(new DOMException("The page is being left", "AbortError"));
    for (const handler of [...handlers]) handler.leave();
  };
  const back = () => {
    if (!leaving) return;
    leaving = false;
    hidden = false;
    controller = new AbortController();
    for (const handler of [...handlers]) handler.back();
    for (const resolve of [...waiting]) resolve();
  };
  const present = () => {
    if (!hidden) back();
  };
  const shown = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) back();
  };
  target?.addEventListener("beforeunload", leave);
  target?.addEventListener("pagehide", leave);
  target?.addEventListener("pageshow", shown);
  for (const type of PRESENCE)
    target?.addEventListener(type, present, { capture: true });

  return {
    leaving: () => leaving,
    subscribe(next) {
      handlers.add(next);
      return () => handlers.delete(next);
    },
    untilHere(signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      if (!leaving) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const done = () => {
          waiting.delete(done);
          signal?.removeEventListener("abort", aborted);
          resolve();
        };
        const aborted = () => {
          waiting.delete(done);
          reject(signal!.reason);
        };
        waiting.add(done);
        signal?.addEventListener("abort", aborted, { once: true });
      });
    },
    leaveSignal: () => controller.signal,
  };
}

/** This page's. */
export const pageLeave = createPageLeave(
  typeof window === "undefined" ? undefined : window,
);

/** Aborts when either does (`AbortSignal.any` is too new for some school
 * iPads). */
function either(a: AbortSignal | undefined, b: AbortSignal) {
  const controller = new AbortController();
  const forward = (signal: AbortSignal) => () =>
    controller.abort(signal.reason);
  const offs: (() => void)[] = [];
  for (const signal of a ? [a, b] : [b]) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const listener = forward(signal);
    signal.addEventListener("abort", listener, { once: true });
    offs.push(() => signal.removeEventListener("abort", listener));
  }
  return {
    signal: controller.signal,
    release: () => offs.forEach((off) => off()),
  };
}

/**
 * A live read that the page's leave never cuts: it starts only while the
 * page is here, is aborted the moment the page starts leaving, and then
 * waits to read again until the page is back (forever, if it is gone). Only
 * `signal` (the query's own: unmounted, cancelled) ends it with an error.
 */
export async function readWhileHere<T>(
  signal: AbortSignal | undefined,
  read: (signal: AbortSignal) => Promise<T>,
  page: PageLeave = pageLeave,
): Promise<T> {
  for (;;) {
    await page.untilHere(signal);
    const leave = page.leaveSignal();
    const both = either(signal, leave);
    try {
      return await read(both.signal);
    } catch (error) {
      // The page started leaving while this was in flight: not a failure.
      if (leave.aborted && !signal?.aborted) continue;
      throw error;
    } finally {
      both.release();
    }
  }
}
