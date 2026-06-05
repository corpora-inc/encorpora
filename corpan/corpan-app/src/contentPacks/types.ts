export type StackConfig = {
  activeStackId: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
  /** Enabled phrase-pack ids for the active stack. The sampler already keys
   *  on these; exposed so an experience can render "N packs / base off". */
  phrasePackIds: string[]
  /** Whether the bundled base corpus is sampled (vs. only phrase packs). */
  baseCorpusEnabled: boolean
  /** Whether scroll-driven prev/next navigation is enabled. */
  scrollNavigationEnabled: boolean
}

/** Partial patch an experience may apply to the active stack via
 *  {@link HostApi.setStackConfig}. Whitelisted axes only — an experience can
 *  never reach arbitrary host state. All JS-side (no Rust/wire boundary). */
export type StackConfigPatch = Partial<{
  levels: string[]
  rate: number
  domains: string[]
  languages: string[]
  textSize: string
  showRomanization: boolean
  scrollNavigationEnabled: boolean
  phrasePackIds: string[]
  baseCorpusEnabled: boolean
}>

/** A (entryId, source) pair the sampler uses for anti-repetition. */
export type HostHistoryRef = { entryId: number; source: string }

/** Per-stack navigation history surface for the phrase experience. Hides the
 *  per-stack bookkeeping; all methods self-scope to the active stack. */
export type HostHistoryApi = {
  getState: () => { ids: number[]; sources: string[]; index: number }
  push: (entryId: number, source?: string) => void
  setIndex: (index: number) => void
  replaceCurrent: (entryId: number, source?: string) => void
  getRecentTuples: (n: number) => HostHistoryRef[]
  /** Fires on active-stack history OR activeStackId changes. */
  subscribe: (listener: () => void) => () => void
}

/** Minimal installed-phrase-pack record for rendering source chips. */
export type HostInstalledPhrasePack = {
  id: string
  name: string
  nameLocalized?: Record<string, string>
  topic?: string
  topicLocalized?: Record<string, string>
  accentColor?: string
}

export type HostPhrasePacksApi = {
  getInstalled: () => Record<string, HostInstalledPhrasePack>
  /** Enable/disable a pack for the active stack (sugar over setStackConfig). */
  setEnabled: (id: string, on: boolean) => void
  subscribe: (listener: () => void) => () => void
}

export type TranslationOut = {
  language_code: string
  text: string
  romanization: string
}

export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
  /**
   * Source identifier: `"base"` for the bundled corpus, or the phrase-pack
   * id (e.g. `"phrase-botany-basics"`). `entry_id` is only unique within a
   * source — callers that resume from history need to remember the pair.
   */
  source: string
}

export type PackDbQuery = {
  sql: string
  params?: unknown[]
  dbName?: string
  packId?: string
  maxRows?: number
}

export type PackDbQueryResult = {
  columns: string[]
  rows: Record<string, unknown>[]
}

export type SttErrorCode =
  | "MODEL_NOT_INSTALLED"
  | "MODEL_NOT_LOADED"
  | "NETWORK"
  | "LOAD_FAILED"
  | "IO_FAILED"
  | "BUSY"
  | "CANCELLED"
  | "MIC_PERMISSION_DENIED"
  | "NO_ACTIVE_SESSION"
  | "AUDIO_FAILED"
  /** Native ran the unload+pressure-relief sequence but the OS still
   *  doesn't have enough RAM to safely allocate the new model. The
   *  previous model has been dropped at this point, so the pack
   *  should route to a "restart the app and try again" overlay
   *  rather than retry in-process. The only structured code that
   *  requires app relaunch for recovery. */
  | "INSUFFICIENT_MEMORY"
  | "UNKNOWN"

export type SttPrepareResult = {
  ready: boolean
  model: string
  message?: string
  /** Structured error code when ready === false. Undefined on success. */
  code?: SttErrorCode
}

export type SttInstalledModel = {
  model: string
  valid: boolean
  problems: string[]
  sizeBytes: number
  isLoaded: boolean
}

export type SttListInstalledResult = {
  models: SttInstalledModel[]
}

export type SttStartSessionResult = {
  started: boolean
  sessionId: string
}

