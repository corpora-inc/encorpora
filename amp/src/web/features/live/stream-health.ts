import { useSyncExternalStore } from "react";
import type { LiveStreamMode } from "../../lib/live-stream";
import { useSecond } from "./clock";

/*
 * Whether a class's live view is hearing from the server: the stream's
 * mode and when it last brought anything (a message, a poll that answered,
 * a stream that opened). Written by `useLiveClass`, read by a screen that
 * says so quietly when its numbers may be old. A stream that ends and
 * reconnects every ninety seconds is normal and says nothing.
 */

/** `since`: when the mode last changed. */
type Health = { mode: LiveStreamMode; heardAt: number; since: number };
const health = new Map<string, Health>();
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};

export function noteMode(classId: string, mode: LiveStreamMode) {
  const held = health.get(classId);
  const now = Date.now();
  health.set(classId, {
    mode,
    heardAt: mode === "streaming" ? now : (held?.heardAt ?? now),
    since: now,
  });
  changed();
}

export function noteHeard(classId: string) {
  const held = health.get(classId);
  health.set(classId, {
    mode: held?.mode ?? "connecting",
    heardAt: Date.now(),
    since: held?.since ?? Date.now(),
  });
  changed();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

/** Nothing from the server for this long, and no stream open: say so. */
export const QUIET_AFTER_MS = 20_000;

/**
 * Whether this class's live numbers may be old: the device is
 * offline, or no stream is open and nothing has arrived for
 * `QUIET_AFTER_MS`. A hidden page holds nothing (`paused`) and is not
 * stale: it reads afresh when shown.
 */
export function useLiveStale(classId: string): boolean {
  const now = useSecond();
  const online = useSyncExternalStore(
    subscribe,
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
    () => true,
  );
  const held = useSyncExternalStore(
    subscribe,
    () => health.get(classId),
    () => undefined,
  );
  if (!online) return true;
  if (!held || held.mode === "streaming" || held.mode === "paused")
    return false;
  // A reconnect starts the wait afresh: the stream's ninety-second
  // rotation never reads as a lost connection.
  return now - Math.max(held.heardAt, held.since) > QUIET_AFTER_MS;
}
