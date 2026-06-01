/**
 * Types for LLM-related catalog entries.
 *
 * The architecture is two-tier:
 *
 *   1. **llm-base** — shared GGUF (the 2.5 GB on-device model).
 *      One per supported runtime; downloaded once per device; reused by
 *      every LLM-consuming pack on that device.
 *
 *   2. **Regular content packs** (e.g. `tutomaton`) that consume the
 *      base via `dependsOn: ["llm-base-..."]`. These are NOT special
 *      catalog entries — they're regular packs that happen to use the
 *      LLM runtime, and they ship their own internal content management
 *      (Tutomaton, for instance, manages its own per-language modules
 *      via the on-pack LanguageManager).
 *
 * Designed to slot into the existing `CatalogV2` shape additively. Old
 * clients ignore the new `llmPacks` field and the `packType` discriminator.
 */

/** Two-ZIP artifact (preview public, full Plus-gated). Mirrors NarrationArtifact
 *  from contentPacks/catalog.ts so the install/signed-URL machinery is reused. */
export type LlmPackArtifact = {
  url: string
  sha256: string
  sizeMb: number
  requires?: string
}

type TwoZipDownloadable = {
  preview?: LlmPackArtifact
  full?: LlmPackArtifact
  /** Legacy single-ZIP fallback for old clients (not used by new LLM packs). */
  downloadUrl?: string
  sha256?: string
  sizeMb?: number
}

export type MinAppVersion = string
export type PackTier = "free" | "plus"

export type PackDependency = {
  id: string
  minVersion?: string
}

// ============================================================
// llm-base — the shared model pack (2.5 GB GGUF)
// ============================================================

export type LlmRuntimeTarget = {
  target: "llama.cpp"
  format: "gguf"
  modelArch: "qwen3" | "llama" | "mistral" | "gemma" | string
  contextSize: number
  recommendedGpuLayers?: "auto" | number
}

export type LlmModelVariant = {
  quant: "Q4_K_M" | "Q5_K_M" | "Q6_K" | "Q8_0" | "Q3_K_M" | string
  path: string
  sizeBytes: number
  sha256: string
  recommended?: boolean
}

export type CatalogLlmBase = TwoZipDownloadable & {
  id: string
  packType: "llm-base"
  version: string
  minAppVersion: MinAppVersion
  devOnly?: boolean
  tier: PackTier
  runtime: LlmRuntimeTarget
  variants: LlmModelVariant[]
}

// ============================================================
// Tutomaton — multilingual language tutor pack
// ============================================================

/**
 * Tutomaton ships as a regular pack (CatalogV2 `entries[]`), but its
 * manifest declares an internal registry of per-language modules that
 * the pack downloads lazily on first use. Each module is a small ZIP
 * containing the sqlite corpus, prompts, and retriever for that
 * language. Both the pack shell and the language modules are Plus-gated.
 */
export type TutomatonLanguageModule = {
  /** ISO 639-1 (or BCP-47 if needed). */
  code: string
  /** UI-localized display names. */
  displayName: Record<string, string>
  /** BCP-47 voice locale for TTS (e.g. "es-MX", "zh-CN"). */
  voiceLanguageCode: string
  /** Independent of the pack shell version. Bumps when the corpus changes. */
  contentVersion: string
  sizeMb: number
  /** CloudFront URL for the module ZIP. Signed at fetch time for Plus users. */
  moduleUrl: string
  sha256: string
  /** Minimum Tutomaton pack version required to load this module. */
  minTutomatonVersion?: string
}

// ============================================================
// Future: llm-persona overlay
// ============================================================

/** Persona overlays sit on top of a tutor pack + language. Not in v1; reserved
 *  for when we have user signal on the base tutor and want to layer character. */
export type CatalogLlmPersona = TwoZipDownloadable & {
  id: string
  packType: "llm-persona"
  /** Which pack + language this overlays (e.g. "tutomaton:es"). */
  baseRef: string
  character: string
  displayName: Record<string, string>
  version: string
  minAppVersion: MinAppVersion
  devOnly?: boolean
  tier: PackTier
  dependsOn: PackDependency[]
  personaPromptAddendum: string
  loraAdapter?: {
    path: string
    sizeBytes: number
    sha256: string
    scale: number
  }
}

// ============================================================
// Catalog field — slots into CatalogV2 as `llmPacks?: ...`
// ============================================================

/**
 * `llmPacks` is the catalog field for LLM-runtime-only entries (base models,
 * future persona overlays). Tutomaton itself is a regular pack and lives in
 * `entries[]` — it doesn't go here.
 */
export type CatalogLlmEntry = CatalogLlmBase | CatalogLlmPersona

/**
 * To wire into `corpan-app/src/store/catalog.ts`:
 *
 *   import type { CatalogLlmEntry } from "../contentPacks/llmTypes"
 *
 *   export type CatalogV2 = {
 *     // ...existing fields
 *     llmPacks?: CatalogLlmEntry[]
 *   }
 *
 * And filter on `devOnly` everywhere catalog entries are surfaced:
 *
 *   const isDev = import.meta.env.DEV || localStorage.getItem("corpan.devMode") === "true"
 *   const visiblePacks = entries.filter(p => !p.devOnly || isDev)
 *   const visibleLlm = (catalog.llmPacks ?? []).filter(p => !p.devOnly || isDev)
 */

// ============================================================
// Dependency resolution helper (for Tutomaton-like packs)
// ============================================================

export type ResolvedDeps = {
  /** Base packs (and other deps) to install in order — deepest first. */
  order: CatalogLlmEntry[]
  totalBytes: number
  alreadyInstalled: string[]
  blockedByPlus: string[]
}

export type IsInstalledFn = (packId: string) => boolean
export type IsSubscriberFn = () => boolean

/**
 * Walk a regular pack's `dependsOn` chain and resolve any `llm-*` deps. Used
 * by the installer when a pack like Tutomaton declares `dependsOn: ["llm-base-..."]`.
 */
export function resolveLlmDeps(
  depIds: string[],
  llmPacks: CatalogLlmEntry[],
  isInstalled: IsInstalledFn,
  isSubscriber: IsSubscriberFn,
): ResolvedDeps {
  const byId = new Map(llmPacks.map((p) => [p.id, p]))
  const order: CatalogLlmEntry[] = []
  const seen = new Set<string>()
  const alreadyInstalled: string[] = []
  const blockedByPlus: string[] = []
  const isSubber = isSubscriber()

  function walk(id: string) {
    if (seen.has(id)) return
    seen.add(id)
    const pack = byId.get(id)
    if (!pack) return
    // Walk persona deps first (base is post-order).
    if ("dependsOn" in pack) {
      for (const d of pack.dependsOn) walk(d.id)
    }
    if (isInstalled(id)) {
      alreadyInstalled.push(id)
      return
    }
    if (pack.tier === "plus" && !isSubber) {
      blockedByPlus.push(id)
      return
    }
    order.push(pack)
  }
  for (const id of depIds) walk(id)

  let totalBytes = 0
  for (const p of order) {
    const zip = p.full ?? p.preview
    if (zip) totalBytes += (zip.sizeMb ?? 0) * 1024 * 1024
  }
  return { order, totalBytes, alreadyInstalled, blockedByPlus }
}
