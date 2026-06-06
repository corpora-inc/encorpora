//! # corpan-asr-contract
//!
//! The shared `AsrProvider` wire contract. Every Corpán speech-to-text
//! runtime — OS-native, whisper.cpp, Qwen3-ASR, sherpa/onnx — is a tauri
//! plugin that speaks THESE structs. Defining them once here is what keeps
//! the four provider plugins interchangeable and what stops them drifting
//! (see `corpan/docs/STT_MASTERPLAN.md` §2).
//!
//! This crate is **pure transcription** (dictation). Parlometron's
//! alignment/scoring stays in `tauri-plugin-stt` and runs *on top of* a
//! transcription provider (§5.2); its rich `TranscriptionResult` with the
//! 18 scoring fields is intentionally NOT here — that's the scorer's
//! contract, not the dictation contract.
//!
//! ## Wire-format discipline (read before adding a field)
//!
//! These structs cross the JS ⇄ Rust ⇄ native (Swift/Kotlin) boundary via
//! `run_mobile_plugin::<T>` / `tauri::command`. serde **silently drops any
//! field not declared on the struct, in BOTH directions**. Two rules that
//! bit `tauri-plugin-stt` twice in one week
//! (`memory/tauri-plugin-wire-format.md`):
//!
//! 1. Every field JS reads MUST be declared here. A field the native side
//!    emits but this struct omits is dropped before JS ever sees it.
//! 2. `#[serde(rename_all = "camelCase")]` mangles `_mb`/`_id` suffixes:
//!    serde turns `available_memory_mb` → `availableMemoryMb` (lowercase
//!    `b`), but the native layers emit `availableMemoryMB`. Any field whose
//!    camelCase isn't what serde computes needs an explicit `#[serde(rename
//!    = "…")]`. We mark every such field below.

use serde::{Deserialize, Serialize};

/// Which engine a capability/result came from. Stable string ids — these
/// are persisted (e.g. a pack remembering "use qwen3 for this field") and
/// read by the router, so do not renumber/rename casually.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    /// Apple SpeechAnalyzer/SFSpeechRecognizer + Android SpeechRecognizer.
    Native,
    /// whisper.cpp / ggml (today's `tauri-plugin-stt` runtime generalized).
    Whisper,
    /// Qwen3-ASR (Apache-2.0): AuT encoder + a Qwen3 LLM decoder; rides the
    /// corpan-llm llama.cpp/GGML runtime co-resident with the 4B LLM (§3.3).
    Qwen3,
    /// One onnxruntime hosting Parakeet-v3 (EU, non-AR) + SenseVoice (CJK).
    Sherpa,
}

/// How fast the engine surfaces text. Drives the router's `goal` match.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LatencyClass {
    /// <300 ms partials — live-typing feel (native streaming, NAR transducers).
    Instant,
    /// <1.5 s to final — phrase dictation.
    Fast,
    /// multi-second — big autoregressive Whisper on Android CPU.
    Batch,
}

/// What the engine claims it can transcribe and what it costs to run. The
/// **router** (`host.asr.pick`) and the **registry Budget Arbiter**
/// (`host.models.whatFitsAlongside`) read this to choose a provider and to
/// reason about whether it fits next to the resident 4B LLM. Every plugin's
/// `capabilities` command returns this shape.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AsrCapability {
    /// `None` only transiently before a plugin has initialized; real
    /// capability replies always carry a `providerId`.
    #[serde(default)]
    pub provider_id: Option<ProviderId>,
    /// Our language codes (`en`, `zh-Hans`, `yue-Hant-HK`, `pa-Arab`, …) —
    /// NOT BCP-47 / OS locale ids. The provider maps internally.
    #[serde(default)]
    pub languages: Vec<String>,
    /// Runs without network (after any asset is present). Always true for
    /// our shipping providers; declared so the router can prefer on-device.
    #[serde(default)]
    pub on_device: bool,
    /// On-disk model size in MB. `0` for native (OS-managed asset).
    #[serde(default, rename = "modelSizeMB")]
    pub model_size_mb: u32,
    /// Peak RAM the runtime ADDS while transcribing. `0` for native
    /// (out-of-process — the OS daemon's memory isn't charged to us). This
    /// is the number the Budget Arbiter checks against live headroom.
    #[serde(default, rename = "residentMemoryMB")]
    pub resident_memory_mb: u32,
    /// Emits true partials (not just a final transcript).
    #[serde(default)]
    pub streaming: bool,
    #[serde(default)]
    pub latency_class: Option<LatencyClass>,
    /// The model/asset for the requested language is not yet on device.
    /// (Language-specific: native may have `en` but need a download for `th`.)
    #[serde(default)]
    pub needs_download: bool,
    /// `false` = non-autoregressive decode (Parakeet TDT / SenseVoice) —
    /// dramatically cheaper on Android CPU, so the router weights it up
    /// there. `true` = autoregressive (Whisper, Qwen3 decoder, native).
    #[serde(default)]
    pub autoregressive: bool,
}

