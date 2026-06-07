/**
 * languageManager — discover, download, and activate language tutors plus their
 * 0..N RAG sources inside the Tutomaton pack.
 *
 * A LANGUAGE is the tutor: a system prompt + grounding instruction (per-language,
 * at `languages/<code>/prompts/`) + a voice. A SOURCE is a self-describing unit
 * (sqlite + retriever) that grounds the tutor for that language. A language has
 * 0..N sources:
 *   0 sources → prompt-only tutor (the ~40 stub languages). Natural, no shim.
 *   1 source  → one authoritative corpus (es, zh today).
 *   N sources → authoritative core + non-authoritative add-ons (slang, the future
 *               phrase-pack bridge, …). Merged per the contract (§4).
 *
 * The SourceRegistry (this file) gathers, for the active language:
 *   - built-in sources declared in the pack manifest (`languages[<code>].sources[]`)
 *   - installed source packs discovered at runtime via `hostApi.discoverPacksByType`
 * filters them by the user's per-language enable prefs + `requiredHostApis`, enforces
 * a single authoritative winner, and hands the enabled set to the retrieval loop.
 *
 * See `RAG_SOURCES_CONTRACT.md` for the locked contract this implements.
 */

import { RETRIEVERS } from "./retrievers"

// Minimal slice of @corpan/sdk's HostApi that this pack actually uses.
// Inlined to keep the pack a leaf build with no workspace coupling.
export type LlmChatMessage = { role: "system" | "user" | "assistant"; content: string }
export type LlmChatHandlers = {
  onToken: (token: string) => void
  onDone: (full: string, stats?: { totalTokens: number; elapsedMs: number }) => void
  onError: (error: string, code?: string) => void
}
export type LlmInstallProgress = {
  stage: string
  progress: number
  total: number
  message: string
}

export type LlmApi = {
  status: () => Promise<{ loaded: boolean; modelId?: string | null; backend?: string | null }>
  isInstalled: (packId: string) => Promise<boolean>
  install: (
    args: { packId: string; url: string; sha256?: string },
    onProgress?: (p: LlmInstallProgress) => void
  ) => Promise<void>
  load: (args: { modelPackId: string; gpuLayers?: number; contextSize?: number }) => Promise<void>
  unload: () => Promise<void>
  chat: (
    args: {
      messages: LlmChatMessage[]
      options?: {
        temperature?: number
        topP?: number
        topK?: number
        minP?: number
        repeatPenalty?: number
        presencePenalty?: number
        maxTokens?: number
        stop?: string[]
      }
    },
    handlers: LlmChatHandlers
  ) => Promise<{ sessionId: string; cancel: () => Promise<void> }>
}

/** A source pack discovered on disk by the host (installed, not bundled). The
 *  native `discoverPacksByType` reads these fields from the pack's own manifest.
 *  0.16.0 ships a host stub returning []; the registry is already wired for it. */
export type DiscoveredSource = {
  id: string
  packId: string
  name?: Record<string, string>
  tutomatonLanguage: string | string[]
  authoritative: boolean
  priority?: number
  categories?: string[]
  schemaVersion?: number
  requiredHostApis?: string[]
  /** dbName key the host resolves to this pack's sqlite (null/absent → host-API source). */
  dbName?: string | null
}

