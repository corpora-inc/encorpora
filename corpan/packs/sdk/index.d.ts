export type StackConfig = {
  activeStackId: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
  phrasePackIds: string[]
  baseCorpusEnabled: boolean
  scrollNavigationEnabled: boolean
}

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

export type HostHistoryRef = { entryId: number; source: string }

export type HostHistoryApi = {
  getState: () => { ids: number[]; sources: string[]; index: number }
  push: (entryId: number, source?: string) => void
  setIndex: (index: number) => void
  replaceCurrent: (entryId: number, source?: string) => void
  getRecentTuples: (n: number) => HostHistoryRef[]
  subscribe: (listener: () => void) => () => void
}

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
   * Source identifier: `"base"` for the bundled corpus, or a phrase-pack
   * id (e.g. `"phrase-botany-basics"`). `entry_id` is only unique within
   * a source — game packs that resume from history need to remember the
   * `(source, entry_id)` pair and pass `source` to `getEntryById`.
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
  language: string
  whisperLanguage: string
  durationMs: number
  overallScore: number
  transcriptScore: number
  likelihoodScore: number
  acousticScore: number
  avgLogprob: number
  noSpeechProb: number
  compressionRatio: number
  temperature: number
  minTokenLogprob: number
  tokenLogprobStdev: number
  freeVsConstrainedSimilarity: number
  freeText: string
  words: SttWordTiming[]
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
  wipeModel?: (opts?: { model?: string }) => Promise<{
    wiped: boolean
    message?: string
  }>
  validateModel?: (opts?: { model?: string }) => Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  installModel?: (
    opts: { model: string },
    onProgress?: (event: SttInstallProgress) => void,
  ) => Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  listInstalled?: (opts: {
    models: string[]
  }) => Promise<SttListInstalledResult>
  unload?: () => Promise<{ unloaded: boolean }>
}

export type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
  code?: SttErrorCode
}

// --- ASR (pure transcription / dictation) ----------------------------------
// The provider-agnostic "speak instead of type" surface. Distinct from the
// `stt` slice above, which is Parlometron's whisper-backed alignment/scoring.
// Full design + the Rust wire contract: corpan/docs/STT_MASTERPLAN.md and the
// `@shared/asr` module (packs/shared/asr). These declarations mirror that
// module (the SDK stays standalone — no cross-package import).

export type AsrProviderId = "native" | "whisper" | "qwen3" | "sherpa"
export type AsrLatencyClass = "instant" | "fast" | "batch"
export type AsrCaptureMode = "push_to_talk" | "auto_stop"

export type AsrCapability = {
  providerId: AsrProviderId
  languages: string[]
  onDevice: boolean
  modelSizeMB: number
  residentMemoryMB: number
  streaming: boolean
  latencyClass: AsrLatencyClass
  needsDownload: boolean
  autoregressive: boolean
}

export type AsrTranscript = {
  text: string
  confidence: number
  language: string
}

export type AsrSession = {
  onPartial(cb: (text: string) => void): void
  onLevel(cb: (rms: number, tMs: number) => void): void
  onError(cb: (code: string, message?: string) => void): void
  stop(): Promise<AsrTranscript>
  cancel(): void
}

export type AsrProvider = {
  readonly id: AsrProviderId
  capabilities(): Promise<AsrCapability>
  isAvailable(lang: string): Promise<{ ok: boolean; needsDownload: boolean }>
  ensure(lang: string): Promise<{ ready: boolean; downloading: boolean }>
  transcribe(opts: { lang: string; mode: AsrCaptureMode }): Promise<AsrSession>
}

export type AsrGoal = "dictation" | "challenge"

/** Selection surface. `pick` returns null to mean "use the keyboard" — the
 *  permanent floor; callers MUST handle null. */
export type AsrApi = {
  provider: (id: AsrProviderId) => Promise<AsrProvider | null>
  pick: (args: {
    lang: string
    budgetMB?: number
    goal?: AsrGoal
  }) => Promise<AsrProvider | null>
}

// --- Model & asset registry (host.models) ----------------------------------
export type AssetKind =
  | "asr-model" | "llm" | "narration" | "phrase-pack" | "sound"

export type AssetRecord = {
  id: string
  kind: AssetKind
  sizeMB: number
  path: string | null
  refCount: number
}

export type ModelBudget = {
  availableMB: number
  physicalMB: number
  resident: { id: string; mb: number; kind: AssetKind }[]
}

/** Refcount/dedup store for ALL on-device assets + a live memory Budget
 *  Arbiter. `whatFitsAlongside` answers "which ASR engines fit RIGHT NOW with
 *  the 4B LLM loaded?" — the question Corpan City/Tutomaton consult. */
export type ModelsApi = {
  list: () => Promise<AssetRecord[]>
  ensure: (
    assetId: string,
    args: { source: string; sizeMB: number; kind: AssetKind },
  ) => Promise<{ ready: boolean; downloading: boolean }>
  locate: (assetId: string) => Promise<string | null>
  evict: (assetId: string) => Promise<void>
  budget: () => Promise<ModelBudget>
  fits: (
    req: { assetId?: string; residentMB?: number },
  ) => Promise<{ fits: boolean; mustEvict: string[] }>
  whatFitsAlongside: (residentIds: string[]) => Promise<AsrCapability[]>
}

/** Result of rendering TTS to a raw audio buffer (see `synthesizeToBuffer`). */
export type HostSynthesizeResult = {
  /** Raw audio bytes — `codec` disambiguates (a WAV container or raw PCM). */
  pcm: ArrayBuffer
  sampleRate: number
  channels: number
  durationMs: number
  voiceId: string
  codec: "wav" | "pcm-i16" | "pcm-f32"
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  /** Render TTS to a RAW AUDIO buffer instead of speaking it — lets a pack play
   *  captured TTS through its own Web Audio graph (e.g. a music pack that must
   *  not let OS `speak()` duck its mix). Optional & feature-detected: backed by
   *  native `synthesize_to_buffer` (iOS AVSpeechSynthesizer.write / Android
   *  synthesizeToFile); rejects on desktop / hosts without the command. */
  synthesizeToBuffer?: (
    text: string,
    lang: string,
    voiceId?: string,
  ) => Promise<HostSynthesizeResult>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  setStackConfig?: (patch: StackConfigPatch) => void
  history?: HostHistoryApi
  notifyUtterance?: () => void
  phrasePacks?: HostPhrasePacksApi
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
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
  stt?: SttApi
  /** Provider-agnostic dictation ("speak instead of type"). Optional: absent
   *  on hosts/builds without the asr-* plugins → packs fall back to the
   *  keyboard (or the `stt` scorer for known-target challenges). */
  asr?: AsrApi
  /** On-device model & asset registry + memory Budget Arbiter. Optional for
   *  the same reason; power packs guard on its presence before reasoning
   *  about co-residency. */
  models?: ModelsApi
  isMock?: boolean
}

export type GameModule = {
  id: string
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
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
}

export function registerGame(game: GameModule): GameModule

export function createMockHostApi(options?:
  Partial<HostApi> & {
    stackConfig?: Partial<StackConfig>
  }
): HostApi

export function mountStandalone(
  game: GameModule,
  options?: {
    container?: HTMLElement
    hostApi?: HostApi
    initialState?: Record<string, unknown>
  }
): { unmount?: () => void }
