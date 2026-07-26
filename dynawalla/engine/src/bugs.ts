/**
 * Layer B — the misconception tracker.
 *
 *   β ← 0.9·β + 1{bug fired},  active at β ≥ 2.2
 *
 * It **never subtracts from θ**. It gates mastery and triggers repair, and that
 * separation is deliberate: a child with a consistent buggy procedure is not less
 * able, they are doing something specific and fixable, and an engine that punishes
 * θ for it makes the whole model read as "you are bad at this".
 *
 * Slip versus misconception is decided here too. Four discriminators are named in
 * ADAPTIVE_LEARNING.md; the cleanest is **self-correction** — revisions > 0 and
 * then correct is a slip, and never increments a bug.
 */

import { BUG_ACTIVE_THRESHOLD, BUG_DECAY, LATENCY_Z_NO_IDEA, LATENCY_Z_SLIP, MAX_TRACKED_BUGS } from "./constants.ts";
import { ONE, add, mul } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { NEW_BUG_STATE } from "./types.ts";
import type { AttemptOutcome, BugState } from "./types.ts";

export type ErrorKind = "slip" | "misconception" | "unclassified";

/**
 * What kind of error this was.
 *
 * A self-corrected answer is a slip whatever else is true — that is the cleanest
 * signal available and it costs nothing to honour. A matched mal-rule is a
 * misconception. Everything else is unclassified, which routes to a faded worked
 * example rather than to a contrast pair the child may not need.
 */
export function classifyError(outcome: AttemptOutcome): ErrorKind {
  if (outcome.correct) return outcome.revisions > 0 ? "slip" : "unclassified";
  if (outcome.revisions > 0) return "slip";
  return outcome.misconception === undefined ? "unclassified" : "misconception";
}

/** `β ← 0.9·β + 1{fired}`. */
export function updateBug(state: BugState | undefined, fired: boolean): BugState {
  const current = state ?? NEW_BUG_STATE;
  const decayed = mul(BUG_DECAY, current.beta);
  return {
    beta: fired ? add(decayed, ONE) : decayed,
    firings: current.firings + (fired ? 1 : 0),
  };
}

export function isBugActive(state: BugState | undefined): boolean {
  return state !== undefined && state.beta >= BUG_ACTIVE_THRESHOLD;
}

/**
 * How many firings in a row it takes to activate a bug, given the decay. Exposed
 * because the Stage-2 threshold is a claim about the child's experience — "after
 * about three of these you will see a contrast pair" — and it should be checkable
 * rather than folklore.
 */
export function firingsToActivate(): number {
  let state: BugState | undefined;
  for (let count = 1; count <= 32; count++) {
    state = updateBug(state, true);
    if (isBugActive(state)) return count;
  }
  return -1;
}

/**
 * Keep the tracker sparse and hard-capped: state may not grow with use (EG-3).
 * When the cap is reached the weakest entry is dropped, because a decayed β is by
 * construction the least current evidence.
 */
export function pruneBugs(bugs: Readonly<Record<string, BugState>>): Record<string, BugState> {
  const entries = Object.entries(bugs);
  if (entries.length <= MAX_TRACKED_BUGS) return { ...bugs };
  const kept = entries
    .sort((a, b) => (b[1].beta === a[1].beta ? a[0].localeCompare(b[0]) : b[1].beta - a[1].beta))
    .slice(0, MAX_TRACKED_BUGS);
  return Object.fromEntries(kept);
}

/** Latency shape: slips are fast, misconceptions are confident, "no idea" is slow. */
export function latencyShape(z: Fix): "fast" | "confident" | "stalled" {
  if (z < LATENCY_Z_SLIP) return "fast";
  if (z < LATENCY_Z_NO_IDEA) return "confident";
  return "stalled";
}
