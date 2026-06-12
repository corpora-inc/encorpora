/**
 * beatlounge — the host API the pack consumes from the Corpán app.
 *
 * Superset of melopan's minimal HostApi, modelling the real corpan-app
 * contract (corpan-app/src/contentPacks/types.ts): TTS, the phrase corpus,
 * and the on-device Qwen3 4B LLM. Plus the NEW `synthesizeToBuffer` capability
 * this pack requests for live TTS-on-grid (feature-detected; the pack degrades
 * to the bundled fragment kit / synth-vox when it is absent).
 */

export type StackConfig = {
  activeStackId?: string
  /** languages[0] = native, languages[1..] = targets. */
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
}

export type TranslationOut = {
  language_code: string
  text: string
  romanization?: string
}

export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
  source?: string
}

export type RandomEntriesQuery = {
  count: number
  domains?: string[]
  levels?: string[]
  languageCodes?: string[]
}

export type SearchEntriesQuery = {
  text: string
  languageCodes?: string[]
  limit?: number
  offset?: number
}

export type VoiceInfo = {
  id: string
  name?: string
  language: string
  engine?: string
  gender?: string
  quality?: string
  networkRequired?: boolean
}

// ------------------------------------------------------------------- LLM
export type LlmChatMessage = { role: "system" | "user" | "assistant"; content: string }

export type LlmChatOptions = {
  temperature?: number
  topP?: number
  topK?: number
  minP?: number
  repeatPenalty?: number
  presencePenalty?: number
  maxTokens?: number
  stop?: string[]
}

export type LlmChatHandlers = {
  onToken: (token: string) => void
  onDone: (full: string, stats?: { totalTokens: number; elapsedMs: number }) => void
  onError: (error: string, code?: string) => void
}

export type LlmChatHandle = { sessionId: string; cancel: () => Promise<void> }

export type LlmStatus = {
  loaded: boolean
  modelId?: string
  backend?: string
  availableMemoryMb?: number
}

export type LlmApi = {
  status: () => Promise<LlmStatus>
  chat: (
    args: { messages: LlmChatMessage[]; options?: LlmChatOptions },
    handlers: LlmChatHandlers
  ) => Promise<LlmChatHandle>
}

// ------------------------------------------------------------------- TTS capture
/** Result of rendering TTS to raw audio (the NEW native capability). */
export type SynthesizeResult = {
  /** 16-bit PCM or Float32 bytes — `codec` disambiguates. */
  pcm: ArrayBuffer
  sampleRate: number
  channels: 1
  durationMs: number
  voiceId: string
  codec?: "pcm-i16" | "pcm-f32" | "wav"
}

// ------------------------------------------------------------------- HostApi
export type HostApi = {
  // TTS (fire-and-forget playback)
  speak: (lang: string, text: string) => void | Promise<void>
  speakConcurrent?: (lang: string, text: string) => Promise<string>
  speakVoice?: (lang: string, text: string, voiceId: string) => Promise<void>
  stopSpeech?: () => void
  listVoices?: (lang?: string) => Promise<VoiceInfo[]>

  /** NEW: render TTS to a raw buffer instead of speaking it. Optional —
   *  feature-detect; absent on older hosts. iOS AVSpeechSynthesizer.write,
   *  Android TextToSpeech.synthesizeToFile. */
  synthesizeToBuffer?: (text: string, lang: string, voiceId?: string) => Promise<SynthesizeResult>

  // Config
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void

  // Phrase corpus
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (q: number | RandomEntriesQuery) => Promise<EntryOut[]>
  getEntryById?: (entryId: number, source?: string) => Promise<EntryOut>
  searchEntriesByText?: (q: SearchEntriesQuery) => Promise<EntryOut[]>
  searchEntriesByTextCount?: (q: Omit<SearchEntriesQuery, "limit" | "offset">) => Promise<number>

  // On-device LLM
  llm?: LlmApi

  isMock?: boolean
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
