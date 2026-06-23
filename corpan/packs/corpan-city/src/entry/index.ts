/**
 * Corpan City — ENTRY orchestration (the front door).
 *
 * This module makes the world FULLY reactive to the Corpán language stack. It is
 * the single seam `game.ts` calls to (a) DERIVE the `learnerPair` from the live
 * stack instead of the hardcoded quest JSON, (b) run the premium welcome and —
 * for multi-target stacks — the language-chooser interlude, and (c) keep the
 * world bound to the stack as it changes (exit → flip stack in Corpán → return).
 *
 * It owns ONLY `src/entry/*`. It reuses the world's existing seams read-only:
 *   - the host stack API (`getStackConfig` / `onStackConfigChange`) via stackAdapter,
 *   - the same fullscreen-DOM lifecycle the onboarding card + vignette host use,
 *     mounting into the host's accepted surface (the `.wp-overlay`).
 *
 * SINGLE_LANGUAGE_RULE: a 1-language stack is an immersion pair (target === native);
 * the chooser is skipped (one target ⇒ no choice), the welcome reads "practice".
 *
 * See `INTEGRATION.md` (this dir) for the exact `game.ts` wiring.
 */

import type { LearnerPair } from "@corpan-city/contracts"
import {
  type StackConfig,
  readStack,
  targetsOf,
  pairFor,
  defaultPairFor,
  subscribeStack,
  samePair,
  DEFAULT_PAIR,
} from "./stackAdapter"
import { showLanguageChooser, showWelcome, type SurfaceOptions } from "./surfaces"

export { DEFAULT_PAIR, samePair, isImmersion } from "./stackAdapter"
export type { StackConfig } from "./stackAdapter"

export interface ResolveEntryOptions extends SurfaceOptions {
  /** The host (real Corpán HostApi or undefined in standalone dev). */
  host: unknown
  /** The surface to mount the welcome / chooser into (the `.wp-overlay`). */
  container: HTMLElement
  /** Skip the chooser + welcome UI (e.g. a reactive re-resolve after a stack
   *  flip mid-session — we just want the new pair, no interstitials). */
  silent?: boolean
}

export interface EntryResolution {
  /** The pair the world should bind to this session. */
  learnerPair: LearnerPair
  /** The live stack we derived it from (null in standalone dev with no host). */
  stack: StackConfig | null
  /** The target chosen (when a chooser ran) — same as `learnerPair.target`. */
  chosenTarget: string
}

/**
 * Resolve the session's `learnerPair` from the live stack, running the premium
 * entry UI:
 *   - read the stack → compute the available TARGET languages,
 *   - 0/1 target  → no chooser; brief premium WELCOME (immersion when 1 language),
 *   - >1 target   → fullscreen language CHOOSER, then the WELCOME for the pick.
 *
 * `silent: true` skips all UI and just returns the default pair for the stack —
 * used by the reactive path when the stack flips mid-session.
 */
export async function resolveEntry(opts: ResolveEntryOptions): Promise<EntryResolution> {
  const stack = readStack(opts.host)
  const targets = targetsOf(stack)

  if (opts.silent) {
    const pair = defaultPairFor(stack)
    return { learnerPair: pair, stack, chosenTarget: pair.target }
  }

  let chosenTarget: string
  if (targets.length > 1) {
    chosenTarget = await showLanguageChooser(opts.container, targets, opts)
  } else {
    chosenTarget = targets[0] ?? DEFAULT_PAIR.target
  }

  const learnerPair = pairFor(stack, chosenTarget)
  await showWelcome(opts.container, learnerPair, opts)

  return { learnerPair, stack, chosenTarget }
}

/**
 * Subscribe to live stack changes and notify when the DERIVED pair should change.
 *
 * The world stays bound to ONE target per session; on a stack flip we recompute
 * the default pair for the new stack and, IF it differs from the current pair,
 * fire `onChange(newPair, newStack)`. The orchestrator (`game.ts`) decides how to
 * rebind — the cleanest is a full teardown+rebuild of the world with the new pair
 * (the per-Track state already keys on the pair), which is what the integration
 * note recommends.
 *
 * Why default-pair (not re-prompt): a flip arriving while the player is mid-walk
 * shouldn't yank a modal chooser over them. The world rebinds to the stack's
 * first target; the chooser is for INTENTIONAL entry. (A future enhancement could
 * re-open the chooser on next entry only.)
 *
 * Returns an unsubscribe (no-op when the host can't notify). `getCurrentPair`
 * lets the caller compare against whatever the world is currently bound to.
 */
export function bindStackReactivity(
  host: unknown,
  getCurrentPair: () => LearnerPair,
  onChange: (next: LearnerPair, stack: StackConfig) => void,
): () => void {
  return subscribeStack(host, (stack) => {
    const current = getCurrentPair()
    const targets = targetsOf(stack)
    // PRESERVE the player's CHOSEN target across stack notifications. The real
    // host (corpan-app `onStackConfigChange`) fires this listener IMMEDIATELY on
    // subscribe — and again on unrelated settings changes. Rebinding to
    // `defaultPairFor` (the stack's FIRST target) here silently switched a chosen
    // non-first target to the first one the instant the world mounted: EN native
    // learning [AR, ES], pick ES → the world rebuilt in AR (the first target).
    // Keep the chosen target whenever it is STILL in the stack (only the native
    // follows a primary change); rebind to a default target ONLY when the chosen
    // target was actually removed from the stack.
    const target = targets.includes(current.target)
      ? current.target
      : targets[0] ?? current.target
    const next = pairFor(stack, target)
    if (!samePair(next, current)) {
      console.info("[wp/entry] stack changed → rebinding world", current, "→", next)
      onChange(next, stack)
    }
  })
}
