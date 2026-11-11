import { useEffect } from "react";
import { noteAttention, showHelpSurface } from "./student-activity";

/** While `active`, active time counts under this help surface. */
export function useHelpSurface(
  active: boolean,
  surface: "lesson" | "hint" | "video" | "example",
  problemId?: string,
) {
  useEffect(
    () => (active ? showHelpSurface({ surface, problemId }) : undefined),
    [active, surface, problemId],
  );
}

/** How often playing media renews attention: well inside the 60 s idle rule. */
const ATTENTION_EVERY_MS = 15_000;
/** Holds attention while media plays; returns the call that stops. */
export function attendWhilePlaying(): () => void {
  noteAttention();
  const timer = setInterval(noteAttention, ATTENTION_EVERY_MS);
  return () => {
    noteAttention();
    clearInterval(timer);
  };
}
