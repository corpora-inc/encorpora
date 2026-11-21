import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useSyncExternalStore } from "react";
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
  const look: Look | null = enabled
    ? (state.data?.effectiveLook ?? null)
    : null;
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    if (look !== "bold") return;
    const root = document.documentElement;
    root.setAttribute("data-look", "bold");
    return () => root.removeAttribute("data-look");
  }, [look, learner]);
  /** What to record on an answer: the look actually shown; null until known. */
  const shown: ShownLook | null = look ? shownLook(look, reduced) : null;
  return { look, shown };
}
