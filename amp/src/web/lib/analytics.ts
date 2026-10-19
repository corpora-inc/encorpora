import {
  type ClientEvent,
  type FunnelProps,
  MAX_BATCH_BYTES,
  MAX_EVENTS_PER_BATCH,
  REFERRER_CATEGORIES,
  DEVICE_CLASSES,
  funnelPropsSchemas,
} from "../../analytics/events";
import { storedTrial } from "./pending-trial";

/**
 * First-party funnel analytics. `track` only appends to an in-memory buffer;
 * the buffer is sent with `navigator.sendBeacon` after a short delay, when it
 * fills, and when the page is hidden. Nothing here can throw into the UI or
 * delay a screen. The visitor ID is a random UUID in this browser's storage:
 * it is not derived from, or sent with, any account, learner or contact.
 */
export const visitorKey = "amp.visitor";
export const firstVisitKey = "amp.visitor.first";
const sessionKey = "amp.visitor.session";
const endpoint = "/api/v1/events";
const flushDelayMs = 2000;
const maxBuffered = 200;

type Queued = { event: ClientEvent; props: unknown; at: number };
let buffer: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let memoryVisitor: string | null = null;
let listening = false;

function randomId(): string {
  return crypto.randomUUID();
}

/** This browser's random visitor ID, created on first use. */
export function visitorId(): string {
  try {
    const stored = localStorage.getItem(visitorKey);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
    const created = memoryVisitor ?? randomId();
    localStorage.setItem(visitorKey, created);
    localStorage.setItem(firstVisitKey, String(Date.now()));
    memoryVisitor = created;
    return created;
  } catch {
    // Storage is blocked: keep one ID for this page so a session still links.
    memoryVisitor ??= randomId();
    return memoryVisitor;
  }
}

/** Record one funnel event. Invalid props are dropped and logged. */
export function track<E extends ClientEvent>(
  event: E,
  ...[props]: FunnelProps<E> extends Record<string, never>
    ? [props?: FunnelProps<E>]
    : [props: FunnelProps<E>]
): void {
  try {
    const parsed = funnelPropsSchemas[event].safeParse(props ?? {});
    if (!parsed.success) {
      console.warn("Analytics event dropped: invalid props", event);
      return;
    }
    if (buffer.length >= maxBuffered) buffer.shift();
    buffer.push({ event, props: parsed.data, at: Date.now() });
    listen();
    if (buffer.length >= MAX_EVENTS_PER_BATCH) flush();
    else timer ??= setTimeout(flush, flushDelayMs);
  } catch (error) {
    console.warn("Analytics event dropped", event, error);
  }
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
  try {
    const trial = storedTrial();
    const body = JSON.stringify({
      visitorId: visitorId(),
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
  try {
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
  } catch {
    // Without session storage, count each page load as a session.
  }
  track("session_start", { daysSinceFirstVisit: daysSinceFirstVisit() });
}

type Referrer = (typeof REFERRER_CATEGORIES)[number];
const searchHosts =
  /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\./;
const socialHosts =
  /(^|\.)(facebook|instagram|t|x|twitter|linkedin|pinterest|reddit|youtube|tiktok|threads)\.(com|co|net)$/;
const mailHosts = /(^|\.)(mail\.google|outlook\.live|mail\.yahoo)\./;

/** A category for the referring site; the URL itself is never sent. */
export function referrerCategory(referrer: string, ownHost: string): Referrer {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === ownHost.toLowerCase()) return "internal";
  if (mailHosts.test(host)) return "email";
  if (searchHosts.test(host)) return "search";
  if (socialHosts.test(host)) return "social";
  return "other";
}

export function deviceClass(width: number, coarse: boolean) {
  const device: (typeof DEVICE_CLASSES)[number] =
    width < 600 ? "phone" : coarse && width < 1100 ? "tablet" : "desktop";
  return device;
}

/** Props for `landing_view` from the current URL, referrer and screen. */
export function landingProps(
  location: Pick<Location, "search" | "hostname"> = window.location,
  referrer = document.referrer,
): FunnelProps<"landing_view"> {
  const query = new URLSearchParams(location.search);
  const clean = (key: string) => {
    const value = query.get(key)?.trim().toLowerCase();
    return value && /^[a-z0-9._~-]{1,64}$/.test(value) ? value : undefined;
  };
  const utmSource = clean("utm_source");
  const utmMedium = clean("utm_medium");
  const utmCampaign = clean("utm_campaign");
  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return {
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    referrer: referrerCategory(referrer, location.hostname),
    device: deviceClass(window.innerWidth, coarse),
  };
}

/** Test seam: forget buffered events and the in-memory visitor. */
export function resetAnalyticsForTests(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  buffer = [];
  memoryVisitor = null;
}
