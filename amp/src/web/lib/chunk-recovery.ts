import { errorDetails } from "../../analytics/error-details";
import { isInjectedRuntimeError } from "../../analytics/injected-error";
import { currentBrowserKind } from "../../analytics/browser-kind";
import {
  flush,
  screenOf,
  trackClientError,
  countExternalRuntimeError,
} from "./analytics";
import { autoReloadBlock, watchReloadSafety } from "./reload-guard";

const handled = new WeakSet<object>();
let reloading = false;
export const chunkReloading = () => reloading;
let notice = false;
const subscribers = new Set<() => void>();
export const chunkNotice = () => notice;
export const subscribeChunkNotice = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};
export function dismissChunkNotice() {
  notice = false;
  subscribers.forEach((callback) => callback());
}
/** Shared by Vite, global rejection handlers and the route boundary. A failure
 * may reach all three; claim/log/reload it only once. */
export function recoverChunkError(
  error: unknown,
  showNotice = true,
  preload = false,
): boolean {
  if (!preload && errorDetails(error).category !== "chunk") return false;
  if (reloading) return true;
  if (error !== null && typeof error === "object") {
    if (handled.has(error)) return true;
    handled.add(error);
  }
  const blocked = autoReloadBlock();
  trackClientError({
    ...errorDetails(error, undefined, location.origin),
    category: "chunk",
    kind: "error",
    screen: screenOf(location.pathname),
    code: blocked ? "chunk_reload_blocked" : "chunk_reload",
    ...(blocked ? { reloadBlock: blocked } : {}),
  });
  if (!blocked) {
    reloading = true;
    // Persist synchronously and use keepalive before replacing the document.
    flush(true);
    location.reload();
  } else if (showNotice) {
    notice = true;
    subscribers.forEach((callback) => callback());
    // No app screen is up to show the notice (the light pitch, or a page
    // whose app never mounted): the entry guard says it in place instead.
    // Not for a background preload: the visitor asked for nothing yet, and
    // the screen they do open reports its own failure.
    if (!subscribers.size && !preload) showEntryRecovery();
  }
  return true;
}

declare global {
  interface Window {
    /** public/entry-guard.js, loaded by every document before the app. */
    ampEntryGuard?: { show(kind: "load" | "engine"): void };
  }
}
function showEntryRecovery() {
  if (window.ampEntryGuard) window.ampEntryGuard.show("load");
  else console.error("AMP: a file didn’t load and no screen can say so");
}
let listening = false;
/** Recovery must work even when analytics is disabled by a privacy preference. */
export function startRuntimeRecovery() {
  if (listening) return;
  listening = true;
  // From here the app recovers its own failures; the entry guard stands down.
  document.documentElement.setAttribute("data-amp-runtime", "");
  watchReloadSafety();
  window.addEventListener("vite:preloadError", (event) => {
    recoverChunkError(
      (event as Event & { payload?: unknown }).payload,
      true,
      true,
    );
  });
  window.addEventListener("error", (event) => {
    if (!event.error && /^ResizeObserver loop/.test(String(event.message)))
      return;
    const error = event.error ?? event.message;
    if (
      isInjectedRuntimeError(
        error,
        event.filename,
        location.origin,
        currentBrowserKind(),
      )
    ) {
      countExternalRuntimeError();
      return;
    }
    if (recoverChunkError(error)) return;
    trackClientError({
      ...errorDetails(event.error, event, location.origin),
      kind: "error",
      screen: screenOf(location.pathname),
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (
      isInjectedRuntimeError(
        event.reason,
        undefined,
        location.origin,
        currentBrowserKind(),
      )
    ) {
      countExternalRuntimeError();
      return;
    }
    if (recoverChunkError(event.reason)) return;
    trackClientError({
      ...errorDetails(event.reason, undefined, location.origin),
      kind: "unhandled_rejection",
      screen: screenOf(location.pathname),
    });
  });
}
