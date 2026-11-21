import { useSyncExternalStore } from "react";

/*
 * One shared one-second clock for everything live on a page: the session's
 * clock, "last active" and the statuses that turn quiet with time. One
 * timer, however many parts read it, and it runs only while something
 * does. A part that reads it re-renders each second; nothing above it does,
 * so a screen keeps the clock inside the part that shows time (a class's
 * Today re-renders its cockpit each second, never its feed or week).
 */

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let second = Math.floor(Date.now() / 1000) * 1000;

function tick() {
  second = Math.floor(Date.now() / 1000) * 1000;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    second = Math.floor(Date.now() / 1000) * 1000;
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const read = () => second;

/** The current second, in this device's time, from the one shared clock. */
export function useSecond(): number {
  return useSyncExternalStore(subscribe, read, read);
}

/** When this device first saw each server time: the first render after a
 * message is within a few milliseconds of its arrival. A short memory: only
 * the latest matters. */
const arrivals = new Map<string, number>();
function arrival(serverNow: string) {
  let at = arrivals.get(serverNow);
  if (at === undefined) {
    at = Date.now();
    arrivals.set(serverNow, at);
    if (arrivals.size > 8) arrivals.delete(arrivals.keys().next().value!);
  }
  return at;
}

/**
 * Now, in the server's time: this device's second, moved by how far its
 * clock is from the server's (`serverNow`, against when this device first
 * saw it). Statuses and "last active" compare server times, so a device
 * whose clock is a minute off still says "now" for an answer just given.
 * `frozen` stops it (a session that has ended).
 */
export function useServerNow(
  serverNow: string | undefined,
  frozen?: number | null,
): number {
  const local = useSecond();
  if (frozen !== undefined && frozen !== null) return frozen;
  const offset = serverNow ? Date.parse(serverNow) - arrival(serverNow) : 0;
  // Within a second the two clocks agree well enough; past it, follow the
  // server.
  return Math.abs(offset) < 1000 ? local : local + offset;
}
