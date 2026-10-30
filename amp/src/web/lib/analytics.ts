import { errorDetails } from "../../analytics/error-details";
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
  clientEventSchema,
} from "../../analytics/events";
import type { AuthSession } from "../auth";
import { screenForPath } from "../../analytics/engagement";
import type { TrafficKind } from "../../analytics/engagement";
import { nativeRuntime } from "../native-runtime";
import { createGoogleAnalytics } from "../../analytics/google-analytics";

let google: ReturnType<typeof createGoogleAnalytics> | undefined;
export function googleSignupContext() {
  return google?.signupContext();
}
export function trackGooglePage(): void {
  if (nativeRuntime || (!analyticsAllowed() && !google)) return;
  (google ??= createGoogleAnalytics()).navigate();
}

/** First-party journey collection. A bounded tab queue survives reloads;
 * acknowledged batches are removed and retry IDs prevent duplicate counting.
 * Auth tokens stay in memory. Events retain their original account scope. */
export const visitorKey = VISITOR_KEY;
export const firstVisitKey = FIRST_VISIT_KEY;
const sessionKey = "amp.visitor.session";
const endpoint = "/api/v1/events";
const flushDelayMs = 2000;
const maxBuffered = 200;

const queueKey = "amp.analytics.pending.v2";
const documentSession = crypto.randomUUID();
const queueLifetime = 24 * 60 * 60 * 1000;
type Queued = {
  event: ClientEvent;
  props: unknown;
  at: number;
  id: string;
  sessionId: string;
  scope?: string;
  generation?: string;
};
let account: AuthSession | null | undefined;
let accountGeneration = "initial";
let contextVersion = 0;
const scopeListeners = new Set<() => void>();
export function onAnalyticsScopeChanging(callback: () => void) {
  scopeListeners.add(callback);
  return () => {
    scopeListeners.delete(callback);
  };
}
function beforeScopeChange() {
  for (const callback of scopeListeners) callback();
  flush(true);
}
let restored = false;
let sending = 0;
let retryMs = flushDelayMs;
let nextSendAt = 0;

