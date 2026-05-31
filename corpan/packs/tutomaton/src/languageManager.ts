/**
 * languageManager — discover, download, cache, and activate language modules
 * inside the Tutomaton pack.
 *
 * Data flow:
 *   pack manifest declares languages: [{ code, moduleUrl, sha256, sizeMb, ... }]
 *   user picks a language
 *     → if cached locally → mount it
 *     → else → download module ZIP via hostApi.fetchSignedUrl + extractTo
 *            → verify sha256 → cache → mount
 *
 * The cache lives under the pack's own data dir (managed by the host):
 *   <packDataDir>/languages/<code>/...module contents...
 *
 * The shell calls `activate(code)` which returns a `LanguageRuntime` —
 * a self-contained bundle the chat UI uses for retrieval + prompts + voice.
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
      options?: { temperature?: number; topP?: number; repeatPenalty?: number; maxTokens?: number; stop?: string[] }
    },
    handlers: LlmChatHandlers
  ) => Promise<{ sessionId: string; cancel: () => Promise<void> }>
}

export type HostApi = {
  speak: (locale: string, text: string) => Promise<void>
  stopSpeech?: () => void
  queryPackDb?: (args: {
    sql: string
    params: unknown[]
    dbName: string
    packId: string
  }) => Promise<{ columns: string[]; rows: unknown[][] }>
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
  stt?: {
    prepare?: (args: { model: string }) => Promise<void>
    startSession?: (args: { sessionId: string; language: string; expectedText: string }) => Promise<void>
    stopSession?: (args: { sessionId: string }) => Promise<{ text?: string } | undefined>
    cancelSession?: (args: { sessionId: string }) => Promise<void>
    releaseAudio?: () => Promise<void>
  }
}

export type LanguageRegistryEntry = {
  code: string
  displayName: Record<string, string>
  voiceLanguageCode: string
  contentVersion: string
  sizeMb: number
  moduleUrl: string
  sha256: string
}

export type LanguageModule = {
  code: string
  displayName: Record<string, string>
  voiceLanguageCode: string
  contentVersion: string
  files: {
    database: string
    coreVocab?: string
    systemPrompt: string
    groundingInstruction: string
    retriever: string
  }
  rag: { schemaVersion: number; themeBypassEnabled?: boolean }
}

export type LanguageRuntime = {
  code: string
  voiceLanguageCode: string
  systemPrompt: string
  groundingInstruction: string
  /** Run the per-language retriever against the loaded sqlite. */
  retrieve: (text: string) => Promise<RetrievalResult>
  /** Direct theme delivery — fetches the canonical list from sqlite, no LLM. */
  resolveTheme: (themeKey: string) => Promise<string | null>
  /** sqlite db name registered with the host for queryPackDb. */
  dbName: string
}

export type RetrievalResult = {
  kind: "theme" | "lesson" | "lesson_diff" | "conjugation_one" | "conjugation_full" | "translation" | "none"
  reference: string | null
  themeKey?: string
  log: string[]
}

export type LanguageManagerOptions = {
  hostApi: HostApi
  packId: string
  registry: LanguageRegistryEntry[]
  /** Loader for a file inside the active language module dir (relative path). */
  loadModuleFile: (code: string, relativePath: string) => Promise<string>
  /** Returns whether the module ZIP for `code` is already downloaded + extracted. */
  isInstalled: (code: string) => Promise<boolean>
  /** Trigger module download + verify + extract. Throws on sha mismatch. */
  install: (entry: LanguageRegistryEntry, onProgress?: (p: LlmInstallProgress) => void) => Promise<void>
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
      this.opts.registry.map(async (e) =>
        (await this.opts.isInstalled(e.code)) ? e.code : null
      )
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

    const moduleJson = await this.opts.loadModuleFile(code, "module.json")
    const module: LanguageModule = JSON.parse(moduleJson)

    const [systemPrompt, groundingInstruction] = await Promise.all([
      this.opts.loadModuleFile(code, module.files.systemPrompt),
      this.opts.loadModuleFile(code, module.files.groundingInstruction),
    ])

    const dbName = `tutomaton-${code}`

    // The retriever is bundled as TS source in the language module and shipped
    // as part of the module ZIP. In production the polish machine will pre-
    // compile each module's retriever to JS and load it via dynamic import.
    // For now, the shell delegates to a per-language `retrieve` shim that the
    // module exports; the shell imports it lazily.
    const retrieveModule = await this._loadRetriever(code)

    const retrieve = async (text: string): Promise<RetrievalResult> => {
      return retrieveModule.retrieve(text, (sql: string, params: unknown[]) =>
        this.opts.hostApi.queryPackDb!({
          sql,
          params,
          dbName,
          packId: this.opts.packId,
        })
      )
    }

    const resolveTheme = async (themeKey: string): Promise<string | null> => {
      if (!module.rag.themeBypassEnabled) return null
      return retrieveModule.resolveTheme(themeKey, (sql: string, params: unknown[]) =>
        this.opts.hostApi.queryPackDb!({
          sql,
          params,
          dbName,
          packId: this.opts.packId,
        })
      )
    }

    this.active = {
      code,
      voiceLanguageCode: module.voiceLanguageCode,
      systemPrompt,
      groundingInstruction,
      retrieve,
      resolveTheme,
      dbName,
    }
    return this.active
  }

  current(): LanguageRuntime | null {
    return this.active
  }

  /**
   * Resolve the per-language retriever from the statically-bundled registry
   * (see `retrievers.ts`). A runtime `import()` cannot work in the IIFE bundle —
   * no runtime module graph, uncompiled TS source, and the specifier resolves to
   * the host's game-proxy origin (→ 404). The retriever is code, not content;
   * only the sqlite + prompts download lazily.
   *
   * Shape contract: every language's retriever exports:
   *   - retrieve(text, queryFn): Promise<RetrievalResult>
   *   - resolveTheme(key, queryFn): Promise<string | null>
   */
  private async _loadRetriever(code: string): Promise<{
    retrieve: (text: string, queryFn: QueryFn) => Promise<RetrievalResult>
    resolveTheme: (key: string, queryFn: QueryFn) => Promise<string | null>
  }> {
    const mod = RETRIEVERS[code]
    if (!mod) throw new Error(`No bundled retriever for language: ${code}`)
    return mod
  }
}

export type QueryFn = (sql: string, params: unknown[]) => Promise<{ columns: string[]; rows: unknown[][] }>
