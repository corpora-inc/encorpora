// src/journey/feed/settle.ts — pure settle decisions for ActivityCardHost.
// Extracted so the "no fake correcto" invariant (W3) is unit-testable without
// a React renderer: unscored cards settle NEUTRALLY (no stamp, no juice); the
// Continue press only advances (feed-ux §3.1).

export type SettleAttempt = "first" | "retry" | "failed"

/**
 * speak_echo owns its OWN retry loop inside the cap-pronounce round (the mic
 * stays live between attempts; the learner re-records freely, reads the
 * per-word + score feedback, then presses the card's Continue). So its
 * onOutcome is a FINAL, single-shot decision — never a first miss to route
 * through the tap/type scaffold (which would flash "incorrect" and demand a
 * second Continue press on a low score: the old speak brick). Everything else
 * keeps the scaffold retry.
 */
export function isSingleShotSettle(activityType: string): boolean {
  return activityType === "speak_echo"
}

/**
 * The settle attempt tier for a single-shot card given its pass fraction: a
 * pass (≥ 0.6) settles as `first`, a low score as `failed`. Either way it
 * settles in ONE call — the learner is never trapped by a low score.
 */
export function singleShotAttempt(fraction: number): SettleAttempt {
  return fraction >= 0.6 ? "first" : "failed"
}

export interface StampInput {
  attempt: SettleAttempt
  /** 0..1 fraction of the card answered correctly. */
  fraction: number
  /** engine meta.unscored — presentation/debut cards that never grade. */
  unscored: boolean
}

/**
 * The stamp a settled card shows. Unscored cards return `null` (neutral): a
 * green "correcto" on a card that never graded is dishonest juice — the intro
 * echo just displays + advances. Scored cards stamp correct/incorrect.
 */
export function settleStamp(i: StampInput): "correct" | "incorrect" | null {
  if (i.unscored) return null
  if (i.attempt === "failed") return "incorrect"
  return i.fraction >= 0.6 ? "correct" : "incorrect"
}

/** Whether a settled card counts as a pass (feeds review adornment + juice). */
export function settleOk(attempt: SettleAttempt, fraction: number): boolean {
  return attempt !== "failed" && fraction >= 0.6
}

export interface CelebrationInput {
  attempt: SettleAttempt
  fraction: number
  unscored: boolean
  /** Answered within the "fast" latency budget (host FAST_MS). */
  fast: boolean
  hintsUsed: number
  /** Current combo BEFORE this card. */
  combo: number
}

export type CelebrationDecision = {
  tier: 0 | 1
  comboCount: number
  /** A clean, fast, hint-free first try (≥0.95) — earns extra flair on top of
   *  the combo-scaled base. NOT a gate: an ordinary pass still celebrates. */
  perfect: boolean
} | null

/**
 * The celebration a settled LIVE card fires, or `null` for none. Only two things
 * suppress it: an UNSCORED card (celebrating mere exposure is dishonest) and a
 * NON-PASS (celebrating a miss is dishonest). EVERYTHING ELSE CELEBRATES — this
 * is the dopamine loop: every correct answer gets juice, and it ESCALATES with
 * the streak (the effect layer reads `comboCount` to grow a small combo-1 pop
 * into combo-10 explosions, block-game style). The old logic only lit up a
 * "perfect" fast first-try and left every slower/hinted correct silent (tier 0
 * = no visual) — which is why a deliberate card like word-order felt dead. We
 * always carry `comboCount`, and flag `perfect` for a bonus flourish (bonus, not
 * a gate).
 */
export function celebrationFor(i: CelebrationInput): CelebrationDecision {
  if (i.unscored || !settleOk(i.attempt, i.fraction)) return null
  const perfect = i.attempt === "first" && i.fast && i.hintsUsed === 0 && i.fraction >= 0.95
  return { tier: 1, comboCount: i.combo + 1, perfect }
}
