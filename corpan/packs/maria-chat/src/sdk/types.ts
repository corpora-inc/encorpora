export type StackConfig = {
  activeStackId?: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
}

export type LocalLlmMessage = {
  role: string
  content: string
}

export type LocalLlmGenerateRequest = {
  modelPath: string
  messages: LocalLlmMessage[]
  maxTokens?: number
  temperature?: number
  topP?: number
  repeatPenalty?: number
  contextLength?: number
  packId?: string
}

export type LocalLlmStreamCallbacks = {
  onDelta?: (delta: string, accumulatedText: string) => void
  onDone?: (output: string) => void
  onCancelled?: (output: string) => void
  onError?: (message: string) => void
}

export type PackLlmModel = {
  id: string
  name: string
  relativePath: string
  absolutePath?: string
  exists: boolean
  sizeBytes?: number
  recommended: boolean
  quantType?: string
}

export type PackLlmDefaults = {
  temperature?: number
  topP?: number
  repeatPenalty?: number
  maxTokens?: number
  contextLength?: number
}

export type PackLlmConfig = {
  runtime?: string
  defaultModel?: string
  models: PackLlmModel[]
  defaults?: PackLlmDefaults
  chatTemplatePath?: string
}

export type LocalLlmRuntimeStatus = {
  backend: string
  commandPath: string
  available: boolean
  detail?: string
}

export type LocalLlmStreamHandle = {
  requestId: string
  cancel: () => Promise<boolean>
}

export type TtsVoiceGender = "male" | "female" | "unspecified"

export type TtsVoice = {
  id: string
  name?: string
  language: string
  gender?: TtsVoiceGender
  quality?: string
  engine?: string
  networkRequired?: boolean
}

export type HostApiSpeakVoiceOptions = {
  voiceId?: string
  rate?: number
}

export type HostApiTtsVoiceQuery = {
  languagePrefix?: string
  gender?: TtsVoiceGender
  femaleOnly?: boolean
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  speakWithVoice?: (
    uiCode: string,
    text: string,
    options?: HostApiSpeakVoiceOptions
  ) => Promise<void>
  listTtsVoices?: (query?: HostApiTtsVoiceQuery) => Promise<TtsVoice[]>
  stopSpeech?: () => Promise<void>
  getStackConfig: () => StackConfig
  getPackLlmConfig?: () => Promise<PackLlmConfig>
  getLocalLlmRuntimeStatus?: () => Promise<LocalLlmRuntimeStatus>
  startLocalLlmStream?: (
    request: LocalLlmGenerateRequest,
    callbacks?: LocalLlmStreamCallbacks
  ) => Promise<LocalLlmStreamHandle>
  cancelLocalLlmStream?: (requestId: string) => Promise<boolean>
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
