import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { shownLook, type Look, type ShownLook } from "../../../learning/look";
import { mediaMatches, onMediaChange } from "../../lib/media-query";
import { settleChipRoom } from "./chip-room";
import { holdLook, lookReleases, lookWaits, onLookRelease } from "./look-feed";
import {
  canShowColorful,
  clearAhead,
  dressAhead,
  rememberLook,
} from "./look-ahead";
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
 * learner's look is Colorful (a Calm learner never downloads them). Once in
 * hand it goes on in the commit that needs it, before that commit paints:
 * the router fetches it ahead for a Colorful learner (look-first.ts). */
type Dress = typeof import("./celebration/dress");
let dress: Dress | null = null;
export const loadDress = () =>
  import("./celebration/dress").then((module) => (dress = module));
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
  const answered: Look | null =
    chosen === "bold" && !canShowColorful() ? "calm" : chosen;
  /** The look this screen last put on for this learner: its first is its
   * own arrival; a different one later is a change made somewhere else. */
  const known = useRef<{ learner: string; look: Look } | null>(null);
  // A change made somewhere else while an answer's feedback is on screen
  // waits for the next problem (look-feed.ts), which renders this again.
  useSyncExternalStore(onLookRelease, lookReleases, lookReleases);
  const worn = known.current?.learner === learner ? known.current.look : null;
  const waits = !!answered && !!worn && worn !== answered && lookWaits();
  if (waits) holdLook();
  const look: Look | null = waits ? worn : answered;
  /** The one color they keep in Colorful; null moves on with each problem. */
  const kept = look === "bold" ? (state.data?.lookHue ?? null) : null;
  const reduced = usePrefersReducedMotion();
  // What this device remembers of the learner's look goes on in the commit
  // that first paints their screen, before the server answers (look-ahead.ts).
  useLayoutEffect(() => {
    if (!enabled || !learner) return;
    return dressAhead(learner);
  }, [enabled, learner]);
  const keptNow = useRef(kept);
  keptNow.current = kept;
  /** The look on screen is one that waited for the next problem. */
  const waited = useRef(false);
  // In the commit, before it paints: with the answer and the dress read
  // ahead (look-first.ts), a learner's first frame is already their look.
  // Neither in hand yet (a screen opened without the router), the dress
  // goes on when it arrives, as before.
  useLayoutEffect(() => {
    if (look === "calm" && learner) {
      // The server's answer: Calm. Nothing remembered may say otherwise.
      rememberLook(learner, null);
      clearAhead();
    }
    // The chip's room is settled with the look where the look comes with
    // the screen or with a problem (chip-room.ts); a look that changes
    // under an open problem leaves the room as that problem has it.
    const fresh = known.current?.learner !== learner || waited.current;
    waited.current = false;
    if (look && learner) known.current = { learner, look };
    if (look === "calm" && fresh) settleChipRoom();
    if (look !== "bold") return;
    let release: (() => void) | undefined;
    let gone = false;
    const wear = (on: Dress) => {
      release = on.holdBold(learner, keptNow.current);
      if (fresh) settleChipRoom();
    };
    if (dress) wear(dress);
    else
      loadDress().then(
        (loaded) => {
          if (gone) return;
          wear(loaded);
        },
        (error: unknown) => console.warn("Colorful's dress didn’t load", error),
      );
    return () => {
      gone = true;
      release?.();
    };
  }, [look, learner]);
  // After the look's own effect, which reads it: a look that waited comes
  // with a problem.
  useLayoutEffect(() => {
    waited.current = waits;
  }, [waits]);
  // A color kept (or changed) while the dress is on goes on the page at
  // once, on every screen that wears it. Letting it go changes nothing
  // until the next problem brings its own.
  useEffect(() => {
    if (look !== "bold" || kept === null || !learner) return;
    loadDress().then(
      (loaded) => loaded.keepHue(learner, kept),
      (error: unknown) => console.warn("Colorful's dress didn’t load", error),
    );
  }, [look, kept, learner]);
  /** What to record on an answer: the look actually shown; null until known. */
  const shown: ShownLook | null = look ? shownLook(look, reduced) : null;
  return { look, shown };
}
