import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { shownLook, type Look, type ShownLook } from "../../../learning/look";
import { mediaMatches, onMediaChange } from "../../lib/media-query";
import {
  practiceSettingsOptions,
  type PracticeScope,
} from "./practice-settings";
import {
  clearHue,
  colorfulSupported,
  paintHue,
  useHueStore,
} from "./celebration/hue";

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Whether this device asks for less motion, live. */
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    (notify) => onMediaChange(REDUCED, notify),
    () => mediaMatches(REDUCED),
    () => false,
  );

/** Every host that asks for Colorful right now (practice, a student's own
 * screens). The attribute stays while any one does, so a host leaving (a
 * child going from practice to their standings) never takes it from the
 * next one, and goes with the last. */
let holders = 0;
function holdBold(learner: string) {
  const root = document.documentElement;
  holders++;
  // The learner's latest world, until practice moves it on.
  if (!root.style.getPropertyValue("--look-hue"))
    paintHue(useHueStore.getState().latest(learner));
  root.setAttribute("data-look", "bold");
  return () => {
    holders = Math.max(0, holders - 1);
    if (holders > 0) return;
    root.removeAttribute("data-look");
    clearHue();
  };
}
/** Checked once: a browser without oklch() and registered properties
 * shows Calm, and the answer records Calm. */
let supported: boolean | null = null;
const canShowColorful = () => (supported ??= colorfulSupported());

const LOOK_ATTRIBUTE = { attributes: true, attributeFilter: ["data-look"] };
/** The look on screen now (what `<html>` paints), live: the one thing a
 * celebration asks before it plays, so nothing plays in Calm. */
export function useLookOnScreen(): "calm" | "bold" {
  return useSyncExternalStore(
    (notify) => {
      if (typeof MutationObserver === "undefined") return () => {};
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, LOOK_ATTRIBUTE);
      return () => observer.disconnect();
    },
    () =>
      document.documentElement.getAttribute("data-look") === "bold"
        ? "bold"
        : "calm",
    () => "calm",
  );
}

/**
 * The look for the learner on screen, from the practice-state query, and
 * `data-look="bold"` on `<html>` while a practice host that `enabled` it is
 * mounted (tokens.css reads it at `:root`, as it does `data-theme`; see
 * features/design/theme.ts). Calm sets nothing. The attribute goes when the
 * host unmounts, practice is left, or the learner changes, so one child's
 * look never paints another's screen.
 */
export function useLook(scope: PracticeScope, enabled = true) {
  const learner = scope.learnerId;
  const state = useQuery({
    ...practiceSettingsOptions(scope),
    enabled: enabled && !!learner,
  });
  const chosen = enabled ? (state.data?.effectiveLook ?? null) : null;
  const look: Look | null =
    chosen === "bold" && !canShowColorful() ? "calm" : chosen;
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    if (look !== "bold") return;
    return holdBold(learner);
  }, [look, learner]);
  /** What to record on an answer: the look actually shown; null until known. */
  const shown: ShownLook | null = look ? shownLook(look, reduced) : null;
  return { look, shown };
}
