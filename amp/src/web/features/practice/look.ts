import { useQuery } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { shownLook, type Look, type ShownLook } from "../../../learning/look";
import { mediaMatches, onMediaChange } from "../../lib/media-query";
import {
  practiceSettingsOptions,
  type PracticeScope,
} from "./practice-settings";
const REDUCED = "(prefers-reduced-motion: reduce)";
/** Whether this device asks for less motion, live. */
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    (notify) => onMediaChange(REDUCED, notify),
    () => mediaMatches(REDUCED),
    () => false,
  );

/** Colorful's dress: its hue code and stylesheet, fetched only when a
 * learner's look is Colorful (a Calm learner never downloads them). */
const loadDress = () => import("./celebration/dress");
/** Whether this browser can draw Colorful: oklch() colors and registered
 * properties. Without them, Calm is shown (and recorded). */
function colorfulSupported() {
  try {
    return (
      typeof CSS !== "undefined" &&
      "registerProperty" in CSS &&
      // tokens.css's own feature query: oklch() with calc() in its hue.
      getComputedStyle(document.documentElement)
        .getPropertyValue("--colorful-unsupported")
        .trim() === ""
    );
  } catch (error) {
    console.warn("Colorful's support check failed; Calm shows", error);
    return false;
  }
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
  useEffect(() => {
    if (look !== "bold") return;
    let release: (() => void) | undefined;
    let gone = false;
    loadDress().then(
      (dress) => {
        if (gone) return;
        release = dress.holdBold(learner);
      },
      (error: unknown) => console.warn("Colorful's dress didn’t load", error),
    );
    return () => {
      gone = true;
      release?.();
    };
  }, [look, learner]);
  /** What to record on an answer: the look actually shown; null until known. */
  const shown: ShownLook | null = look ? shownLook(look, reduced) : null;
  return { look, shown };
}
