/**
 * The difficulty controller.
 *
 *   pTarget ← clamp(pTarget + 0.06·fail − 0.015·pass, 0.70, 0.92)
 *
 * updated **per item**, with the batch re-planned on any invariant trip rather
 * than served to completion — otherwise a correction lands one batch late and
 * reads to the child as the app randomly getting easy and then hard.
 *
 * The target is 0.80, not Wilson's 0.85: that rule is derived for stochastic-
 * gradient binary classifiers and its authors scope it there. The closest real
 * prior art, Math Garden, samples at 0.75 across 3,648 children.
 */

import {
  CONFIDENCE_OFFSET,
  FATIGUE_P_TARGET,
  FRUSTRATION_OFFSET,
  P_TARGET_DEFAULT,
  P_TARGET_DOWN_ON_PASS,
  P_TARGET_MAX,
  P_TARGET_MIN,
  P_TARGET_UP_ON_FAIL,
  STRETCH_OFFSET,
} from "./constants.ts";
import { ONE, ZERO, add, clamp, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";

export { P_TARGET_DEFAULT, P_TARGET_MAX, P_TARGET_MIN };

/** One item's effect on the target. */
export function updatePTarget(pTarget: Fix, correct: boolean): Fix {
  const moved = correct ? sub(pTarget, P_TARGET_DOWN_ON_PASS) : add(pTarget, P_TARGET_UP_ON_FAIL);
  return clamp(moved, P_TARGET_MIN, P_TARGET_MAX);
}

/** Fatigue does not lower the target; it raises it and stops introducing anything new. */
export function fatiguedPTarget(): Fix {
  return FATIGUE_P_TARGET;
}

export type CardIntent = "stretch" | "steady" | "confidence";

/**
 * The success probability a card of this intent should have, **as an offset from
 * `pTarget`** and never as an absolute number.
 *
 * This is the boundary conflict the first draft of the plan had: "one stretch
 * item" means `pTarget − 0.07`, not a fixed 0.85 that is a stretch at the top of
 * the clamp and a gift at the bottom of it.
 */
export function targetFor(pTarget: Fix, intent: CardIntent): Fix {
  const offset = intent === "stretch" ? STRETCH_OFFSET : intent === "confidence" ? CONFIDENCE_OFFSET : ZERO;
  return clamp(add(pTarget, offset), ZERO, ONE);
}

/** Below this, two in a row is the anti-frustration trip wire. */
export function frustrationFloor(pTarget: Fix): Fix {
  return clamp(add(pTarget, FRUSTRATION_OFFSET), ZERO, ONE);
}

/**
 * The intents of a batch, in order. First and last card of a session are at
 * `pTarget + 0.10`, and every batch carries at least one stretch item once a skill
 * is Practiced (the anti-stagnation rule).
 *
 * The confidence cards are placed first and the stretch takes a slot neither of them
 * claims, because both rules are stated as invariants and writing the stretch first
 * would let a confidence card overwrite it — silently, and only for small batches,
 * which is the shape of bug that survives until something else depends on it.
 * `BATCH_SIZE` is 8, so a batch that cannot hold all three is a caller error.
 */
export function batchIntents(size: number, options: { first: boolean; last: boolean; anyPracticed: boolean }): CardIntent[] {
  if (size <= 0) throw new RangeError("batchIntents: empty batch");
  const intents: CardIntent[] = new Array<CardIntent>(size).fill("steady");
  if (options.first) intents[0] = "confidence";
  if (options.last) intents[size - 1] = "confidence";

  if (options.anyPracticed) {
    const preferred = Math.min(size - 1, Math.floor(size / 2));
    let slot = -1;
    for (let offset = 0; offset < size && slot < 0; offset++) {
      if (intents[(preferred + offset) % size] === "steady") slot = (preferred + offset) % size;
    }
    if (slot < 0) {
      throw new RangeError(`batchIntents: a batch of ${String(size)} has no room for a stretch card`);
    }
    intents[slot] = "stretch";
  }

  return intents;
}
