/**
 * Shared building blocks for the micro-challenge library: the reward
 * convention, deterministic RNG + array helpers, and the small `ToolImpl`
 * shape each tool returns (the registry wraps it into a contract `ChallengeTool`).
 */

import type {
  ChallengeContext,
  ChallengeReward,
  ChallengeSpec,
  ChallengeToolId,
} from "@corpan-city/contracts"
import type { OverlayApi } from "../overlay"
import type { ChallengeRuntimeHost, ChallengeEntry, EntryFilter } from "../host"

/* ------------------------------------------------------------------ *
 * Tool implementation shape.
 *
 * A tool builds a data-only spec (params + chosen entry ids) and mounts UI into
 * the overlay body, finishing via `overlay.complete(score, reward)`. Tools never
 * touch the frame — they get a clean `OverlayApi`.
 * ------------------------------------------------------------------ */

export interface ToolImpl {
  id: ChallengeToolId
  /** Human label (English; localized strings live in content/challenges). */
  title: string
  /** Default difficulty weight 1..3 used for reward sizing if a tool omits it. */
  difficulty?: 1 | 2 | 3
  /**
   * CROSS-LANGUAGE (#27/#57): true iff this tool's PROMPT and its CORRECT ANSWER
   * are inherently in DIFFERENT languages (translate / "which line meant X" /
   * match native↔target / tap-the-meaning / listen→meaning). Such a tool is a
   * TAUTOLOGY with no answer if both sides collapse to one language, so:
   *   - the orchestrator keeps `ChallengeContext.nativeLanguage` set for it even
   *     under immersion (the prompt/answer stay two-language), and
   *   - a single-language Track (native===target) is NOT offered it at all.
   * DECLARED here (not a hand-maintained whitelist) so a new tool can't silently
   * tautologize — the author MUST decide. Set HONESTLY: a monolingual drill
   * (read-aloud, unscramble, odd-one-out, …) is false. Default (absent) = false.
   */
  isCrossLanguage?: boolean
  buildSpec: (ctx: ChallengeContext) => Promise<ChallengeSpec>
  /** Render + run; resolve when the overlay completes/cancels. */
  run: (overlay: OverlayApi, spec: ChallengeSpec, host: ChallengeRuntimeHost) => void
}

/* ------------------------------------------------------------------ *
 * Reward convention.
 *
 * Rewards scale with DIFFICULTY (1..3, the cognitive/linguistic load of the
 * tool) × normalized SCORE (0..1). XP/coins are deterministic; an item is
 * granted probabilistically, better odds + better tier at higher score×difficulty.
 *
 *   xp    = round( BASE_XP    * difficulty * (0.4 + 0.6*score) )
 *   coins = round( BASE_COINS * difficulty * score )            // effort-gated
 *   item  = at score≥0.6: common; ≥0.8: uncommon; perfect+hard: a "token"
 *
 * Item ids are OPAQUE — the economy agent owns the Item model. We award ids by
 * tier; `*-token` ids read as "rare" in the reward reveal. A `seed` keeps the
 * grant reproducible for the QA harness.
 * ------------------------------------------------------------------ */

const BASE_XP = 8
const BASE_COINS = 2

const COMMON_ITEMS = [
  "item-copper-bead",
  "item-dried-fig",
  "item-clay-button",
  "item-twine-coil",
  "item-chalk-stub",
]
const UNCOMMON_ITEMS = [
  "item-silver-thimble",
  "item-spice-pouch",
  "item-glass-marble",
  "item-wax-seal",
]
const RARE_TOKENS = [
  "item-ferry-token",
  "item-market-token",
  "item-guild-relic",
  "item-amber-gem",
]

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length]
}

export function computeReward(
  difficulty: 1 | 2 | 3,
  score01: number,
  seed = Date.now(),
): ChallengeReward {
  const s = Math.max(0, Math.min(1, score01))
  const xp = Math.max(1, Math.round(BASE_XP * difficulty * (0.4 + 0.6 * s)))
  const coins = Math.round(BASE_COINS * difficulty * s)
  const items: string[] = []
  if (s >= 0.6) {
    if (s >= 0.92 && difficulty >= 3) {
      items.push(pickFrom(RARE_TOKENS, seed))
    } else if (s >= 0.8) {
      items.push(pickFrom(UNCOMMON_ITEMS, seed))
    } else {
      items.push(pickFrom(COMMON_ITEMS, seed))
    }
  }
  return { xp, coins, items }
}

/** A grade label keyed to a normalized score (mirrors the overlay default). */
export function grade(score01: number): string {
  if (score01 >= 0.92) return "Perfect"
  if (score01 >= 0.75) return "Great"
  if (score01 >= 0.5) return "Good"
  if (score01 > 0) return "Cleared"
  return "Try again"
}

