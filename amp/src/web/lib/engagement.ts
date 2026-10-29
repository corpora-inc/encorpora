import { EngagementClock, screenForPath } from "../../analytics/engagement";
import {
  analyticsAllowed,
  onAnalyticsScopeChanging,
  analyticsSessionId,
  trackPageView,
  flush,
  initializeAnalyticsContext,
  track,
} from "./analytics";

/** One document session; SPA transitions are ordered pages within it. */
export function startEngagement() {
  if (!analyticsAllowed())
    return { navigate: (_path: string) => {}, stop: () => {} };
  initializeAnalyticsContext();
  const sessionId = analyticsSessionId();
  let ordinal = -1;
  let pageId = "";
  let path = "";
  let day = "";
  let stopped = false;
  let sentVisible = -1,
    sentActive = -1;
  let clock: EngagementClock;
  const visible = () =>
    document.visibilityState === "visible" && document.hasFocus();
  function snapshot() {
    if (!pageId || stopped) return;
    clock.sample(performance.now(), visible());
    const activeMs = Math.floor(clock.activeMs),
      visibleMs = Math.floor(clock.visibleMs);
    if (activeMs === sentActive && visibleMs === sentVisible) return;
    sentActive = activeMs;
    sentVisible = visibleMs;
    track("page_engagement", {
      sessionId,
      pageId,
      ordinal,
      screen: screenForPath(path),
      activeMs,
      visibleMs,
    });
  }
  function navigate(next: string) {
    const clean = next.split(/[?#]/)[0];
    const today = new Date().toISOString().slice(0, 10);
    if (stopped || (path === clean && today === day)) return;
    snapshot();
    path = clean;
    trackPageView(clean);
    day = today;
    pageId = crypto.randomUUID();
    sentVisible = sentActive = -1;
    ordinal++;
    clock = new EngagementClock(performance.now(), visible());
    snapshot();
  }
  const unsubscribeScope = onAnalyticsScopeChanging(() => {
    snapshot();
    pageId = crypto.randomUUID();
    ordinal++;
    sentVisible = sentActive = -1;
    clock = new EngagementClock(performance.now(), visible());
  });
  const interact = () => clock?.sample(performance.now(), visible(), true);
  const change = () => {
    snapshot();
    flush(document.visibilityState === "hidden");
  };
  const timer = setInterval(() => {
    if (visible()) {
      navigate(location.pathname);
      snapshot();
    }
  }, 15000);
  const interactions = [
    "pointerdown",
    "keydown",
    "scroll",
    "touchstart",
  ] as const;
  for (const e of interactions)
    window.addEventListener(e, interact, { passive: true });
  window.addEventListener("focus", interact);
  window.addEventListener("blur", change);
  window.addEventListener("pagehide", change);
  document.addEventListener("visibilitychange", change);
  navigate(location.pathname);
  return {
    navigate,
    stop() {
      change();
      stopped = true;
      unsubscribeScope();
      clearInterval(timer);
      for (const e of interactions) window.removeEventListener(e, interact);
      window.removeEventListener("focus", interact);
      window.removeEventListener("blur", change);
      window.removeEventListener("pagehide", change);
      document.removeEventListener("visibilitychange", change);
    },
  };
}
