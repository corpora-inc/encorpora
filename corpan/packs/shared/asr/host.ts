// Host-facing ASR + model-registry API surface — `host.asr` and
// `host.models`. These are the seams packs program against; the corpan-app
// supplies the concrete implementation. Design: STT_MASTERPLAN.md §4-§5.
//
// This file is TYPES + the router contract only. The implementation
// (provider adapters over the asr-* plugins, the registry's Budget Arbiter
// backed by the Rust registry) lands in corpan-app. Keeping the surface
// here lets packs and the host share one definition.

import type {
  AsrCapability,
  AsrProvider,
  AsrProviderId,
} from "./contract"

/** A class of on-device asset the registry tracks. One inventory for all of
 *  them so refcount/dedup/eviction and the memory budget are unified. */
export type AssetKind = "asr-model" | "llm" | "narration" | "phrase-pack" | "sound"

/** One tracked asset on disk. `refCount` is how many live consumers depend
 *  on it (two packs sharing one `ggml-large-v3-q5_0.bin` → one download,
 *  refCount 2; evicted only at 0). */
export type AssetRecord = {
  id: string
  kind: AssetKind
  sizeMB: number
  /** Absolute on-device path once installed; null while not present. */
  path: string | null
  refCount: number
}

/** A resident runtime's live memory footprint, as reported by each plugin
 *  (LLM / ASR / TTS) when it loads or unloads. The Budget Arbiter sums
 *  these against device headroom. */
export type ResidentRuntime = {
  id: string
  mb: number
  kind: AssetKind
}

/** The live memory + storage picture the arbiter reasons over. */
export type ModelBudget = {
  /** iOS `os_proc_available_memory()` (per-app jetsam headroom) or Android
   *  `availMem` (system-wide free). Semantics differ by platform — see
   *  pronunciation-coach/modelRegistry for the gating math this feeds. */
  availableMB: number
  /** Total physical RAM, MB. Stable across calls. */
  physicalMB: number
  /** What's loaded right now across every runtime. */
  resident: ResidentRuntime[]
}

/** Result of a "does this fit?" check. `mustEvict` lists assets the caller
 *  would have to release first (refCount-0 candidates the arbiter would
 *  reclaim) to make room. */
export type FitsResult = {
  fits: boolean
  mustEvict: string[]
}

export type EnsureAssetArgs = {
  /** Where to fetch if absent (CDN/HF url or an OS-asset trigger token). */
  source: string
  sizeMB: number
  kind: AssetKind
}

/**
 * The on-device Model & Asset Registry. One store the corpan-app owns; every
 * pack reads it. This is what makes "do I have room for Qwen3-ASR next to my
 * 4B LLM" a real, answerable question rather than a guess.
 */
export type ModelsApi = {
  list(): Promise<AssetRecord[]>
  /** Stream-to-disk install with refcount bump. Idempotent: an already-
   *  present asset just increments refCount. `downloading` → watch events. */
  ensure(
    assetId: string,
    args: EnsureAssetArgs,
  ): Promise<{ ready: boolean; downloading: boolean }>
  /** Absolute path of an installed asset, or null. */
  locate(assetId: string): Promise<string | null>
  /** Decrement refCount; physically evict at 0. */
  evict(assetId: string): Promise<void>
  /** Live memory + storage picture for the arbiter. */
  budget(): Promise<ModelBudget>
  /** Would `req` fit right now (by assetId or a raw resident MB ask)? */
  fits(req: { assetId?: string; residentMB?: number }): Promise<FitsResult>
  /** Which ASR providers can run RIGHT NOW alongside the given resident set
   *  (e.g. "with the 4B LLM loaded, which engines fit?"). The single source
   *  of truth Corpan City / Tutomaton consult before opening a mic. */
  whatFitsAlongside(residentIds: string[]): Promise<AsrCapability[]>
}

/** What the caller is optimizing for, fed to the smart router. */
export type AsrGoal =
  /** Live dictation into a field — prefer streaming/low latency. */
  | "dictation"
  /** Known-target repetition challenge — accuracy over latency, fuzzy
   *  match forgives, so a slower big model is fine. */
  | "challenge"

export type AsrPickArgs = {
  lang: string
  /** Memory the caller is willing to let ASR consume right now. The router
   *  filters out providers whose `residentMemoryMB` won't fit this + the
   *  arbiter's live headroom. */
  budgetMB?: number
  goal?: AsrGoal
}

/**
 * Two selection APIs (STT_MASTERPLAN §5.1):
 *
 * - `provider(id)` — explicit, for power packs (Corpan City / Tutomaton)
 *   that compute their own pick from `host.models.budget()` + intent
 *   ("NPC loop with 4B resident → prefer native, else qwen3 co-resident if
 *   `whatFitsAlongside` says yes, else swap to whisper").
 *
 * - `pick(args)` — smart router default for simple packs / the core app.
 *   Resolution order: native if available (≈0 mem, no download, best) →
 *   on-device candidates that fit, ranked by latencyClass(goal), then
 *   non-autoregressive on Android, then WER(lang) → whisper if installed/
 *   opt-in → `null` meaning KEYBOARD (the universal floor; never blocked).
 */
export type AsrApi = {
  provider(id: AsrProviderId): Promise<AsrProvider | null>
  /** Returns the chosen provider, or `null` to signal "fall back to the
   *  keyboard" — callers MUST handle null (the keyboard floor is permanent). */
  pick(args: AsrPickArgs): Promise<AsrProvider | null>
}
