/**
 * modelTiering — pick the right on-device model size for a device's RAM.
 *
 * Tutomaton's tutor runs a Qwen3 GGUF on-device via llama.cpp. One size does
 * not fit all: the 4B (~3.3 GB resident) OOM-crashes low-RAM phones, while
 * tiny phones can still run a 0.6B. This module owns the registry of available
 * sizes and the pure tiering decision — given total physical RAM it returns the
 * *recommended* size (biggest that runs safely) and the per-size UI state.
 *
 * The Qwen3 family ladder is only 0.6B / 1.7B / 4B (there is no in-family ~3B),
 * so the 1.7B↔4B line is load-bearing. We have observed 4B crash a *6 GB*
 * Android phone (Android OOMKills the foreground app under memory pressure well
 * before nominal capacity), so 4B is only *recommended* at ≥7 GB.
 *
 * States (per device, per size):
 *   recommended — the single biggest size that runs safely here.
 *   available   — runs safely but smaller than recommended (UI warns: lower quality).
 *   try-anyway  — might run, might OOM; selectable behind a "may crash" confirm.
 *   disabled    — won't run on this device; shown greyed ("needs an N GB device").
 *
 * Pure + dependency-free so it unit-tests at every RAM boundary.
 */

export type ModelId =
  | "llm-base-qwen3-0.6b-v1"
  | "llm-base-qwen3-1.7b-v1"
  | "llm-base-qwen3-4b-v1"

export type ModelSpec = {
  id: ModelId
  /** Human name, e.g. "Qwen3 4B". */
  displayName: string
  /** Short param label for compact chips, e.g. "4B". */
  paramLabel: string
  quant: string
  /**
   * "instruct" = native non-thinking (Qwen3-4B-Instruct-2507).
   * "hybrid" = Qwen3 0.6B/1.7B, which emit a `<think>` block unless suppressed;
   * the host sends the non-thinking prefill (`noThink`) and strips any residue.
   */
  reasoning: "instruct" | "hybrid"
  /** CloudFront ZIP. The smaller packs are published in Phase 2 (see `published`). */
  url: string
  /** Download size for UX copy (actual bytes come from the install stream). */
  sizeMb: number
  /** Peak resident footprint estimate at the default context, MB — the basis
   *  for the safe/try/disabled gate (weights + KV + ~0.3 GB runtime overhead). */
  footprintMb: number
  /**
   * Languages this size handles well, from `infra/tutomaton-eval` (binary judge).
   * `undefined` = inherit the pack's full language set (the 4B is already
   * evaluated at 50 langs). The smaller sizes get explicit lists once Phase 1
   * eval lands — until then they too inherit the full set.
   */
  supportedLanguages?: readonly string[]
  /**
   * Whether the GGUF pack is actually hosted yet. The smaller packs flip to
   * `true` when Phase 2 publishes them to CloudFront; until then the installer
   * must not offer them (it falls back to the best published size).
   */
  published: boolean
}

export type ModelState = "recommended" | "available" | "try-anyway" | "disabled"

/**
 * Size registry, smallest → largest. The 4B mirrors the historical single
 * `BASE_MODEL`. The smaller packs carry research-based size/footprint estimates
 * and convention URLs; Phase 2 finalises url/sizeMb/sha + flips `published`.
 */
export const MODELS: readonly ModelSpec[] = [
  {
    id: "llm-base-qwen3-0.6b-v1",
    displayName: "Qwen3 0.6B",
    paramLabel: "0.6B",
    quant: "Q4_K_M",
    reasoning: "hybrid",
    url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-0.6b-v1-0.1.0-full.zip",
    sizeMb: 378,
    footprintMb: 900,
    published: true,
    // Judged by Claude subagents reading the 0.6B's actual shipped (temp-0.3)
    // tutor replies (infra/tutomaton-eval, 2026-06-16): KEEP only where it is
    // consistently fluent + correct + in the right script. The tiny model often
    // dodges into English or garbles, so the list is small — but every major
    // language a learner expects is here.
    supportedLanguages: [
      "ar", "en", "es", "fr", "it", "nl", "pt-PT", "ru", "th", "zh-Hans", "zh-Hant",
    ],
  },
  {
    id: "llm-base-qwen3-1.7b-v1",
    displayName: "Qwen3 1.7B",
    paramLabel: "1.7B",
    quant: "Q4_K_M",
    reasoning: "hybrid",
    url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-1.7b-v1-0.1.0-full.zip",
    sizeMb: 1056,
    footprintMb: 1600,
    published: true,
    // Judged by Claude subagents on the 1.7B's actual shipped replies
    // (infra/tutomaton-eval, 2026-06-16), same KEEP bar as the 0.6B + the prior
    // that the larger model is a superset of the smaller. It clears far more of
    // the hard set (Cantonese, Chinese, Malay, Indonesian, Slavic) but still
    // can't reliably teach most Indic, Japanese, Korean, Hebrew, Farsi, Turkish.
    supportedLanguages: [
      "ar", "da", "de", "en", "es", "fr", "hr", "hu", "id", "it", "ms", "nl",
      "no", "pt-BR", "pt-PT", "ro", "ru", "sr", "th", "vi", "yue-Hant-HK", "zh",
      "zh-Hans", "zh-Hant",
    ],
  },
  {
    id: "llm-base-qwen3-4b-v1",
    displayName: "Qwen3 4B",
    paramLabel: "4B",
    quant: "Q4_K_M",
    reasoning: "instruct",
    url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-full.zip",
    sizeMb: 2497,
    footprintMb: 3300,
    published: true,
  },
] as const