/// Args for a "can this provider do this language right now?" probe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IsAvailableArgs {
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IsAvailableResult {
    pub ok: bool,
    /// `ok` can be false purely because an asset isn't downloaded yet;
    /// `needs_download` distinguishes "downloadable, just not here" from
    /// "this provider can't do this language at all".
    pub needs_download: bool,
}

/// Args for ensuring the asset/OS-model for a language is present (OS asset
/// trigger or a streamed model download). Idempotent: calling when already
/// ready returns `ready: true, downloading: false`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureArgs {
    pub lang: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EnsureResult {
    pub ready: bool,
    /// A download/OS-fetch is in flight; the caller should watch progress
    /// events rather than block. (Streamed to disk — never buffered in RAM,
    /// per `memory/content-pack-download-streaming.md`.)
    pub downloading: bool,
    /// Structured error code when neither ready nor downloading
    /// (`UNSUPPORTED_LANG`, `NETWORK`, `NO_SPACE`, `WONT_FIT`). Same
    /// gatekeeper rule as everything else: declared so JS can read it.
    #[serde(default)]
    pub code: Option<String>,
}

/// How a session decides it's done capturing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureMode {
    /// Hold-to-talk: capture until the caller calls stop.
    PushToTalk,
    /// Capture until the engine/VAD detects end-of-speech.
    AutoStop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeArgs {
    /// Opaque id the host mints so partial/level/error events can be routed
    /// back to the right `AsrSession`.
    pub session_id: String,
    pub lang: String,
    pub mode: CaptureMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TranscribeStartResult {
    pub started: bool,
    pub session_id: String,
}

/// Final result of a transcription session — the PURE-dictation shape. No
/// scoring fields: scoring is Parlometron's separate contract (§5.2). The
/// scorer's whisper-backed `TranscriptionResult` (per-token logprobs,
/// no_speech, compression, etc.) stays in `tauri-plugin-stt`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptOut {
    pub session_id: String,
    pub text: String,
    /// 0..1 engine confidence. Best-effort: native engines may not give a
    /// real posterior, in which case providers return a calibrated proxy
    /// rather than a fake 1.0 — callers must not treat this as ground truth.
    pub confidence: f32,
    /// The language actually used (our code). May differ from the requested
    /// `lang` if the provider auto-detected (SenseVoice/Parakeet can).
    pub language: String,
}

/// A streaming partial, pushed as the engine decodes. Routed to the JS
/// `AsrSession.onPartial` by `session_id`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PartialEvent {
    pub session_id: String,
    pub text: String,
}

/// A mic level sample for the VU meter. Routed to `AsrSession.onLevel`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LevelEvent {
    pub session_id: String,
    /// RMS amplitude 0..1.
    pub rms: f32,
    /// Capture-clock milliseconds since session start.
    #[serde(rename = "tMs")]
    pub t_ms: u32,
}

/// An error pushed mid-session (interruption, engine failure). Routed to
/// `AsrSession`. `code` is the contract; `INTERRUPTED` specifically means a
/// call / Control-Center pull cleanly cancelled us — providers MUST emit
/// this rather than crash (§7).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionErrorEvent {
    pub session_id: String,
    /// `INTERRUPTED` | `NO_SPEECH` | `MIC_DENIED` | `ENGINE` | `CANCELLED`.
    pub code: String,
    #[serde(default)]
    pub message: Option<String>,
}

/// Args carrying just a session id (stop/cancel).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRef {
    pub session_id: String,
}

