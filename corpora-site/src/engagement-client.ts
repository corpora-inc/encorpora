import { createMarketingDelivery } from "./engagement-delivery";
import { entryContext } from "../../amp/src/analytics/entry-context";
import { browserIdentity } from "../../amp/src/analytics/browser-identity";
import { marketingScreen } from "../../amp/src/analytics/site-actions";
import { EngagementClock } from "../../amp/src/analytics/engagement";
import { createGoogleAnalytics } from "../../amp/src/analytics/google-analytics";

const script = document.querySelector<HTMLScriptElement>(
  "script[data-engagement-endpoint]",
);
const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
if (
  script?.dataset.engagementEndpoint &&
  !privacy.globalPrivacyControl &&
  navigator.doNotTrack !== "1"
) {
  const google = createGoogleAnalytics();
  google.navigate();
  const endpoint = script.dataset.engagementEndpoint;
  const deliver = createMarketingDelivery();
  const identity = browserIdentity(),
    visitorId = identity.visitor();
  const sessionId = crypto.randomUUID();
  let pageId = crypto.randomUUID(),
    day = new Date().toISOString().slice(0, 10),
    ordinal = 0;
  const screen = marketingScreen(location.pathname);
  const context = identity.context(
    entryContext({
      search: location.search,
      hostname: location.hostname,
      referrer: document.referrer,
      width: innerWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
    }),
  );
  const visible = () =>
    document.visibilityState === "visible" &&
    document.hasFocus() &&
    !(document.activeElement instanceof HTMLIFrameElement);
  let clock = new EngagementClock(performance.now(), visible());
  let lastActive = -1,
    lastVisible = -1;
  type Event = {
    event: string;
    props: object;
    at: number;
    id: string;
    sessionId: string;
  };
  let pending: Event[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = 0,
    delay = 2000;
  const flush = (unloading = false) => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (privacy.globalPrivacyControl || navigator.doNotTrack === "1") {
      pending = [];
      return;
    }
    if ((busy && !unloading) || !pending.length) return;
    let remaining = pending.slice();
    while (remaining.length) {
      let events = remaining.slice(0, 25);
      const encode = () =>
        JSON.stringify({
          visitorId,
          context,
          traffic: identity.internal()
            ? "internal"
            : navigator.webdriver
              ? "automated"
              : "external",
          events,
        });
      let body = encode();
      while (
        new TextEncoder().encode(body).length > 8192 &&
        events.length > 1
      ) {
        events = events.slice(0, Math.ceil(events.length / 2));
        body = encode();
      }
      const ids = new Set(events.map((e) => e.id));
      busy++;
      void deliver(endpoint, body)
        .then((response) => {
          if (
            response.ok ||
            (response.status >= 400 &&
              response.status < 500 &&
              ![408, 429].includes(response.status))
          ) {
            pending = pending.filter((e) => !ids.has(e.id));
            delay = 2000;
          } else delay = Math.min(60000, delay * 2);
        })
        .catch(() => {
          delay = Math.min(60000, delay * 2);
        })
        .finally(() => {
          busy--;
          if (pending.length) timer ??= setTimeout(flush, delay);
        });
      if (!unloading) break;
      remaining = remaining.filter((e) => !ids.has(e.id));
    }
  };
  const send = (event: string, props: object) => {
    if (privacy.globalPrivacyControl || navigator.doNotTrack === "1") return;
    pending = pending.filter((e) => Date.now() - e.at < 86400000).slice(-24);
    pending.push({
      event,
      props,
      at: Date.now(),
      id: crypto.randomUUID(),
      sessionId,
    });
    // Navigation may close this document before a batch timer runs. User
    // actions are infrequent and start a nonblocking keepalive send immediately.
    if (event === "site_action") flush(true);
    else timer ??= setTimeout(flush, 2000);
  };
  window.addEventListener("online", () => flush());
  const snapshot = () => {
    const nextDay = new Date().toISOString().slice(0, 10);
    if (nextDay !== day) {
      if (!visible()) return;
      day = nextDay;
      pageId = crypto.randomUUID();
      ordinal++;
      clock = new EngagementClock(performance.now(), visible());
      lastActive = lastVisible = -1;
    }
    clock.sample(performance.now(), visible());
    const activeMs = Math.floor(clock.activeMs),
      visibleMs = Math.floor(clock.visibleMs);
    if (activeMs === lastActive && visibleMs === lastVisible) return;
    lastActive = activeMs;
    lastVisible = visibleMs;
    send("page_engagement", {
      sessionId,
      pageId,
      ordinal,
      screen,
      activeMs,
      visibleMs,
    });
  };
  const activity = () => clock.sample(performance.now(), visible(), true);
  for (const event of ["pointerdown", "keydown", "scroll", "touchstart"])
    window.addEventListener(event, activity, { passive: true });
  window.addEventListener("focus", activity);
  for (const event of ["blur", "pagehide"])
    window.addEventListener(event, () => {
      snapshot();
      flush(true);
    });
  document.addEventListener("visibilitychange", () => {
    snapshot();
    if (document.visibilityState === "hidden") flush(true);
  });
  setInterval(() => {
    if (visible()) snapshot();
  }, 15000);
  document.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element ? event.target.closest("a,button") : null;
    if (!target) return;
    let action: string | undefined;
    if (target.matches('[data-invoice-form="open"]')) action = "invoice_open";
    else if (target instanceof HTMLAnchorElement) {
      const u = new URL(target.href, location.href);
      if (
        u.protocol === "mailto:" &&
        u.pathname.toLowerCase() === "support@corpora.inc"
      )
        action = "support_click";
      else if (u.hostname === "amp.corpora.inc")
        action = u.pathname.startsWith("/invoice")
          ? "invoice_open"
          : u.pathname.startsWith("/try")
            ? "assessment_click"
            : "product_click";
      else if (u.hostname.endsWith(".classwallet.com"))
        action = "funding_provider_click";
      else if (u.origin === location.origin) action = "navigation_click";
    }
    if (action) {
      google.event(action);
      send("site_action", { eventId: crypto.randomUUID(), action, screen });
    }
  });
  document
    .querySelector("[data-invoice-dialog]")
    ?.addEventListener("close", () => {
      google.event("invoice_close");
      send("site_action", {
        eventId: crypto.randomUUID(),
        action: "invoice_close",
        screen,
      });
    });
  snapshot();
}
