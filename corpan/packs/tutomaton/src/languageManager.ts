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

// Minimal slice of @corpan/sdk's HostApi that this pack actually uses.
// Inlined to keep the pack a leaf build with no workspace coupling.
export type HostApi = {
  speak: (locale: string, text: string) => Promise<void>
  stopSpeech?: () => void
  queryPackDb?: (args: {
    sql: string
    params: unknown[]
    dbName: string
    packId: string
  }) => Promise<{ columns: string[]; rows: unknown[][] }>
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
  install: (entry: LanguageRegistryEntry) => Promise<void>
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

  async ensureInstalled(code: string, onProgress?: (pct: number) => void): Promise<void> {
    const entry = this.opts.registry.find((e) => e.code === code)
    if (!entry) throw new Error(`Unknown language: ${code}`)
    if (await this.opts.isInstalled(code)) return
    onProgress?.(0)
    await this.opts.install(entry)
    onProgress?.(100)
  }

  async activate(code: string): Promise<LanguageRuntime> {
    if (this.active?.code === code) return this.active
    await this.ensureInstalled(code)

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
   * Lazily import the per-language retriever. The polish machine will wire this
   * to the bundler — each language module ships a precompiled retriever.js
   * alongside the source, and this loader pulls the precompiled one.
   *
   * Shape contract: every language's retriever exports:
   *   - retrieve(text, queryFn): Promise<RetrievalResult>
   *   - resolveTheme(key, queryFn): Promise<string | null>
   */
  private async _loadRetriever(code: string): Promise<{
    retrieve: (text: string, queryFn: QueryFn) => Promise<RetrievalResult>
    resolveTheme: (key: string, queryFn: QueryFn) => Promise<string | null>
  }> {
    // Module-relative path; resolved by the pack's bundler at build time.
    // The actual import path is rewritten by the build tool per language.
    return import(/* @vite-ignore */ `../languages/${code}/retrieval/retriever`)
  }
}

export type QueryFn = (sql: string, params: unknown[]) => Promise<{ columns: string[]; rows: unknown[][] }>