export type HostApi = {
  speak: (locale: string, text: string) => Promise<void>
  /** Enumerate installed voices ranked by the host for this BCP-47 language. */
  listVoices?: (locale?: string) => Promise<HostVoiceInfo[]>
  /** Speak with one exact stable platform voice ID. */
  speakVoice?: (locale: string, text: string, voiceId: string) => Promise<void>
  stopSpeech?: () => void | Promise<void>
  /** Native clipboard copy (WKWebView blocks the web clipboard API). */
  copyText?: (text: string) => Promise<void>
  queryPackDb?: (args: {
    sql: string
    params: unknown[]
    dbName: string
    packId: string
  }) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  /** On-device LLM runtime (present when tauri-plugin-corpan-llm is registered). */
  llm?: LlmApi
  /**
   * Download a module ZIP and extract it into the pack's on-disk dir under
   * `subPath`, writing the pack manifest if absent. Used to deliver per-language
   * sqlite + assets so `queryPackDb` (on-disk only) can ground retrieval.
   */
  installModuleZip?: (
    args: { packId: string; subPath: string; url: string; sha256?: string; packManifest?: string },
    onProgress?: (p: LlmInstallProgress) => void
  ) => Promise<void>
  /** Whether a file at `relPath` exists inside the pack's on-disk dir. */
  packFileExists?: (packId: string, relPath: string) => Promise<boolean>
  /** Discover installed packs of a given packType (e.g. "tutomaton-rag-source").
   *  0.16.0 host stub returns []; future native lands real discovery. */
  discoverPacksByType?: (packType: string) => Promise<DiscoveredSource[]>
  /** Installed Corpán phrase packs — used by the phrase-bridge universal source
   *  (§7) to ground tutors in real phrase-to-target alignments the user already
   *  has on the device. */
  phrasePacks?: {
    getInstalled: () => Record<string, {
      id: string
      name: string
      nameLocalized?: Record<string, string>
      topic?: string
      topicLocalized?: Record<string, string>
      accentColor?: string
    }>
  }
  stt?: {
    prepare?: (args: { model: string }) => Promise<void>
    startSession?: (args: { sessionId: string; language: string; expectedText: string }) => Promise<void>
    stopSession?: (args: { sessionId: string }) => Promise<{ text?: string } | undefined>
    cancelSession?: (args: { sessionId: string }) => Promise<void>
    releaseAudio?: () => Promise<void>
  }
  /** Provider-agnostic dictation (host.asr). Present only when an asr-* provider
   *  plugin is registered. Minimal local mirror of @shared/asr's AsrApi — kept
   *  here (not imported) so the pack stays self-contained, same as `llm`. */
  asr?: HostAsrApi
}

export type HostVoiceInfo = {
  id: string
  name?: string
  language: string
  gender?: "male" | "female" | "unspecified"
  quality?:
    | "default"
    | "enhanced"
    | "premium"
    | "very_low"
    | "low"
    | "normal"
    | "high"
    | "very_high"
  networkRequired?: boolean
}

export type HostAsrApi = {
  provider: (id: string) => Promise<HostAsrProvider | null>
  pick: (args: {
    lang: string
    budgetMB?: number
    goal?: "dictation" | "challenge"
  }) => Promise<HostAsrProvider | null>
}

export type HostAsrProvider = {
  readonly id: string
  transcribe: (opts: {
    lang: string
    mode: "push_to_talk" | "auto_stop"
  }) => Promise<HostAsrSession>
}

export type HostAsrSession = {
  onPartial: (cb: (text: string) => void) => void
  onLevel: (cb: (rms: number, tMs: number) => void) => void
  onError: (cb: (code: string, message?: string) => void) => void
  stop: () => Promise<{ text: string; confidence: number; language: string }>
  cancel: () => void
}

/** A built-in source as declared in the pack manifest's `languages[<code>].sources[]`.
 *  Bundled in the pack ZIP — its retriever is statically imported in retrievers.ts,
 *  keyed by `id`; its sqlite (if any) resolves through the manifest `databases` map. */
export type SourceManifestEntry = {
  /** Stable, unique; the persistence + settings key and the retriever lookup key. */
  id: string
  name?: Record<string, string>
  /** May this source theme-bypass the LLM? At most one authoritative wins per language. */
  authoritative: boolean
  /** Higher wins ties; default 0. Built-in core = 100. */
  priority?: number
  categories?: string[]
  schemaVersion?: number
  /** dbName key into the manifest `databases` map; null/absent → host-API source (no sqlite). */
  dbName?: string | null
  /** Capabilities the retriever needs on hostApi; source is skipped if any are absent. */
  requiredHostApis?: string[]
  bundled?: boolean
}

export type LanguageRegistryEntry = {
  code: string
  displayName: Record<string, string>
  voiceLanguageCode: string
  contentVersion: string
  sizeMb: number
  moduleUrl: string
  sha256: string
  /** Built-in RAG sources bundled with this language (0..N). Absent → prompt-only. */
  sources?: SourceManifestEntry[]
}

