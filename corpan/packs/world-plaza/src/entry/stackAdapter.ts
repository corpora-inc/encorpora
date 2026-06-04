/**
 * stackAdapter — the SINGLE place World Plaza derives a `LearnerPair` from the
 * LIVE Corpán language stack (the host's `getStackConfig()` /
 * `onStackConfigChange()`), instead of the hardcoded `learnerPair` baked into the
 * quest JSON.
 *
 * THE BUG THIS FIXES: switching the stack to "learn EN from ES" still played the
 * world as EN→ES because `game.ts` read `quest.learnerPair` ({target:"es",
 * native:"en"}) once. Everything (NPC languages, challenges, prompts, the
 * target/native badges) keys off that pair, so the world ignored the stack.
 *
 * SINGLE_LANGUAGE_RULE (packs/SINGLE_LANGUAGE_RULE.md):
 *   - `languages[0]` = the user's PRIMARY / NATIVE language (also UI language).
 *   - `languages[1..]` = optional TARGET languages being studied.
 *   - A 1-language stack = immersion: target === the one language, native === it
 *     too (there is no separate gloss language). We mirror native←target so every
 *     downstream consumer (which requires a non-null `native: LanguageCode`)
 *     keeps working; an immersion-aware consumer can compare target===native to
 *     detect "no gloss".
 *
 * This module imports NOTHING from the orchestrator (`game.ts`) or sibling slices
 * — it is a pure adapter over the minimal host surface it declares locally
 * (the same self-contained posture `npc/hostTypes.ts` takes).
 */

import type { LearnerPair } from "@world-plaza/contracts"

/* ------------------------------------------------------------------ host shape */

/**
 * The minimal slice of the Corpán `StackConfig` (corpan-app
 * `src/contentPacks/types.ts`) this pack reads. Re-declared locally so the pack
 * stays a self-contained IIFE. Keep in lockstep with the host's `StackConfig`.
 */
export interface StackConfig {
  activeStackId: string
  /** Ordered: [0] = primary/native (UI lang), [1..] = target languages. */
  languages: string[]
}

/**
 * The minimal slice of the host `HostApi` the entry flow consumes. Both members
 * are REQUIRED on the real host (corpan-app), but we treat the whole host as
 * possibly-absent (standalone dev → no host) and feature-detect each member, so
 * an older host that predates these never crashes the pack.
 */
export interface StackHostApi {
  getStackConfig?: () => StackConfig
  onStackConfigChange?: (listener: (config: StackConfig) => void) => () => void
}

/* ------------------------------------------------------- pair derivation */

/** The fallback pair used when there is NO host / NO stack at all (standalone
 *  dev with a mock NPC host). Mirrors the world's historical default so dev
 *  behaviour is unchanged when nobody injects a stack. */
export const DEFAULT_PAIR: LearnerPair = { target: "es", native: "en" }

/** Read the live stack off a host, or null if the host doesn't expose it. */
export function readStack(host: unknown): StackConfig | null {
  const h = host as StackHostApi | undefined
  if (!h || typeof h.getStackConfig !== "function") return null
  try {
    const cfg = h.getStackConfig()
    if (cfg && Array.isArray(cfg.languages)) return cfg
    console.warn("[wp/entry] getStackConfig returned a malformed config:", cfg)
    return null
  } catch (err) {
    console.error("[wp/entry] getStackConfig threw:", err)
    return null
  }
}

/**
 * The TARGET languages available to play from a stack, honoring the language
 * model: `languages[1..]` are targets; a single-language stack yields the one
 * language as its sole (immersion) target. De-duplicated, primary excluded
 * (except in the single-language case where the primary IS the target).
 */
export function targetsOf(stack: StackConfig | null): string[] {
  const langs = (stack?.languages ?? []).filter((l) => typeof l === "string" && l.length >= 2)
  if (langs.length === 0) return [DEFAULT_PAIR.target]
  if (langs.length === 1) return [langs[0]] // single-language stack = immersion
  // Multi-language: targets are everything after the primary, de-duped, primary removed.
  const primary = langs[0]
  const seen = new Set<string>()
  const targets: string[] = []
  for (const l of langs.slice(1)) {
    if (l === primary || seen.has(l)) continue
    seen.add(l)
    targets.push(l)
  }
  // Defensive: if the stack listed only the primary repeatedly, fall back to immersion.
  return targets.length ? targets : [langs[0]]
}

/**
 * Build the `LearnerPair` for a CHOSEN target language against a stack. The
 * native is the stack's primary (`languages[0]`); for a single-language stack
 * (target === primary) we mirror native←target (immersion — no separate gloss).
 */
export function pairFor(stack: StackConfig | null, target: string): LearnerPair {
  const langs = (stack?.languages ?? []).filter((l) => typeof l === "string" && l.length >= 2)
  const primary = langs[0] ?? DEFAULT_PAIR.native
  // Single-language stack / target equals primary → immersion: native mirrors target.
  const native = !langs.length || langs.length === 1 || target === primary ? target : primary
  return { target, native }
}

/** True when this pair is an immersion (single-language) pair — no native gloss. */
export function isImmersion(pair: LearnerPair): boolean {
  return pair.target === pair.native
}

/**
 * Resolve the DEFAULT pair for a stack WITHOUT a chooser — used for the
 * single-target (and single-language) cases, and as the value the world rebinds
 * to on a reactive stack flip when there's exactly one target. Picks the first
 * target.
 */
export function defaultPairFor(stack: StackConfig | null): LearnerPair {
  const targets = targetsOf(stack)
  return pairFor(stack, targets[0])
}

/**
 * Subscribe to live stack changes. Returns an unsubscribe (no-op when the host
 * doesn't support subscription). The listener receives the FRESH stack each
 * flip; the caller decides whether the derived pair actually changed before
 * rebinding the world (avoids needless rebuilds on unrelated axes like rate).
 */
export function subscribeStack(
  host: unknown,
  listener: (stack: StackConfig) => void,
): () => void {
  const h = host as StackHostApi | undefined
  if (!h || typeof h.onStackConfigChange !== "function") return () => {}
  try {
    return h.onStackConfigChange((cfg) => {
      if (cfg && Array.isArray(cfg.languages)) listener(cfg)
    })
  } catch (err) {
    console.error("[wp/entry] onStackConfigChange threw:", err)
    return () => {}
  }
}

/** Stable equality for two pairs (the world only rebinds when this changes). */
export function samePair(a: LearnerPair, b: LearnerPair): boolean {
  return a.target === b.target && a.native === b.native
}
