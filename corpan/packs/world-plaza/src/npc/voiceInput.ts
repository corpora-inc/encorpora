/**
 * VoiceInput — the backend-agnostic voice-capture seam.
 *
 * This is the contract from `docs/MODEL_STRATEGY.md §5`, reproduced here so the
 * NPC dialogue runtime can code against ONE interface while "native STT vs
 * Whisper vs keyboard-only" stays a per-platform / per-language implementation
 * detail. Voice is NOT implemented yet — `KeyboardVoiceInput` is the shipping
 * floor (no model, every language, every device). The real `NativeVoiceInput`
 * (iOS `SpeechAnalyzer`, Android `SpeechRecognizer`) and `WhisperVoiceInput`
 * (LLM-unloaded fallback) land later behind a `tauri-plugin-native-stt` plugin.
 *
 * The broker rule the seam encodes: only a backend whose `concurrentWithLlm` is
 * true may capture while Qwen3 is resident. Whisper (`concurrentWithLlm:false`,
 * in-process) requires the model broker to unload the LLM first.
 */

export type VoiceBackend = "native" | "whisper" | "none"

export interface VoiceAvailability {
  /** Can we capture voice for this lang at all (any backend)? */
  available: boolean
  /** Which backend would serve it right now. */
  backend: VoiceBackend
  /** True only when it runs out-of-process (native) → safe alongside resident LLM. */
  concurrentWithLlm: boolean
  /** Native pack present, or needs a one-time download first. */
  needsDownload: boolean
}

export interface VoiceTranscript {
  transcript: string
  confidence: number // 0..1
  language: string // BCP-47 actually used
  backend: VoiceBackend
  isPartial?: boolean // streaming interim result
}

export interface VoiceInput {
  /** Probe — drives whether the UI shows a mic or a keyboard for this lang. */
  isOnDeviceAvailable(lang: string): Promise<VoiceAvailability>
  /** Provision a missing on-device language pack (native) ahead of use. */
  ensureLanguage(lang: string): Promise<boolean>
  /** Begin capture. Rejects if backend unavailable; may stream partials via onPartial. */
  start(lang: string, onPartial?: (t: VoiceTranscript) => void): Promise<void>
  /** End capture, resolve final transcript. */
  stop(): Promise<VoiceTranscript>
  cancel(): Promise<void>
}

/**
 * The degenerate "voice" backend that is really the keyboard floor. Reports
 * unavailable so the dialogue UI renders a text field instead of a mic, and
 * rejects any actual capture attempt. This is what ships today; swapping in a
 * real backend later is a one-line change at the `resolveVoiceInput` seam.
 */
export class KeyboardVoiceInput implements VoiceInput {
  async isOnDeviceAvailable(_lang: string): Promise<VoiceAvailability> {
    return { available: false, backend: "none", concurrentWithLlm: false, needsDownload: false }
  }
  async ensureLanguage(_lang: string): Promise<boolean> {
    return false
  }
  async start(_lang: string, _onPartial?: (t: VoiceTranscript) => void): Promise<void> {
    throw new Error("Voice capture is not available yet — use the keyboard.")
  }
  async stop(): Promise<VoiceTranscript> {
    throw new Error("No active voice capture.")
  }
  async cancel(): Promise<void> {
    /* nothing to cancel */
  }
}

/**
 * Thin resolver the runtime calls instead of `new`-ing a backend directly.
 * Today it always returns the keyboard floor; later it inspects the platform +
 * the per-language probe (native → Whisper-opt-in → keyboard) and returns the
 * right `VoiceInput`. Keeping the indirection now means game logic never branches
 * on backend.
 */
export function resolveVoiceInput(): VoiceInput {
  return new KeyboardVoiceInput()
}