/** Result a single source's retriever returns (the rich per-source kinds). */
export type SourceRetrievalResult = {
  kind: string | null
  reference: string | null
  /** 0..1 confidence; optional. Used only for tie-break in the merge. */
  score?: number
  themeKey?: string
  log: string[]
}

export type QueryFn = (
  sql: string,
  params: unknown[]
) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>

/** Pattern A (§7 universal sources): the registry hands universal/bridge
 *  retrievers a `helpers` argument with cross-pack access. Per-language
 *  retrievers receive `undefined` here and ignore it; the standard 2-arg
 *  contract is unchanged for them. */
export type RetrieverHelpers = {
  /** Active Tutomaton target language code (e.g. "ar", "ja", "pt-BR"). */
  targetLanguage: string
  /** Subset of HostApi the bridge needs. queryPackDb here accepts an explicit
   *  packId so the bridge can hit each installed phrase pack in turn. */
  hostApi: {
    phrasePacks?: HostApi["phrasePacks"]
    queryPackDb?: HostApi["queryPackDb"]
  }
}

export type RetrieverModule = {
  retrieve: (text: string, queryFn: QueryFn, helpers?: RetrieverHelpers) => Promise<SourceRetrievalResult>
  resolveTheme: (key: string, queryFn: QueryFn) => Promise<string | null>
}

/** The MERGED result the chat shell consumes. `theme` = authoritative theme bypass
 *  (deliver the canonical list, no LLM). `grounded` = inject `reference` into the
 *  system prompt. `none` = ungrounded, prompt-only. */
export type RetrievalResult = {
  kind: "theme" | "grounded" | "none"
  reference: string | null
  themeKey?: string
  log: string[]
}

/** A source resolved for the active language: retriever + a queryFn already
 *  scoped to this source's (packId, dbName).
 *
 *  Universal sources (§7) also carry `helpers` (pattern A) so the retriever
 *  can reach across installed packs. Per-language sources have `helpers === undefined`. */
type ResolvedSource = {
  id: string
  name: Record<string, string>
  authoritative: boolean
  priority: number
  origin: "builtin" | "universal" | "installed"
  dbName: string
  retriever: RetrieverModule
  queryFn: QueryFn
  helpers?: RetrieverHelpers
}

export type LanguageRuntime = {
  code: string
  voiceLanguageCode: string
  systemPrompt: string
  groundingInstruction: string
  /** Run the merge across all enabled sources for this language (§4). */
  retrieve: (text: string) => Promise<RetrievalResult>
  /** Direct theme delivery from the authoritative source — no LLM. */
  resolveTheme: (themeKey: string) => Promise<string | null>
  /** The authoritative source's dbName (or `tutomaton-<code>`); kept for diagnostics. */
  dbName: string
  /** The enabled sources resolved for this language (for diagnostics / a future settings UI). */
  sources: { id: string; name: Record<string, string>; authoritative: boolean; priority: number; origin: string }[]
}

export type LanguageManagerOptions = {
  hostApi: HostApi
  packId: string
  registry: LanguageRegistryEntry[]
  /** Loader for a file inside a language module dir (relative path). */
  loadModuleFile: (code: string, relativePath: string) => Promise<string>
  /** Whether the module ZIP carrying `code`'s built-in source db(s) is on disk. */
  isInstalled: (code: string) => Promise<boolean>
  /** Trigger module download + verify + extract. Throws on sha mismatch. */
  install: (entry: LanguageRegistryEntry, onProgress?: (p: LlmInstallProgress) => void) => Promise<void>
  /** Built-in universal sources (§7): apply to every target language, MUST be
   *  non-authoritative, get pattern-A `helpers` passed at retrieve time.
   *  Declared at manifest top level (e.g. the phrase-pack bridge). */
  universalSources?: SourceManifestEntry[]
}

const SOURCE_PACK_TYPE = "tutomaton-rag-source"
const PREF_NS = "tutomaton.sources"