export type SttStatus = {
  available: boolean
  prepared: boolean
  model: string | null
  recording: boolean
  message: string | null
  /** Per-app jetsam budget in MB. iOS 13+; null on older. */
  availableMemoryMB?: number | null
  /** Total physical RAM on the device in MB. */
  physicalMemoryMB?: number | null
  /** Set by the Android plugin on the first getStatus after a prior
   *  on-device whisper init crashed (uncatchable native SIGSEGV/abort in
   *  ggml model load). The native side wrote a breadcrumb before the crash
   *  and held it across the restart; the host's getStatus wrapper records
   *  it once into on-device analytics, then the field is cleared natively.
   *  JSON string with `model`/`instanceOrdinal`/`instancesCreated`/`uptimeMs`. */
  priorInitCrash?: string | null
}

export type SttWordTiming = {
  word: string
  startMs: number
  endMs: number
  probability: number
}

export type SttTranscriptionResult = {
  sessionId: string
  text: string
  expectedText: string
  /** Full code the pack passed in (e.g. "pa-Arab", "zh-Hans"). */
  language: string
  /** Two-letter code actually sent to Whisper (e.g. "pa", "zh"). */
  whisperLanguage: string
  durationMs: number
  overallScore: number
  transcriptScore: number
  likelihoodScore: number
  /** Per-word posterior + per-language ramp + penalty stack. 0..1. */
  acousticScore: number
  avgLogprob: number
  /** Whisper's no-speech posterior (max across segments). > 0.5 → mic was silent. */
  noSpeechProb: number
  /** Repetition / gibberish detector (max). > 2.4 → caps overall ≤ 0.4. */
  compressionRatio: number
  /** Sampling temperature (max). > 0 → decoder fell back. */
  temperature: number
  /** Min chosen-token logprob (worst single decoded token). */
  minTokenLogprob: number
  /** Stdev of chosen-token logprobs (high = patchy confidence). */
  tokenLogprobStdev: number
  /** Levenshtein(free-decode, expected). 1.0 if dual-decode disabled. */
  freeVsConstrainedSimilarity: number
  /** Free-decode transcript (no prompt/prefix bias). Empty if disabled. */
  freeText: string
  words: SttWordTiming[]
}

// ============================================================
// On-device LLM (tauri-plugin-corpan-llm) — consumed by tutor packs
// ============================================================

export type LlmChatMessage = { role: "system" | "user" | "assistant"; content: string }

export type LlmChatOptions = {
  temperature?: number
  topP?: number
  repeatPenalty?: number
  maxTokens?: number
  stop?: string[]
}

export type LlmStatus = {
  loaded: boolean
  modelId?: string | null
  backend?: string | null
  availableMemoryMb?: number | null
}

/** Callbacks for a streaming generation. */
export type LlmChatHandlers = {
  onToken: (token: string) => void
  onDone: (full: string, stats?: { totalTokens: number; elapsedMs: number }) => void
  onError: (error: string, code?: string) => void
}

/** Handle to an in-flight generation. */
export type LlmChatHandle = {
  sessionId: string
  /** Request cancellation; the stream ends via onDone/onError shortly after. */
  cancel: () => Promise<void>
}

/** Args to download+install a base model pack (a GGUF content-pack ZIP). */
export type LlmModelInstall = {
  /** Pack id, e.g. "llm-base-qwen3-4b-v1". Becomes the on-disk dir name. */
  packId: string
  /** Full ZIP URL (CDN). */
  url: string
  /** Optional sha256 of the ZIP; verified when present. */
  sha256?: string
}

/** Progress during a model install. Mirrors the host `pack-install-progress`
 *  event: `downloading` carries byte counts; other stages carry a message. */
export type LlmInstallProgress = {
  stage: "downloading" | "verifying" | "extracting" | "finalizing" | "error" | string
  /** Bytes downloaded so far (downloading stage), else 0. */
  progress: number
  /** Total bytes (downloading stage, when known), else 0. */
  total: number
  message: string
}

/**
 * On-device LLM runtime bridge (Metal on Apple / CPU elsewhere). Optional on the
 * host so packs feature-detect; present whenever `tauri-plugin-corpan-llm` is
 * registered. Streaming is callback-based (the host owns the Tauri event
 * listeners and tears them down on done/error/cancel) so packs never touch
 * `window.__TAURI__`.
 */
export type LlmApi = {
  status: () => Promise<LlmStatus>
  /** Whether a model pack's files are present on disk (does not load it). */
  isInstalled: (packId: string) => Promise<boolean>
  /** Download + extract a base model pack ZIP to disk, with progress. */
  install: (args: LlmModelInstall, onProgress?: (p: LlmInstallProgress) => void) => Promise<void>
  /** Load a base model pack (e.g. "llm-base-qwen3-4b-v1"). Multi-second cold load. */
  load: (args: { modelPackId: string; gpuLayers?: number; contextSize?: number }) => Promise<void>
  unload: () => Promise<void>
  /** Begin a streaming chat. Resolves once the session is registered + listeners armed. */
  chat: (
    args: { messages: LlmChatMessage[]; options?: LlmChatOptions },
    handlers: LlmChatHandlers,
  ) => Promise<LlmChatHandle>
}

