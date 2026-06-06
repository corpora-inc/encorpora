/**
 * The minimal slice of the Corpán host API (`corpan-app/src/contentPacks/
 * types.ts`) that the World Plaza NPC dialogue system consumes. We re-declare it
 * locally (rather than importing across packages) so this pack stays a
 * self-contained IIFE — the same posture tutomaton takes. Keep these shapes in
 * lockstep with the host's `LlmApi` / `HostApi`.
 */

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

export type LlmChatHandlers = {
  onToken: (token: string) => void
  onDone: (full: string, stats?: { totalTokens: number; elapsedMs: number }) => void
  onError: (error: string, code?: string) => void
}

export type LlmChatHandle = {
  sessionId: string
  cancel: () => Promise<void>
}

export type LlmModelInstall = { packId: string; url: string; sha256?: string }

export type LlmInstallProgress = {
  stage: "downloading" | "verifying" | "extracting" | "finalizing" | "error" | string
  progress: number
  total: number
  message: string
}

export type LlmApi = {
  status: () => Promise<LlmStatus>
  isInstalled: (packId: string) => Promise<boolean>
  install?: (args: LlmModelInstall, onProgress?: (p: LlmInstallProgress) => void) => Promise<void>
  load: (args: { modelPackId: string; gpuLayers?: number; contextSize?: number }) => Promise<void>
  unload: () => Promise<void>
  chat: (
    args: { messages: LlmChatMessage[]; options?: LlmChatOptions },
    handlers: LlmChatHandlers,
  ) => Promise<LlmChatHandle>
}

/**
 * One platform TTS voice as the host would expose it to a pack. Mirrors the
 * host's internal `VoiceInfo` (corpan-app `src/util/tts-voices.ts`) but trimmed to
 * the fields a pack needs to pick a sticky per-NPC voice.
 *
 * HOST GAP (CHANGE 2): the host does NOT currently expose voice listing OR a
 * per-utterance voice id to packs — `hostApi.speak(uiCode, text)` only takes a
 * language code, and the native `plugin:tts|speak` `voice_id` arg is not reachable
 * from a pack. These optional members are the SPEC for closing that gap (see
 * `npcVoice.ts` header). When absent, `npcVoice` degrades to a deterministic
 * choice it cannot enforce at the TTS layer (best-effort) and logs the gap once.
 */
export type HostVoiceInfo = {
  /** Stable platform voice id (Apple voiceURI / Android Voice name). */
  id: string
  /** Human label, when known. */
  name?: string | null
  /** BCP-47 voice language ("es-ES", "es-MX"). */
  language: string
  /** "male" | "female" | "unspecified" when the platform exposes it. */
  gender?: "male" | "female" | "unspecified"
}

export type HostApi = {
  /** Text-to-speech in the given UI/BCP-47 language code. */
  speak: (uiCode: string, text: string) => Promise<void>
  stopSpeech?: () => Promise<void>
  /**
   * HOST GAP (CHANGE 2) — OPTIONAL voice-pinned speak. When the host provides it,
   * the NPC dialogue speaks each NPC's STICKY voice (`voiceId`) so every NPC keeps
   * one voice. Until the host implements it, `npcVoice` selects deterministically
   * but cannot pin the TTS voice and `speak()` (language-only) is used. Additive:
   * absence changes nothing for existing callers.
   */
  speakVoice?: (uiCode: string, text: string, voiceId: string) => Promise<void>
  /**
   * HOST GAP (CHANGE 2) — OPTIONAL voice enumeration. When present, `npcVoice`
   * hashes the NPC id into an index over the voices for the target language
   * (male/female split preferred). When absent, we cannot enumerate → the choice
   * is still deterministic but unenforceable at the TTS layer (best effort).
   */
  listVoices?: (uiCode?: string) => Promise<HostVoiceInfo[]>
  /** On-device LLM runtime; present only when tauri-plugin-corpan-llm is registered. */
  llm?: LlmApi
  /** Provider-agnostic dictation (host.asr). Present only when an asr-* provider
   *  plugin is registered. The minimal shape `wireDictation` needs: a `pick`
   *  that resolves a provider (or null = keyboard floor) for a language. Kept
   *  structurally compatible with `@shared/asr`'s AsrApi. */
  asr?: HostAsrApi
  /** True for the standalone mock host (skips the 2.4 GB model). */
  isMock?: boolean
}

/** Minimal local mirror of `@shared/asr`'s AsrApi/AsrProvider/AsrSession — just
 *  enough for dictation wiring. Re-declared here (not imported) so the pack
 *  stays self-contained, same posture as LlmApi above. */
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
