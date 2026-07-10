// src/journey/feed/advanceRules.ts — per-card-type advance rules
// (feed-ux §3.2). Pure + testable: the scroller consults this table after a
// card completes; auto-advance NEVER fires on a failed card and never past a
// manual-only card.

import type { AdvanceMode } from "../../store/journey.ts"
import type { FeedCard } from "../types.ts"

export type AdvanceRule =
  | { kind: "manual" } // checkpoint / rare reveal / poster / blockIntro
  | { kind: "swipe" } // commitment gesture
  | { kind: "button" } // explicit Continue/submit press advances immediately
  | { kind: "auto"; delayMs: number }

/** Answer-tap cards auto-advance this long after settle, riding the existing
 *  countdown ring (contract #6). Snappy but leaves time to read the stamp. */
export const ANSWER_AUTO_MS = 2200

const LISTEN_TYPES = new Set(["listen_pick", "listen_type"])

export function isListeningCard(card: FeedCard): boolean {
  if (card.kind !== "exercise") return false
  if (LISTEN_TYPES.has(card.spec.activityType)) return true
  // match_pairs text-audio axis is a listening card for advance rules.
  return (
    card.spec.activityType === "match_pairs" && card.spec.params?.axis === "text-audio"
  )
}

export function advanceRule(
  card: FeedCard,
  mode: AdvanceMode,
  opts: { listeningRun?: boolean; failed?: boolean } = {},
): AdvanceRule {
  if (opts.failed) return { kind: "swipe" } // §3.3 owns the failure flow
  switch (card.kind) {
    case "checkpoint":
      return { kind: "manual" }
    case "jumpOffer":
      return { kind: "manual" }
    case "blockIntro":
      return { kind: "manual" } // model load + mic consent must be deliberate
    case "packActivity":
      return { kind: "manual" } // tap Play or swipe past
    case "welcomeBack":
      return mode === "auto" ? { kind: "auto", delayMs: 2000 } : { kind: "swipe" }
    case "capability":
      return { kind: "swipe" }
    case "exercise":
      break
  }
  if (card.rare) return { kind: "manual" } // anticipation is never rushed
  const t = card.spec.activityType
  if (t === "speak_echo") return { kind: "auto", delayMs: 1000 } // hands/mouth busy
  // Explicit-completion cards: the learner presses Continue (intro_echo) or
  // reveals + continues (flip_recall). That press advances immediately in
  // every mode (contract #6 (a)) — no lingering settled card to swipe past.
  if (t === "intro_echo" || t === "flip_recall") return { kind: "button" }
  if (isListeningCard(card)) {
    if (mode === "auto" || opts.listeningRun) return { kind: "auto", delayMs: ANSWER_AUTO_MS }
    return { kind: "swipe" }
  }
  // Answer-tap cards (choice/cloze/word_order/match): auto-advance after a
  // short countdown in auto mode (the flipped default); swipe mode waits.
  return mode === "auto" ? { kind: "auto", delayMs: ANSWER_AUTO_MS } : { kind: "swipe" }
}

/** Listening-run detection (§3.2): ≥2 consecutive listen_* cards queued. */
export function isListeningRunStart(current: FeedCard, next: FeedCard | null): boolean {
  return isListeningCard(current) && next !== null && isListeningCard(next)
}