/** Per-language enable pref for a source. Default ON (absence = on). */
export function isSourceEnabled(lang: string, id: string): boolean {
  try {
    return localStorage.getItem(`${PREF_NS}.${lang}.${id}`) !== "off"
  } catch {
    return true
  }
}

/** Persist a per-language source toggle (post-v1 settings UI writes this). */
export function setSourceEnabled(lang: string, id: string, on: boolean): void {
  try {
    localStorage.setItem(`${PREF_NS}.${lang}.${id}`, on ? "on" : "off")
  } catch {
    /* storage full / unavailable — default-on semantics keep the source usable */
  }
}

function hasHostApis(hostApi: HostApi, caps?: string[]): boolean {
  if (!caps || caps.length === 0) return true
  return caps.every((c) => (hostApi as unknown as Record<string, unknown>)[c] != null)
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function wrapReference(type: "canonical" | "inspiration", from: string, markdown: string): string {
  return `<reference type="${type}" from="${escapeAttr(from)}">\n${markdown}\n</reference>`
}

export class LanguageManager {
  private opts: LanguageManagerOptions
  private active: LanguageRuntime | null = null

  constructor(opts: LanguageManagerOptions) {
    this.opts = opts
  }

  list(): LanguageRegistryEntry[] {
    return this.opts.registry
  }

  installed(): Promise<string[]> {
    return Promise.all(
      this.opts.registry.map(async (e) => ((await this.opts.isInstalled(e.code)) ? e.code : null))
    ).then((arr) => arr.filter((x): x is string => x !== null))
  }

  async ensureInstalled(code: string, onProgress?: (p: LlmInstallProgress) => void): Promise<void> {
    const entry = this.opts.registry.find((e) => e.code === code)
    if (!entry) throw new Error(`Unknown language: ${code}`)
    if (await this.opts.isInstalled(code)) return
    await this.opts.install(entry, onProgress)
  }

  async activate(code: string, onProgress?: (p: LlmInstallProgress) => void): Promise<LanguageRuntime> {
    if (this.active?.code === code) return this.active
    await this.ensureInstalled(code, onProgress)

    const entry = this.opts.registry.find((e) => e.code === code)
    if (!entry) throw new Error(`Unknown language: ${code}`)

    // Prompts are per-LANGUAGE and live at conventional paths for every language
    // (verified across all 52). No module.json round-trip — the manifest registry
    // entry already carries voiceLanguageCode + sources, which removes the old
    // "404 HTML parsed as JSON" failure mode for unpublished languages.
    const [systemPrompt, groundingInstruction] = await Promise.all([
      this.opts.loadModuleFile(code, "prompts/system_prompt.txt"),
      this.opts.loadModuleFile(code, "prompts/grounding_instruction.txt"),
    ])

    const sources = await this._resolveSources(code, entry)
    const authoritative = sources.find((s) => s.authoritative) ?? null
    const dbName = authoritative?.dbName ?? `tutomaton-${code}`

    const retrieve = (text: string): Promise<RetrievalResult> => this._merge(sources, text)
    const resolveTheme = async (themeKey: string): Promise<string | null> => {
      if (!authoritative) return null
      try {
        return await authoritative.retriever.resolveTheme(themeKey, authoritative.queryFn)
      } catch (e) {
        console.error(`[tutomaton] resolveTheme failed for ${authoritative.id}:`, e)
        return null
      }
    }

    this.active = {
      code,
      voiceLanguageCode: entry.voiceLanguageCode,
      systemPrompt,
      groundingInstruction,
      retrieve,
      resolveTheme,
      dbName,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        authoritative: s.authoritative,
        priority: s.priority,
        origin: s.origin,
      })),
    }
    return this.active
  }

  current(): LanguageRuntime | null {
    return this.active
  }

  /**
   * Gather every enabled source for `code`: built-ins from the manifest +
   * installed source packs discovered via the host. Filters by enable pref +
   * requiredHostApis, rejects universal-authoritative, resolves each retriever,
   * and enforces a single authoritative winner (§1).
   */
  private async _resolveSources(code: string, entry: LanguageRegistryEntry): Promise<ResolvedSource[]> {
    const hostApi = this.opts.hostApi
    const out: ResolvedSource[] = []

    // ---- built-in per-language sources (declared in manifest.languages[].sources[]) ----
    for (const s of entry.sources ?? []) {
      if (!isSourceEnabled(code, s.id)) continue
      const need = s.requiredHostApis ?? (s.dbName === undefined || s.dbName === null ? [] : ["queryPackDb"])
      if (!hasHostApis(hostApi, need)) {
        console.info(`[tutomaton] skip built-in source ${s.id}: host missing ${JSON.stringify(need)}`)
        continue
      }
      const mod = RETRIEVERS[s.id]
      if (!mod) {
        console.warn(`[tutomaton] built-in source ${s.id} has no bundled retriever — skipping`)
        continue
      }
      out.push(this._resolve(code, s.id, s.name, s.authoritative, s.priority ?? 0, s.dbName ?? null, mod, "builtin", this.opts.packId))
    }

    // ---- universal sources (§7: tutomatonLanguage:"*"; bundled at the pack
    //      level via manifest.universalSources[]; helpers carry phrasePacks + queryPackDb) ----
    for (const u of this.opts.universalSources ?? []) {
      if (u.authoritative) {
        console.warn(`[tutomaton] reject universal source ${u.id}: §7 requires authoritative:false`)
        continue
      }
      if (!isSourceEnabled(code, u.id)) continue
      const need = u.requiredHostApis ?? ["queryPackDb"]
      if (!hasHostApis(hostApi, need)) {
        console.info(`[tutomaton] skip universal source ${u.id}: host missing ${JSON.stringify(need)}`)
        continue
      }
      const mod = RETRIEVERS[u.id]
      if (!mod) {
        console.warn(`[tutomaton] universal source ${u.id} has no bundled retriever — skipping`)
        continue
      }
      const resolved = this._resolve(code, u.id, u.name, false, u.priority ?? 0, u.dbName ?? null, mod, "universal", this.opts.packId)
      resolved.helpers = { targetLanguage: code, hostApi: { phrasePacks: hostApi.phrasePacks, queryPackDb: hostApi.queryPackDb } }
      out.push(resolved)
    }

    // ---- discovered installed source packs (0.16.0 host stub → []) ----
    try {
      const discovered = (await hostApi.discoverPacksByType?.(SOURCE_PACK_TYPE)) ?? []
      for (const d of discovered) {
        const langs = Array.isArray(d.tutomatonLanguage) ? d.tutomatonLanguage : [d.tutomatonLanguage]
        const universal = langs.includes("*")
        if (!universal && !langs.includes(code)) continue
        // §7: a universal source must never claim theme-bypass authority over every language.
        if (universal && d.authoritative) {
          console.warn(`[tutomaton] reject source ${d.id}: tutomatonLanguage:"*" cannot be authoritative`)
          continue
        }
        if (!isSourceEnabled(code, d.id)) continue
        if (!hasHostApis(hostApi, d.requiredHostApis)) {
          console.info(`[tutomaton] skip discovered source ${d.id}: host missing ${JSON.stringify(d.requiredHostApis)}`)
          continue
        }
        const mod = this._loadInstalledRetriever(d)
        if (!mod) {
          console.info(`[tutomaton] discovered source ${d.id}: installed-retriever loading not wired yet — skipping`)
          continue
        }
        out.push(this._resolve(code, d.id, d.name, d.authoritative, d.priority ?? 0, d.dbName ?? null, mod, "installed", d.packId))
      }
    } catch (e) {
      console.error("[tutomaton] source discovery failed (continuing with built-ins):", e)
    }

    // ---- enforce a single authoritative winner (§1): highest priority, then lex id ----
    const auths = out.filter((s) => s.authoritative)
    if (auths.length > 1) {
      auths.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1))
      for (const loser of auths.slice(1)) {
        loser.authoritative = false
        console.info(`[tutomaton] demoted authoritative source ${loser.id} (another won the theme-bypass slot)`)
      }
    }
    return out
  }

  private _resolve(
    code: string,
    id: string,
    name: Record<string, string> | undefined,
    authoritative: boolean,
    priority: number,
    dbName: string | null,
    retriever: RetrieverModule,
    origin: "builtin" | "universal" | "installed",
    packId: string
  ): ResolvedSource {
    const hostApi = this.opts.hostApi
    const effectiveDbName = dbName ?? `tutomaton-${code}`
    const queryFn: QueryFn = (sql, params) =>
      hostApi.queryPackDb!({ sql, params, dbName: effectiveDbName, packId })
    return {
      id,
      name: name ?? { en: id },
      authoritative,
      priority,
      origin,
      dbName: effectiveDbName,
      retriever,
      queryFn,
    }
  }

  /**
   * Resolve the retriever for a discovered (installed, not bundled) source pack.
   * Installed retrievers ship precompiled to JS; loading them at runtime needs a
   * host-served module path the IIFE bundle can evaluate. Not wired for 0.16.0
   * (the discover stub returns [], so this is never reached). When native lands,
   * this is the single seam to implement JS-module loading. Returns null = skip.
   */
  private _loadInstalledRetriever(_d: DiscoveredSource): RetrieverModule | null {
    return null
  }

  /**
   * Merge enabled sources for one user turn (contract §4 + §8 labeling):
   *   1. Theme bypass — only the authoritative source may bypass (kind "theme").
   *   2. Otherwise ≤2 grounding blocks: authoritative canonical first, then the
   *      highest-priority non-authoritative hit (tie-break by score, then id).
   *   3. Nothing hits → {kind:"none"} (ungrounded, prompt-only).
   * A lone authoritative source injects its reference RAW (byte-identical to the
   * pre-registry behavior); labeled <reference> blocks appear only once a second
   * source actually participates, so es/zh are unchanged until a peer source exists.
   */
  private async _merge(sources: ResolvedSource[], text: string): Promise<RetrievalResult> {
    const log: string[] = []
    if (sources.length === 0) return { kind: "none", reference: null, log }

    const results = await Promise.all(
      sources.map(async (s) => {
        try {
          return { s, r: await s.retriever.retrieve(text, s.queryFn, s.helpers) }
        } catch (e) {
          log.push(`source ${s.id} retrieve failed: ${String(e)}`)
          console.error(`[tutomaton] source ${s.id} retrieve failed:`, e)
          return { s, r: { kind: "none", reference: null, log: [] } as SourceRetrievalResult }
        }
      })
    )

    const auth = results.find(({ s }) => s.authoritative) ?? null

    // 1. theme bypass — authoritative only
    if (auth && auth.r.kind === "theme" && auth.r.reference) {
      return { kind: "theme", reference: auth.r.reference, themeKey: auth.r.themeKey, log }
    }

    // 2. grounding blocks
    const canonical = auth && auth.r.reference ? auth.r.reference : null
    const nonAuth = results
      .filter(({ s, r }) => !s.authoritative && r.reference)
      .sort(
        (a, b) =>
          b.s.priority - a.s.priority ||
          (b.r.score ?? 0) - (a.r.score ?? 0) ||
          (a.s.id < b.s.id ? -1 : 1)
      )
    const topNonAuth = nonAuth[0] ?? null

    // Lone authoritative source → raw inject (unchanged es/zh behavior).
    if (canonical && !topNonAuth) {
      return { kind: "grounded", reference: canonical, log }
    }

    const blocks: string[] = []
    if (auth && canonical) blocks.push(wrapReference("canonical", srcName(auth.s), canonical))
    if (topNonAuth && blocks.length < 2) {
      blocks.push(wrapReference("inspiration", srcName(topNonAuth.s), topNonAuth.r.reference!))
    }
    if (blocks.length === 0) return { kind: "none", reference: null, log }
    return { kind: "grounded", reference: "\n" + blocks.join("\n"), log }
  }
}

function srcName(s: ResolvedSource): string {
  return s.name.en ?? Object.values(s.name)[0] ?? s.id
}
