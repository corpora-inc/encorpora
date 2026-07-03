// src/journey/feed/advanceRules.ts — per-card-type advance rules
// (feed-ux §3.2). Pure + testable: the scroller consults this table after a
// card completes; auto-advance NEVER fires on a failed card and never past a
// manual-only card.

import type { AdvanceMode } from "../store.ts"
import type { FeedCard } from "../types.ts"

export type AdvanceRule =
  | { kind: "manual" } // checkpoint / rare reveal / poster / blockIntro
  | { kind: "swipe" } // commitment gesture
  | { kind: "auto"; delayMs: number }

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
  if (t === "intro_echo")
    return mode === "auto" ? { kind: "auto", delayMs: 1500 } : { kind: "swipe" }
  if (isListeningCard(card)) {
    if (mode === "auto" || opts.listeningRun) return { kind: "auto", delayMs: 800 }
    return { kind: "swipe" }
  }
  return mode === "auto" ? { kind: "auto", delayMs: 800 } : { kind: "swipe" }
}

/** Listening-run detection (§3.2): ≥2 consecutive listen_* cards queued. */
export function isListeningRunStart(current: FeedCard, next: FeedCard | null): boolean {
  return isListeningCard(current) && next !== null && isListeningCard(next)
}