export type SttApi = {
  isAvailable: () => Promise<boolean>
  getStatus: () => Promise<SttStatus>
  prepare: (opts?: { model?: string }) => Promise<SttPrepareResult>
  startSession: (opts: {
    sessionId: string
    language: string
    expectedText: string
  }) => Promise<SttStartSessionResult>
  stopSession: (opts: { sessionId: string }) => Promise<SttTranscriptionResult>
  cancelSession: (opts: { sessionId: string }) => Promise<void>
  /**
   * Wipes the on-disk model dir + download cache for the given model name
   * (or default if omitted). Used as an explicit reset.
   */
  wipeModel?: (opts?: { model?: string }) => Promise<{
    wiped: boolean
    message?: string
  }>
  /**
   * Inspects on-disk model files. Returns `valid: true` when every
   * required `.mlmodelc/weights/weight.bin` is present and ≥ 1 KB.
   */
  validateModel?: (opts?: { model?: string }) => Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  /**
   * Downloads a model from Hugging Face into the app's data dir, then
   * verifies file integrity. Calls `onProgress` with `phase` ∈
   * `downloading | verifying | verified | failed`. Throws on failure.
   */
  installModel?: (
    opts: {
      model: string
      /** Optional override of the source URL. Used for models we host
       *  ourselves on our own CDN (e.g. self-quantized Whisper Large
       *  q8 ggerganov doesn't publish). When omitted the native
       *  plugin defaults to the hardcoded HuggingFace base. */
      downloadUrl?: string
    },
    onProgress?: (event: SttInstallProgress) => void,
  ) => Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  /**
   * Reports the disk-truth install state for every requested variant in a
   * single round-trip. Use this on boot and when opening the setup overlay
   * — the pack should not cache install booleans in localStorage.
   */
  listInstalled?: (opts: {
    models: string[]
  }) => Promise<SttListInstalledResult>
  /**
   * Drops the in-memory WhisperKit instance without touching disk. Safe
   * to call on memory warnings or when the pack closes; the next
   * `prepare()` is a load, not a download.
   */
  unload?: () => Promise<{ unloaded: boolean }>
  /**
   * Tear down the audio engine + audio session entirely. Distinct from
   * `cancelSession`, which deliberately keeps the engine warm across
   * back-to-back recordings inside one pack session. **Call this from
   * the pack's `unmount`** — without it, on iOS the orange mic
   * indicator stays on and `.duckOthers` keeps the rest of the app
   * (and other apps) softer until the next process restart.
   */
  releaseAudio?: () => Promise<void>
  /**
   * Subscribes to a per-buffer audio-level stream emitted by the
   * native plugin while a recording session is active. Fires at the
   * platform's natural buffer cadence — ~11 Hz on iOS, ~8 Hz on
   * Android. Pack JS uses this for client-side silence detection
   * (auto-stop on quiet). Returns an unsubscribe function. Optional
   * because older host builds don't ship it; packs should feature-
   * detect.
   */
  subscribeAudioLevel?: (
    callback: (event: SttAudioLevelEvent) => void,
  ) => Promise<() => void>
}

export type SttAudioLevelEvent = {
  /** RMS amplitude of the latest captured buffer, 0..1. */
  rms: number
  /** Milliseconds since the current session started. */
  t: number
}

export type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
  /** Structured error code on `phase === "failed"`. Undefined otherwise. */
  code?: SttErrorCode
}

