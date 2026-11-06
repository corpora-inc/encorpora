import { useEffect, type RefObject } from "react";
import { trackOnce } from "../../lib/analytics";

const kinds = {
  pointerdown: "pointer",
  touchstart: "pointer",
  keydown: "key",
  wheel: "scroll",
  scroll: "scroll",
} as const;
type InputType = keyof typeof kinds;

/**
 * Two signals that separate parents from scanners and show whether a parent
 * reached Buy. Each fires once, then its listener or observer is gone, and both
 * go through the normal batched queue, so the page does no ongoing work.
 */
export function usePitchAttention(
  actions: RefObject<HTMLElement | null>,
  buySelector: string,
  refreshKey: string,
) {
  useEffect(() => {
    const types = Object.keys(kinds) as InputType[];
    const stop = () =>
      types.forEach((type) =>
        window.removeEventListener(type, seen, { capture: true }),
      );
    function seen(event: Event) {
      if (!event.isTrusted) return;
      stop();
      trackOnce("first-interaction", "first_interaction", {
        kind: kinds[event.type as InputType],
      });
    }
    types.forEach((type) =>
      window.addEventListener(type, seen, { capture: true, passive: true }),
    );
    return stop;
  }, []);
  useEffect(() => {
    const buy = actions.current?.querySelector(buySelector);
    if (!buy || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        trackOnce("pitch-buy-seen", "pitch_buy_seen", {});
      },
      { threshold: 0.5 },
    );
    observer.observe(buy);
    return () => observer.disconnect();
  }, [refreshKey]);
}