export function modelById(id: ModelId): ModelSpec {
  const m = MODELS.find((x) => x.id === id)
  if (!m) throw new Error(`unknown model id: ${id}`)
  return m
}

/**
 * RAM thresholds (total physical MB). Tunable; chosen conservatively so we
 * never OOMKill. "8GB" phones bin at ~7.4–7.7 GB and "6GB" at ~5.6–5.8 GB, so
 * 7000 cleanly separates the two classes.
 */
export const RAM_THRESHOLDS = {
  /** Below this, 1.7B is too tight to even attempt → disabled. */
  M1_7B_MIN: 2200,
  /** At/above this, 1.7B runs safely (recommended when 4B isn't). */
  M1_7B_SAFE: 4000,
  /** At/above this, 4B is selectable as try-anyway. Below → 4B disabled. */
  M4B_TRY: 5500,
  /** At/above this, 4B runs safely → recommended (8 GB-class). */
  M4B_SAFE: 7000,
  /** At/above this, give 4B a larger context window. */
  M4B_BIGCTX: 12000,
} as const

export type TierResult = {
  recommendedId: ModelId
  stateById: Record<ModelId, ModelState>
}

/**
 * Decide the per-size states for a device with `totalRamMb` total physical RAM.
 *
 * `null`/`0`/unknown total (desktop, or a platform we can't measure) → "assume
 * capable": recommend the 4B, everything available. This mirrors the existing
 * "can't measure → don't block" stance. `opts.metal` (iOS/macOS GPU offload)
 * relaxes the 4B safe line, since Metal makes the 4B comfortable from ~6 GB.
 */
export function selectTier(
  totalRamMb: number | null | undefined,
  opts: { metal?: boolean } = {},
): TierResult {
  const ram = typeof totalRamMb === "number" && Number.isFinite(totalRamMb) ? totalRamMb : 0
  const t = RAM_THRESHOLDS
  const m4bSafe = opts.metal ? Math.min(t.M4B_SAFE, 6000) : t.M4B_SAFE
  const m4bTry = opts.metal ? Math.min(t.M4B_TRY, 5000) : t.M4B_TRY

  // Unknown / desktop: assume capable.
  if (ram <= 0) {
    return {
      recommendedId: "llm-base-qwen3-4b-v1",
      stateById: {
        "llm-base-qwen3-0.6b-v1": "available",
        "llm-base-qwen3-1.7b-v1": "available",
        "llm-base-qwen3-4b-v1": "recommended",
      },
    }
  }

  // 1.7B safe/try/disabled by RAM alone.
  const m17: ModelState =
    ram >= t.M1_7B_SAFE ? "available" : ram >= t.M1_7B_MIN ? "try-anyway" : "disabled"
  // 4B safe/try/disabled by RAM alone.
  const m4b: ModelState =
    ram >= m4bSafe ? "available" : ram >= m4bTry ? "try-anyway" : "disabled"
  // 0.6B is always at least available (footprint fits anything we ship to).
  const m06: ModelState = "available"

  // The recommendation is the single biggest size that is *safe* (available),
  // largest-first. Promote exactly that one from "available" → "recommended".
  const state: Record<ModelId, ModelState> = {
    "llm-base-qwen3-0.6b-v1": m06,
    "llm-base-qwen3-1.7b-v1": m17,
    "llm-base-qwen3-4b-v1": m4b,
  }
  let recommendedId: ModelId = "llm-base-qwen3-0.6b-v1"
  for (const id of ["llm-base-qwen3-4b-v1", "llm-base-qwen3-1.7b-v1", "llm-base-qwen3-0.6b-v1"] as const) {
    if (state[id] === "available") {
      recommendedId = id
      break
    }
  }
  state[recommendedId] = "recommended"
  return { recommendedId, stateById: state }
}

/** Larger context for big-memory devices; smaller models / tighter RAM stay lean. */
export function recommendedContext(modelId: ModelId, totalRamMb: number | null | undefined): number {
  const ram = typeof totalRamMb === "number" && Number.isFinite(totalRamMb) ? totalRamMb : 0
  if (modelId === "llm-base-qwen3-4b-v1" && ram >= RAM_THRESHOLDS.M4B_BIGCTX) return 8192
  return 4096
}
