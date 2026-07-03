// The host slice a capability may touch (capability-modules.md §2.1).
//
// Following the corpan-city discipline ("declare only the slice we touch"),
// capabilities do NOT import the app's HostApi type. This is a structural
// subset that the real `createHostApi()` object, any pack's vendored hostApi,
// and the mock (core/mock) all satisfy.
//
// The STT types below are the fleet's ONE copy — MOVED here from
// packs/pronunciation-coach/src/game.ts as part of the cap-pronounce
// extraction (§4.1). The pack imports them from here now.

export interface CapabilityStackConfig {
  languages: string[] // [0]=native/UI, [1..]=targets (SINGLE_LANGUAGE_RULE)
  rate?: number
  showRomanization?: boolean
  levels?: string[]
}

// ---------------------------------------------------------------- STT slice

/** Codes mirror the host's SttErrorCode union (hostApi.ts / STT plugin). */
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
  | "INSUFFICIENT_MEMORY"
  // Plugin reports this when the underlying native lib failed to load
  // on this device — e.g. x86_64 Chromebook running Android via ARC
  // where libhoudini can't translate the armv8.2-a SIMD intrinsics
  // whisper.cpp is compiled with. Different from MODEL_NOT_INSTALLED
  // (which means "download the model and you're good"): here, no
  // model would ever load.
  | "STT_UNAVAILABLE"
  // Native guard rejected the language: whisper can't score it.
  | "UNSUPPORTED_LANGUAGE"
  | "UNKNOWN"

export type SttPrepareResult = {
  ready: boolean
  model: string
  message?: string
  code?: SttErrorCode
}

export type SttStartResult = { started: boolean; sessionId: string }

export type SttInstalledModel = {
  model: string
  valid: boolean
  problems: string[]
  sizeBytes: number
  isLoaded: boolean
}

export type SttListInstalledResult = { models: SttInstalledModel[] }

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
  /** One-shot native-init crash breadcrumb from the previous process. */
  priorInitCrash?: string | null
}

export type SttWordTiming = {
  word: string
  startMs: number
  endMs: number
  probability: number
}

/** The 18-field transcription result whisper hosts return from stopSession. */
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
  code?: SttErrorCode
}

/**
 * The STT host slice as parlometron declares it. Per-call tuning params are
 * `Record<string, unknown>`-shaped at this seam (the concrete WhisperParams /
 * ScoringParams tables live in @shared/capabilities/pronounce, which the
 * pronounce module and the pack both consume).
 */
export type CapabilitySttApi = {
  isAvailable(): Promise<boolean>
  getStatus(): Promise<SttStatus>
  prepare(opts?: { model?: string }): Promise<SttPrepareResult>
  startSession(opts: {
    sessionId: string
    language: string
    expectedText: string
    /** Per-call overrides applied on top of `whisper_full_default_params`
     *  in the native plugin. Built from `mergeForLang(lang)`. */
    whisperParams?: Record<string, unknown>
    /** Per-call scoring overrides. Built from
     *  `mergeScoringForLangModel(lang, modelFolder)`. */
    scoringParams?: Record<string, unknown>
  }): Promise<SttStartResult>
  stopSession(opts: { sessionId: string }): Promise<SttTranscriptionResult>
  cancelSession(opts: { sessionId: string }): Promise<void>
  wipeModel?(opts?: { model?: string }): Promise<{ wiped: boolean; message?: string }>
  validateModel?(opts?: { model?: string }): Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  installModel?(
    opts: {
      model: string
      /** Optional override of the source URL (self-hosted CDN variants). */
      downloadUrl?: string
    },
    onProgress?: (event: SttInstallProgress) => void
  ): Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  listInstalled?(opts: { models: string[] }): Promise<SttListInstalledResult>
  unload?(): Promise<{ unloaded: boolean }>
  /** Tear down the audio engine + audio session. Call from unmount paths —
   *  without it, the iOS mic indicator stays on and audio is
   *  `.duckOthers`-ed until the next process kill. */
  releaseAudio?(): Promise<void>
  /** Subscribe to per-buffer RMS events while a session is recording.
   *  Optional — older host builds don't ship it. */
  subscribeAudioLevel?(
    callback: (event: SttAudioLevelEvent) => void,
  ): Promise<() => void>
}

// ------------------------------------------------------------ error helpers
// MOVED from pronunciation-coach/src/game.ts (`errCode`, `formatErr`).

/** Read a code attached by hostApi.ts (`sttRejectionToError`) onto thrown
 *  errors. Plain string/Error fallback returns undefined so callers can
 *  route only when the code is genuinely available. */
export const sttErrCode = (err: unknown): SttErrorCode | undefined => {
  if (err && typeof err === "object") {
    const c = (err as { code?: unknown }).code
    if (typeof c === "string") return c as SttErrorCode
  }
  return undefined
}

/** Robust error → string. Tauri plugin errors come across the JS bridge as
 *  plain objects (`{ message, code, domain }`), not `Error` instances — the
 *  common `err instanceof Error ? msg : String(err)` pattern collapses them
 *  to `"[object Object]"`. Walk the common shapes first. */
export const formatErr = (err: unknown): string => {
  if (err == null) return "(unknown error)"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message || err.name || String(err)
  if (typeof err === "object") {
    const o = err as Record<string, unknown>
    const candidates = [
      o.message,
      o.localizedDescription,
      o.error,
      o.description,
      o.detail,
    ]
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c
    }
    try {
      const json = JSON.stringify(err)
      if (json && json !== "{}") return json
    } catch {
      // fall through
    }
  }
  return String(err)
}

// -------------------------------------------------------------- host slice

export interface CapabilityHostApi {
  // Required core (every host has these — sdk 5-method core):
  speak(uiCode: string, text: string): Promise<void>
  getStackConfig(): CapabilityStackConfig

  // Optional — feature-detect, degrade gracefully:
  stopSpeech?(): Promise<void>
  stt?: CapabilitySttApi
  queryPackDb?(q: {
    sql: string
    params?: unknown[]
    dbName?: string
    packId?: string
    maxRows?: number
  }): Promise<{ columns: string[]; rows: unknown[][] }>
  entitlement?: { isSubscribed(): boolean }
  isMock?: boolean
}