export function captureAnalyticsTracker(): typeof track {
  const scope = account?.accountId,
    generation = accountGeneration;
  return ((event: ClientEvent, props: never) => {
    if (scope === account?.accountId && generation === accountGeneration)
      (track as (event: ClientEvent, props: unknown) => void)(event, props);
  }) as typeof track;
}
export function analyticsSessionId() {
  return documentSession;
}
export function setAnalyticsSession(next: AuthSession | null) {
  const previous = account?.accountId;
  if (previous !== next?.accountId) {
    beforeScopeChange();
    accountGeneration = "initial";
  }
  account = next;
  if (next && previous !== next.accountId && analyticsAllowed()) {
    const version = ++contextVersion;
    // No product request waits on diagnostic metadata. Pending events retain
    // the generation captured at creation, even if this lookup finishes later.
    void fetch("/api/v1/events/context", {
      headers: { Authorization: `Bearer ${next.token}` },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const generation = data?.generation;
        if (
          version !== contextVersion ||
          account?.accountId !== next.accountId ||
          (generation !== "initial" &&
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              generation ?? "",
            ))
        )
          return;
        if (generation !== accountGeneration) {
          beforeScopeChange();
          accountGeneration = generation;
          track("account_session");
          trackPageView(location.pathname);
        }
      })
      .catch(() => {});
  } else if (!next) contextVersion++;
  restore();
  buffer = buffer.filter((e) => !e.scope || e.scope === next?.accountId);
  persist();
  if (next && previous !== next.accountId) {
    track("account_session");
    trackPageView(location.pathname);
  }
  schedule();
}
function restore() {
  if (restored) return;
  restored = true;
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(queueKey) ?? "[]");
    if (!Array.isArray(saved)) return;
    for (const candidate of saved.slice(-maxBuffered)) {
      const { scope, generation, ...event } = candidate;
      const parsed = clientEventSchema.safeParse(event);
      if (
        parsed.success &&
        event.id &&
        event.sessionId &&
        Date.now() - event.at < queueLifetime &&
        event.at <= Date.now() + 60000 &&
        (scope === undefined || typeof scope === "string")
      )
        buffer.push({ ...parsed.data, scope, generation } as Queued);
    }
  } catch {
    /* Storage is optional. */
  }
}
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
function persist(immediate = false) {
  if (immediate) {
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persistenceTimer = null;
    try {
      sessionStorage.setItem(queueKey, JSON.stringify(buffer));
    } catch {
      /* Memory fallback. */
    }
    return;
  }
  // Coalesce synchronous Web Storage work outside the interaction/render call.
  persistenceTimer ??= setTimeout(() => persist(true), 0);
}
function schedule() {
  if (buffer.length && !timer) timer = setTimeout(flush, retryMs);
}
export function trackPageView(path: string) {
  const pages = {
    "/sign-up": "sign-up",
    "/sign-in": "sign-in",
    "/reset-password": "reset-password",
    "/try": "trial-start",
    "/try/practice": "trial-practice",
    "/try/map": "trial-map",
    "/try/plans": "trial-plans",
    "/purchase/arizona-esa": "funding-az",
    "/purchase/arkansas-efa": "funding-ar",
    "/purchase/new-hampshire-efa": "funding-nh",
  } as const;
  const clean = path.split(/[?#]/)[0];
  track("page_view", {
    screen: screenForPath(clean),
    page:
      pages[clean as keyof typeof pages] ??
      (clean.startsWith("/invoice/") ? "invoice" : "other"),
  });
}

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
  if (!analyticsAllowed()) {
    buffer = [];
    persist();
    return;
  }
  try {
    restore();
    const parsed = funnelPropsSchemas[event].safeParse(props ?? {});
    if (!parsed.success) {
      console.warn("Analytics event dropped: invalid props", event);
      return;
    }
    if (buffer.length >= maxBuffered) buffer.shift();
    buffer.push({
      event,
      props: parsed.data,
      at: Date.now(),
      id: crypto.randomUUID(),
      sessionId: documentSession,
      ...(account
        ? { scope: account.accountId, generation: accountGeneration }
        : {}),
    });
    persist();
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

/** Fetch acknowledges delivery; keepalive also permits navigation-time sends.
 * A blocked/offline/overloaded collector retries with the same event IDs. */
export function flush(unloading = false): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!analyticsAllowed()) {
    buffer = [];
    persist();
    return;
  }
  restore();
  if (unloading) persist(true);
  if (sending && !unloading) return;
  if (!unloading && Date.now() < nextSendAt) {
    schedule();
    return;
  }
  buffer = buffer.filter((e) => Date.now() - e.at < queueLifetime);
  let remaining = buffer.filter(
    (e) => !e.scope || account?.accountId === e.scope,
  );
  while (remaining.length) {
    const first = remaining[0];
    let events = remaining
      .filter(
        (e) => e.scope === first.scope && e.generation === first.generation,
      )
      .slice(0, MAX_EVENTS_PER_BATCH);
    const payload = () =>
      JSON.stringify({
        visitorId: visitorId(),
        ...(entryContext ? { context: entryContext } : {}),
        traffic: analyticsTraffic(),
        ...(first.scope
          ? {
              accountScope: first.scope,
              accountGeneration: first.generation ?? "initial",
            }
          : {}),
        events: events.map(
          ({ scope: _scope, generation: _generation, ...e }) => e,
        ),
      });
    let body = payload();
    while (
      new TextEncoder().encode(body).length > MAX_BATCH_BYTES &&
      events.length > 1
    ) {
      events = events.slice(0, Math.ceil(events.length / 2));
      body = payload();
    }
    const ids = new Set(events.map((e) => e.id));
    sending++;
    void fetch(endpoint, {
      method: "POST",
      body,
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(first.scope && account
          ? { Authorization: `Bearer ${account.token}` }
          : {}),
      },
    })
      .then((response) => {
        if (
          response.ok ||
          (response.status >= 400 &&
            response.status < 500 &&
            ![408, 429].includes(response.status))
        ) {
          buffer = buffer.filter((e) => !ids.has(e.id));
          retryMs = flushDelayMs;
          nextSendAt = 0;
        } else {
          retryMs = Math.min(60000, retryMs * 2);
          nextSendAt = Date.now() + retryMs;
        }
      })
      .catch(() => {
        retryMs = Math.min(60000, retryMs * 2);
        nextSendAt = Date.now() + retryMs;
      })
      .finally(() => {
        sending = Math.max(0, sending - 1);
        persist();
        schedule();
      });
    if (!unloading) break;
    remaining = remaining.filter((e) => !ids.has(e.id));
  }
}
function listen(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("online", () => flush());
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  // Fixed categories and app bundle coordinates; no error text or private URLs.
  window.addEventListener("error", (event) =>
    track("client_error", {
      ...errorDetails(event.error, event, location.origin),
      kind: "error",
      screen: screenForPath(location.pathname),
    }),
  );
  window.addEventListener("unhandledrejection", (event) =>
    track("client_error", {
      ...errorDetails(event.reason),
      kind: "unhandled_rejection",
      screen: screenForPath(location.pathname),
    }),
  );
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
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = null;
  timer = null;
  buffer = [];
  account = undefined;
  accountGeneration = "initial";
  contextVersion++;
  restored = false;
  sending = 0;
  retryMs = flushDelayMs;
  nextSendAt = 0;
  identity = undefined;
  entryContext = undefined;
}