/* ------------------------------------------------------------------ *
 * Deterministic RNG + array helpers (seedable for QA reproducibility).
 * ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function sample<T>(arr: readonly T[], n: number, rnd: () => number = Math.random): T[] {
  return shuffle(arr, rnd).slice(0, n)
}

/** Normalized Levenshtein similarity 0..1 (used for typed/STT comparison). */
export function similarity(a: string, b: string): number {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (!x && !y) return 1
  const m = x.length
  const n = y.length
  if (!m || !n) return 0
  const dp = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (x[i - 1] === y[j - 1] ? 0 : 1),
      )
      prev = tmp
    }
  }
  return 1 - dp[n] / Math.max(m, n)
}

/* ------------------------------------------------------------------ *
 * Tiny DOM helpers (the tools render plain DOM into the overlay body).
 * ------------------------------------------------------------------ */

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

export function clear(node: HTMLElement): void {
  node.replaceChildren()
}

/** Make a seed from a spec so a given challenge instance is reproducible. */
export function seedOf(spec: ChallengeSpec): number {
  let h = 2166136261
  for (const ch of spec.challengeId) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Difficulty inferred from CEFR level if a tool doesn't pin one. */
export function difficultyFromLevel(level?: string): 1 | 2 | 3 {
  if (!level) return 1
  const c = level[0]?.toUpperCase()
  if (c === "C") return 3
  if (c === "B") return 2
  return 1
}

/**
 * The THEMED + LEVEL-SCALED content filter stashed in `ChallengeSpec.params` under
 * this key. Every tool's random fill routes through {@link randomEntries}, which
 * reads it back off the spec and forwards it to the host's filtered draw — so a
 * café host's variety phrases lean food/everyday and a dock keeper's lean travel,
 * at the player's level. Absent ⇒ an unfiltered draw (back-compat).
 */
export const CONTENT_FILTER_PARAM = "contentFilter"

/** Read the content filter a `baseSpec` stashed (domains/levels/languageCodes). */
export function specContentFilter(spec: ChallengeSpec): EntryFilter | undefined {
  const f = spec.params?.[CONTENT_FILTER_PARAM]
  if (!f || typeof f !== "object") return undefined
  const o = f as Record<string, unknown>
  const out: EntryFilter = {}
  if (Array.isArray(o.domains) && o.domains.length) out.domains = o.domains as string[]
  if (Array.isArray(o.levels) && o.levels.length) out.levels = o.levels as string[]
  if (Array.isArray(o.languageCodes) && o.languageCodes.length)
    out.languageCodes = o.languageCodes as string[]
  return out.domains || out.levels || out.languageCodes ? out : undefined
}

/**
 * The SINGLE random-draw seam every tool's VARIETY fill uses. It threads the
 * spec's stashed content filter into the host's filtered draw, so the unpinned
 * remainder of a minigame is THEMED to the NPC's trade + the quest at the player's
 * level — and VARIED across plays (the host returns different matching rows each
 * time). The host degrades to an unfiltered draw when it can't filter (or a strict
 * filter starves), so this NEVER dead-ends the core loop.
 */
export function randomEntries(
  host: ChallengeRuntimeHost,
  spec: ChallengeSpec,
  n: number,
): Promise<ChallengeEntry[]> {
  const filter = specContentFilter(spec)
  return host.getRandomEntries(filter ? { count: n, ...filter } : n)
}

/** Build the standard data-only spec for a tool. */
export function baseSpec(
  toolId: ChallengeToolId,
  ctx: ChallengeContext,
  params: Record<string, unknown>,
  entryIds?: number[],
): ChallengeSpec {
  // Carry the THEMED + LEVEL-SCALED filter from the context into params so the
  // tool's random fill can draw matching corpus rows. Only stamp it when at least
  // one axis is set, to keep specs clean + back-compatible.
  const filter: Record<string, unknown> = {}
  if (ctx.domains?.length) filter.domains = ctx.domains
  if (ctx.levels?.length) filter.levels = ctx.levels
  if (ctx.languageCodes?.length) filter.languageCodes = ctx.languageCodes
  const mergedParams =
    Object.keys(filter).length > 0
      ? { ...params, [CONTENT_FILTER_PARAM]: filter }
      : params
  return {
    toolId,
    challengeId: `${toolId}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    language: ctx.language,
    nativeLanguage: ctx.nativeLanguage,
    level: ctx.level,
    entryIds,
    params: mergedParams,
    mode: ctx.mode,
  }
}