/** A TTS voice the host can speak with (for a pack's sticky per-NPC voice). */
export type HostVoiceInfo = {
  id: string
  name?: string
  /** BCP-47 (e.g. "es-MX"). */
  language: string
  /** Gender when the platform exposes it (iOS/macOS do; Android often doesn't). */
  gender?: "male" | "female" | "unspecified"
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  /** Speak concurrently (allows overlapping audio). Returns utterance ID. */
  speakConcurrent?: (uiCode: string, text: string) => Promise<string>
  stopSpeech?: () => Promise<void>
  /** Enumerate available TTS voices (optionally filtered to a language), with
   *  gender when known — lets a pack pin a sticky, gender-matched voice per NPC. */
  listVoices?: (uiCode?: string) => Promise<HostVoiceInfo[]>
  /** Speak `text` with a SPECIFIC voice id (from `listVoices`), not just a
   *  language — the mechanism behind a pack's per-NPC sticky voice. */
  speakVoice?: (uiCode: string, text: string, voiceId: string) => Promise<void>
  /** Copy text to the system clipboard (native — WKWebView blocks the web API). */
  copyText?: (text: string) => Promise<void>
  dispose?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  /** Apply a partial config patch to the active stack (whitelisted axes). */
  setStackConfig?: (patch: StackConfigPatch) => void
  /** Open the host's compact Quick Settings sheet (speed / languages / levels /
   *  active phrase packs) over the running pack. Feature-detect on older hosts. */
  openQuickSettings?: () => void
  /** Per-stack navigation history (for the phrase experience). */
  history?: HostHistoryApi
  /** Feed the host's rating-prompt counter (host owns the actual prompt). */
  notifyUtterance?: () => void
  /** Installed phrase-pack registry (for source chips + enable/disable). */
  phrasePacks?: HostPhrasePacksApi
  getRandomEntry: () => Promise<EntryOut>
  /**
   * Sample N random entries. Accepts EITHER the legacy numeric `count` OR an
   * options object carrying a CONTENT FILTER (`domains`/`levels`/`languageCodes`).
   * The numeric form preserves the historical behaviour (user-global `levels`
   * from settings, domains intentionally NOT forwarded). The options form lets a
   * pack request a THEMED + LEVEL-SCALED draw — e.g. World Plaza binds a café NPC
   * to food/everyday phrases and a dock keeper to travel phrases at the player's
   * level — by forwarding the filter to `get_random_entries_with_translations`,
   * whose relaxation ladder degrades a starved filter rather than returning empty.
   * ADDITIVE + back-compatible: existing callers pass a number unchanged.
   */
  getRandomEntries?: (
    q: number | { count: number; domains?: string[]; levels?: string[]; languageCodes?: string[] },
  ) => Promise<EntryOut[]>
  /**
   * Resolve an entry by id. `source` defaults to `"base"` (bundled corpus).
   * For phrase-pack entries, pass the pack id you stored alongside the
   * `entry_id` (read from `EntryOut.source` on the original sample).
   */
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
  searchEntriesByText?: (options: {
    text: string
    languageCodes?: string[]
    limit?: number
    offset?: number
  }) => Promise<EntryOut[]>
  searchEntriesByTextCount?: (options: {
    text: string
    languageCodes?: string[]
  }) => Promise<number>
  queryPackDb?: (query: PackDbQuery) => Promise<PackDbQueryResult>
  /** Download + extract a module ZIP into a subpath of this pack's on-disk dir
   *  (e.g. a tutor pack's per-language data). Writes the pack manifest if absent
   *  so `queryPackDb` can resolve the pack's `databases` map. */
  installModuleZip?: (
    args: { packId: string; subPath: string; url: string; sha256?: string; packManifest?: string },
    onProgress?: (p: LlmInstallProgress) => void,
  ) => Promise<void>
  /** Whether `corpan-packs/<packId>/<relPath>` exists on disk and is non-empty. */
  packFileExists?: (packId: string, relPath: string) => Promise<boolean>
  /** Discover installed content packs of a given `packType` (e.g.
   *  "tutomaton-rag-source"), surfacing source-descriptor fields from each pack's
   *  manifest. Tutomaton's RAG SourceRegistry uses this to pick up installed
   *  source packs at runtime. Native discovery is pending — ships as a `[]` stub,
   *  so packs run with built-in sources only until the native command lands. */
  discoverPacksByType?: (packType: string) => Promise<
    Array<{
      id: string
      packId: string
      name?: Record<string, string>
      tutomatonLanguage: string | string[]
      authoritative: boolean
      priority?: number
      categories?: string[]
      schemaVersion?: number
      requiredHostApis?: string[]
      dbName?: string | null
    }>
  >
  stt?: SttApi
  /** On-device LLM runtime (present when tauri-plugin-corpan-llm is registered). */
  llm?: LlmApi
  isMock?: boolean
}

export type ContentPackManifest = {
  id: string
  name: string
  version: string
  entry: string
  styles?: string[]
  baseUrl?: string
  entryType?: "script" | "module"
  sdkVersion?: string
  permissions?: string[]
  databases?: Record<string, string>
  devRevision?: string
}

export type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
}
