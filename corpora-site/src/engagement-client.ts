import { entryContext } from "../../amp/src/analytics/entry-context";
import { browserIdentity } from "../../amp/src/analytics/browser-identity";
import { marketingScreen } from "../../amp/src/analytics/site-actions";
import { EngagementClock } from "../../amp/src/analytics/engagement";

const script = document.querySelector<HTMLScriptElement>(
  "script[data-engagement-endpoint]",
);
const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
if (
  script?.dataset.engagementEndpoint &&
  !privacy.globalPrivacyControl &&
  navigator.doNotTrack !== "1"
) {
  const endpoint = script.dataset.engagementEndpoint;
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
  const send = (event: string, props: object) => {
    if (privacy.globalPrivacyControl || navigator.doNotTrack === "1") return;
    void fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        context,
        traffic: identity.internal()
          ? "internal"
          : navigator.webdriver
            ? "automated"
            : "external",
        events: [{ event, props, at: Date.now() }],
      }),
    }).catch(() => {});
  };
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
    window.addEventListener(event, snapshot);
  document.addEventListener("visibilitychange", snapshot);
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
    if (action)
      send("site_action", { eventId: crypto.randomUUID(), action, screen });
  });
  document
    .querySelector("[data-invoice-dialog]")
    ?.addEventListener("close", () => {
      send("site_action", {
        eventId: crypto.randomUUID(),
        action: "invoice_close",
        screen,
      });
    });
  snapshot();
}
