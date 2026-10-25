import { entryContext as captureEntryContext } from "../../analytics/entry-context";
export { referrerCategory, deviceClass } from "../../analytics/entry-context";
import {
  browserIdentity,
  VISITOR_KEY,
  FIRST_VISIT_KEY,
  TRAFFIC_KEY,
} from "../../analytics/browser-identity";
import {
  type ClientEvent,
  type FunnelProps,
  MAX_BATCH_BYTES,
  MAX_EVENTS_PER_BATCH,
  funnelPropsSchemas,
} from "../../analytics/events";
import { storedTrial } from "./pending-trial";
import type { TrafficKind } from "../../analytics/engagement";
import { nativeRuntime } from "../native-runtime";
import { createGoogleAnalytics } from "../../analytics/google-analytics";

let google: ReturnType<typeof createGoogleAnalytics> | undefined;
export function trackGooglePage(): void {
  if (nativeRuntime || (!analyticsAllowed() && !google)) return;
  (google ??= createGoogleAnalytics()).navigate();
}

/**
 * First-party funnel analytics. `track` only appends to an in-memory buffer;
 * the buffer is sent with `navigator.sendBeacon` after a short delay, when it
 * fills, and when the page is hidden. Nothing here can throw into the UI or
 * delay a screen. The visitor ID is a random UUID in this browser's storage:
 * it is not derived from, or sent with, any account, learner or contact.
 */
export const visitorKey = VISITOR_KEY;
export const firstVisitKey = FIRST_VISIT_KEY;
const sessionKey = "amp.visitor.session";
const endpoint = "/api/v1/events";
const flushDelayMs = 2000;
const maxBuffered = 200;

type Queued = { event: ClientEvent; props: unknown; at: number };
let buffer: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let identity: ReturnType<typeof browserIdentity> | undefined;
const currentIdentity = () => (identity ??= browserIdentity());
let listening = false;
let entryContext: FunnelProps<"landing_view"> | undefined;
export const trafficKey = TRAFFIC_KEY;
export function analyticsTraffic(): TrafficKind {
  if (currentIdentity().internal()) return "internal";
  return navigator.webdriver ? "automated" : "external";
}
export function initializeAnalyticsContext(): void {
  if (analyticsAllowed())
    entryContext ??= currentIdentity().context(landingProps());
}
export function analyticsAllowed(): boolean {
  return (
    !nativeRuntime &&
    navigator.doNotTrack !== "1" &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  );
}

/** The same random analytics ID on the marketing site and AMP. */
export function visitorId(): string {
  return currentIdentity().visitor();
}

/** Optional payment correlation respects the same browser privacy preference. */
export function analyticsVisitorHeaders(): Record<string, string> {
  return analyticsAllowed() ? { "X-AMP-Visitor": visitorId() } : {};
}

/** Record one funnel event. Invalid props are dropped and logged. */
export function track<E extends ClientEvent>(
  event: E,
  ...[props]: FunnelProps<E> extends Record<string, never>
    ? [props?: FunnelProps<E>]
    : [props: FunnelProps<E>]
): void {
  // The native shell talks to AMP only through its own session; the web
  // funnel is measured on the web.
  if (!analyticsAllowed()) return;
  try {
    const parsed = funnelPropsSchemas[event].safeParse(props ?? {});
    if (!parsed.success) {
      console.warn("Analytics event dropped: invalid props", event);
      return;
    }
    if (buffer.length >= maxBuffered) buffer.shift();
    buffer.push({ event, props: parsed.data, at: Date.now() });
    google?.event(event);
    listen();
    if (buffer.length >= MAX_EVENTS_PER_BATCH) flush();
    else timer ??= setTimeout(flush, flushDelayMs);
  } catch (error) {
    console.warn("Analytics event dropped", event, error);
  }
}

/** Record an event at most once per tab session for `key` (e.g. a return
 * from checkout that a refresh would otherwise count again). */
export function trackOnce<E extends ClientEvent>(
  key: string,
  event: E,
  props: FunnelProps<E>,
): void {
  const slot = `amp.analytics.once.${key}`;
  try {
    if (sessionStorage.getItem(slot)) return;
    sessionStorage.setItem(slot, "1");
  } catch {
    // Without session storage the event may count twice; never block on it.
  }
  (track as (event: E, props: FunnelProps<E>) => void)(event, props);
}

/** Send everything buffered now. Safe to call at any time. */
export function flush(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  while (buffer.length) {
    const events = buffer.splice(0, MAX_EVENTS_PER_BATCH);
    send(events);
  }
}

function send(events: Queued[]): void {
  if (!analyticsAllowed()) return;
  try {
    const trial = storedTrial();
    const body = JSON.stringify({
      visitorId: visitorId(),
      ...(entryContext ? { context: entryContext } : {}),
      traffic: analyticsTraffic(),
      ...(trial ? { trial } : {}),
      events,
    });
    if (body.length > MAX_BATCH_BYTES && events.length > 1) {
      const half = Math.ceil(events.length / 2);
      send(events.slice(0, half));
      send(events.slice(half));
      return;
    }
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(endpoint, blob)) return;
    void fetch(endpoint, {
      method: "POST",
      body: blob,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch((error: unknown) => console.warn("Analytics not sent", error));
  } catch (error) {
    console.warn("Analytics not sent", error);
  }
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Whole days since this browser's first visit. */
export function daysSinceFirstVisit(now = Date.now()): number {
  visitorId();
  try {
    const first = Number(localStorage.getItem(firstVisitKey));
    if (!Number.isFinite(first) || first <= 0 || first > now) return 0;
    return Math.min(3650, Math.floor((now - first) / 86_400_000));
  } catch {
    return 0;
  }
}

/** Emit `session_start` once per browser tab session. */
export function trackSessionStart(): void {
  if (!analyticsAllowed()) return;
  try {
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
  } catch {
    // Without session storage, count each page load as a session.
  }
  track("session_start", { daysSinceFirstVisit: daysSinceFirstVisit() });
}

/** Props for `landing_view` from the current URL, referrer and screen. */
export function landingProps(
  location: Pick<Location, "search" | "hostname"> = window.location,
  referrer = document.referrer,
): FunnelProps<"landing_view"> {
  return captureEntryContext({
    search: location.search,
    hostname: location.hostname,
    referrer,
    width: window.innerWidth,
    coarse:
      typeof matchMedia === "function" &&
      matchMedia("(pointer: coarse)").matches,
  });
}

/** Test seam: forget buffered events and the in-memory visitor. */
export function resetAnalyticsForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  buffer = [];
  identity = undefined;
  entryContext = undefined;
}