/// The command surface every provider plugin exposes. This is documentation
/// of the agreed command names + payload shapes — each plugin wires its own
/// `#[tauri::command]`s, but they MUST match these names and use the structs
/// above so the host's `AsrProvider` adapter is provider-agnostic:
///
/// | command            | args                | returns                  |
/// |--------------------|---------------------|--------------------------|
/// | `capabilities`     | —                   | [`AsrCapability`]        |
/// | `is_available`     | [`IsAvailableArgs`] | [`IsAvailableResult`]    |
/// | `ensure`           | [`EnsureArgs`]      | [`EnsureResult`]         |
/// | `start_session`    | [`TranscribeArgs`]  | [`TranscribeStartResult`]|
/// | `stop_session`     | [`SessionRef`]      | [`TranscriptOut`]        |
/// | `cancel_session`   | [`SessionRef`]      | `()`                     |
///
/// Streaming events ([`PartialEvent`], [`LevelEvent`], [`SessionErrorEvent`])
/// are emitted on the plugin's event channel, keyed by `session_id`.
pub mod commands {
    //! Canonical command names, so callers don't hardcode typos. The full
    //! invoke string is `plugin:asr-<provider>|<COMMAND>` (e.g.
    //! `plugin:asr-native|start_session`).
    pub const CAPABILITIES: &str = "capabilities";
    pub const IS_AVAILABLE: &str = "is_available";
    pub const ENSURE: &str = "ensure";
    pub const START_SESSION: &str = "start_session";
    pub const STOP_SESSION: &str = "stop_session";
    pub const CANCEL_SESSION: &str = "cancel_session";
}

#[cfg(test)]
mod tests {
    use super::*;

    // The wire format is the product here — these tests pin the exact JSON
    // keys the native (Swift/Kotlin) and JS layers must agree on. A change
    // that breaks one of these is a breaking change to every provider.

    #[test]
    fn capability_camel_cases_and_keeps_mb_suffix_uppercase() {
        let cap = AsrCapability {
            provider_id: Some(ProviderId::Qwen3),
            languages: vec!["en".into(), "zh-Hans".into()],
            on_device: true,
            model_size_mb: 700,
            resident_memory_mb: 650,
            streaming: true,
            latency_class: Some(LatencyClass::Fast),
            needs_download: true,
            autoregressive: true,
        };
        let v: serde_json::Value = serde_json::to_value(&cap).unwrap();
        assert_eq!(v["providerId"], "qwen3");
        assert_eq!(v["onDevice"], true);
        // The trap: serde would emit `modelSizeMb`/`residentMemoryMb` without
        // the explicit renames. Assert the UPPERCASE-MB keys the native and
        // JS sides actually use.
        assert_eq!(v["modelSizeMB"], 700);
        assert_eq!(v["residentMemoryMB"], 650);
        assert!(v.get("modelSizeMb").is_none());
        assert!(v.get("residentMemoryMb").is_none());
        assert_eq!(v["needsDownload"], true);
        assert_eq!(v["latencyClass"], "fast");
    }

    #[test]
    fn capability_round_trips() {
        let json = r#"{
            "providerId":"native","languages":["ar","th"],"onDevice":true,
            "modelSizeMB":0,"residentMemoryMB":0,"streaming":true,
            "latencyClass":"instant","needsDownload":false,"autoregressive":true
        }"#;
        let cap: AsrCapability = serde_json::from_str(json).unwrap();
        assert_eq!(cap.provider_id, Some(ProviderId::Native));
        assert_eq!(cap.model_size_mb, 0);
        assert_eq!(cap.resident_memory_mb, 0);
        assert_eq!(cap.latency_class, Some(LatencyClass::Instant));
    }

    #[test]
    fn level_event_uses_t_ms_key() {
        let ev = LevelEvent { session_id: "s1".into(), rms: 0.4, t_ms: 120 };
        let v: serde_json::Value = serde_json::to_value(&ev).unwrap();
        assert_eq!(v["tMs"], 120);
        assert_eq!(v["sessionId"], "s1");
    }

    #[test]
    fn capture_mode_is_snake_case_on_the_wire() {
        let v = serde_json::to_value(CaptureMode::PushToTalk).unwrap();
        assert_eq!(v, "push_to_talk");
        let v = serde_json::to_value(CaptureMode::AutoStop).unwrap();
        assert_eq!(v, "auto_stop");
    }
}
