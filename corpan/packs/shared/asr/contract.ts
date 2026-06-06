// The shared AsrProvider contract — TypeScript mirror.
//
// This is the host/pack-facing twin of the Rust `corpan-asr-contract`
// crate. The two MUST stay in lockstep: the Rust structs are the wire
// gatekeeper (serde drops undeclared fields both ways), and these types
// are what packs and the host read. When you change one, change the other.
// Authoritative design: corpan/docs/STT_MASTERPLAN.md §2.
//
// Scope: PURE transcription (dictation). Parlometron's alignment/scoring
// (the 18-field rich result with per-token logprobs) is a SEPARATE
// contract that lives with `tauri-plugin-stt` — deliberately not here.

/** Stable engine ids. Persisted (a pack may remember a per-field pick) and
 *  read by the router, so treat as a frozen string union. */
export type AsrProviderId = "native" | "whisper" | "qwen3" | "sherpa"

/** How fast the engine surfaces text — drives the router's `goal` match. */
export type AsrLatencyClass =
  /** <300 ms partials — live-typing feel (native streaming, NAR transducers). */
  | "instant"
  /** <1.5 s to final — phrase dictation. */
  | "fast"
  /** multi-second — big autoregressive Whisper on Android CPU. */
  | "batch"

/**
 * What an engine claims it can transcribe and what it costs to run. The
 * router (`host.asr.pick`) and the registry Budget Arbiter
 * (`host.models.whatFitsAlongside`) read this to choose a provider and to
 * reason about whether it fits next to the resident 4B LLM.
 *
 * `modelSizeMB` / `residentMemoryMB` keep the uppercase-MB key exactly —
 * the Rust side pins it with `#[serde(rename)]` because serde's camelCase
 * converter would otherwise emit `…Mb` (the bug that bit `tauri-plugin-stt`
 * twice). Do not "fix" the casing here.
 */
export type AsrCapability = {
  providerId: AsrProviderId
  /** Our language codes (`en`, `zh-Hans`, `yue-Hant-HK`, `pa-Arab`, …) —
   *  NOT OS locale ids. The provider maps internally. */
  languages: string[]
  onDevice: boolean
  /** On-disk model size, MB. `0` for native (OS-managed asset). */
  modelSizeMB: number
  /** Peak RAM the runtime ADDS while transcribing. `0` for native
   *  (out-of-process). The number the Budget Arbiter checks. */
  residentMemoryMB: number
  /** Emits true partials, not just a final transcript. */
  streaming: boolean
  latencyClass: AsrLatencyClass
  /** The asset for the requested language isn't on device yet
   *  (language-specific: native may have `en` but need `th`). */
  needsDownload: boolean
  /** `false` = non-autoregressive (Parakeet TDT / SenseVoice) — cheap on
   *  Android CPU, so the router weights it up there. */
  autoregressive: boolean
}

/** How a session decides it's done capturing. */
export type AsrCaptureMode = "push_to_talk" | "auto_stop"

/** Final dictation result — no scoring fields (that's the scorer's contract). */
export type AsrTranscript = {
  text: string
  /** 0..1 engine confidence. Best-effort: native may return a calibrated
   *  proxy, NOT a real posterior — never treat as ground truth. */
  confidence: number
  /** Language actually used (our code); may differ from requested if the
   *  provider auto-detected (SenseVoice / Parakeet can). */
  language: string
}

/**
 * A live transcription session. The host mints the session, wires the
 * plugin's partial/level/error events to these callbacks, and resolves
 * `stop()` with the final transcript.
 */
export type AsrSession = {
  /** Streaming partials as the engine decodes (no-op if `!streaming`). */
  onPartial(cb: (text: string) => void): void
  /** Mic level for the VU meter: `rms` 0..1, `tMs` since session start. */
  onLevel(cb: (rms: number, tMs: number) => void): void
  /** Mid-session error. `code` `INTERRUPTED` = clean call/Control-Center
   *  cancel (never a crash); also `NO_SPEECH` | `MIC_DENIED` | `ENGINE`. */
  onError(cb: (code: string, message?: string) => void): void
  /** Finalize capture and resolve the transcript. */
  stop(): Promise<AsrTranscript>
  /** Abandon without a result (user dismissed, switched fields). */
  cancel(): void
}

/**
 * The provider interface every engine adapter implements. `host.asr` hands
 * packs one of these. It's deliberately tiny: capability introspection,
 * a per-language availability probe, an idempotent `ensure` (OS asset or
 * streamed model download), and `transcribe` to open a session.
 */
export type AsrProvider = {
  readonly id: AsrProviderId
  /** For the router + registry. Cheap; safe to call often. */
  capabilities(): Promise<AsrCapability>
  /** Can this provider do `lang` right now? `needsDownload` distinguishes
   *  "downloadable, not here" from "can't do this language at all". */
  isAvailable(lang: string): Promise<{ ok: boolean; needsDownload: boolean }>
  /** Ensure the asset/OS-model for `lang` is present. Idempotent; streams
   *  to disk (never buffers in RAM). `downloading` → watch progress. */
  ensure(lang: string): Promise<{ ready: boolean; downloading: boolean }>
  /** Open a capture session. Keyboard is the universal floor — callers
   *  must handle a rejected/`null` session by falling back to typing. */
  transcribe(opts: { lang: string; mode: AsrCaptureMode }): Promise<AsrSession>
}

/** Canonical plugin command names, mirrored from the Rust `commands` module.
 *  Full invoke string: `plugin:asr-<provider>|<command>`. */
export const ASR_COMMANDS = {
  capabilities: "capabilities",
  isAvailable: "is_available",
  ensure: "ensure",
  startSession: "start_session",
  stopSession: "stop_session",
  cancelSession: "cancel_session",
} as const
