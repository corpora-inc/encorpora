use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareArgs {
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PrepareResult {
    pub ready: bool,
    pub model: String,
    pub message: Option<String>,
    /// Structured error code when `ready == false`. Populated by the
    /// iOS plugin (`MODEL_NOT_INSTALLED`, `NETWORK`, `LOAD_FAILED`,
    /// etc.). Critical: every field returned by the iOS plugin that
    /// JS needs to read MUST be declared on this Rust struct, because
    /// `run_mobile_plugin::<PrepareResult>` deserializes the iOS JSON
    /// against this shape and SILENTLY DROPS unknown fields. If you
    /// add a new field to the Swift `PreparePayload`, also add it here
    /// or the JS side will never see it.
    #[serde(default)]
    pub code: Option<String>,
}

/// Per-call overrides on top of `whisper_full_default_params` (iOS) /
/// the equivalent JNI defaults (Android). Every field is optional;
/// missing fields fall through to the library default. Field names
/// match whisper.h's `whisper_full_params` exactly (snake_case) so
/// the same JSON shape works on every layer of the stack.
///
/// Critical: this struct is the wire-format gatekeeper. Any field not
/// declared here is silently dropped before reaching the native
/// plugin — see the note on `PrepareResult` above for the symmetric
/// problem on the response side.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WhisperParams {
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub temperature_inc: Option<f32>,
    #[serde(default)]
    pub entropy_thold: Option<f32>,
    #[serde(default)]
    pub logprob_thold: Option<f32>,
    #[serde(default)]
    pub no_speech_thold: Option<f32>,
    #[serde(default)]
    pub suppress_blank: Option<bool>,
    #[serde(default)]
    pub suppress_nst: Option<bool>,
    #[serde(default)]
    pub n_threads: Option<i32>,
    /// Initial text-context primer for the decoder. Whisper prepends
    /// this (up to ~224 tokens) before generating, biasing toward
    /// the prompt's script, vocabulary, and style. Most useful for
    /// low-resource non-Latin-script languages where the model's
    /// greedy decode otherwise collapses to a wrong-script attractor.
    /// Empty string = no priming (library default).
    #[serde(default)]
    pub initial_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionArgs {
    pub session_id: String,
    pub language: String,
    pub expected_text: String,
    /// Per-call whisper.cpp param overrides from the pack. Optional;
    /// when absent the native plugin uses its own defaults. See
    /// `WhisperParams` for the full field list and semantics.
    #[serde(default)]
    pub whisper_params: Option<WhisperParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResult {
    pub started: bool,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopSessionArgs {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelSessionArgs {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub word: String,
    pub start_ms: i32,
    pub end_ms: i32,
    pub probability: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub session_id: String,
    pub text: String,
    pub expected_text: String,
    /// Full code the pack passed in (e.g. "pa-Arab", "zh-Hans").
    pub language: String,
    /// Two-letter code actually sent to Whisper (e.g. "pa", "zh").
    /// Useful for surfacing script-mismatch issues in the UI.
    pub whisper_language: String,
    pub duration_ms: i32,
    pub overall_score: f32,
    pub transcript_score: f32,
    pub likelihood_score: f32,
    /// Acoustic confidence (per-word posterior, language-aware ramp,
    /// penalties for high token-logprob spread / decoder fallback /
    /// free-vs-constrained divergence). 0..1.
    pub acoustic_score: f32,
    pub avg_logprob: f32,
    /// Whisper's own posterior that the segment is non-speech (max
    /// across segments). > 0.5 → "Couldn't hear you" gate fires.
    pub no_speech_prob: f32,
    /// Whisper's repetition / gibberish detector (max across segments).
    /// > 2.4 caps overall ≤ 0.4.
    pub compression_ratio: f32,
    /// Sampling temperature (max across segments). > 0 → decoder fell
    /// back from greedy; small acoustic penalty applied.
    pub temperature: f32,
    /// Min chosen-token logprob across all segments. Catches one bad
    /// token in an otherwise-confident utterance.
    pub min_token_logprob: f32,
    /// Stdev of chosen-token logprobs. High = honest pronunciation
    /// problem (some tokens confident, others not).
    pub token_logprob_stdev: f32,
    /// Levenshtein similarity between free-decode and constrained
    /// transcripts. 1.0 if dual-decode wasn't run.
    pub free_vs_constrained_similarity: f32,
    /// What Whisper heard with no prompt/prefix bias (diagnostic).
    pub free_text: String,
    pub words: Vec<WordTiming>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StatusResult {
    pub available: bool,
    pub prepared: bool,
    pub model: Option<String>,
    pub recording: bool,
    pub message: Option<String>,
    /// Bytes still allocatable to this process before iOS jetsam fires
    /// (from `os_proc_available_memory()`), reported in MB. On
    /// Android: `ActivityManager.MemoryInfo.availMem` (system-wide
    /// free RAM). None when the native side can't measure it.
    /// Critical for the pack's memory-headroom gate when switching
    /// between large whisper models.
    ///
    /// **Wire-format gotcha**: the struct uses
    /// `#[serde(rename_all = "camelCase")]`, but serde's
    /// snake-to-camel converter would turn `available_memory_mb`
    /// into `availableMemoryMb` (lowercase 'b' — "_mb" is one word
    /// to serde, becomes "Mb"). The iOS and Android plugins both
    /// emit `availableMemoryMB` (uppercase 'MB'), and TypeScript
    /// reads `availableMemoryMB`. Without explicit renames here,
    /// serde silently drops the native fields on deserialize, then
    /// re-emits as `availableMemoryMb` on serialize, and JS sees
    /// undefined. This is the SAME wire-format trap that
    /// `PrepareResult`'s docstring warns about — bit us twice in
    /// the same week.
    #[serde(default, rename = "availableMemoryMB")]
    pub available_memory_mb: Option<i64>,
    /// Total physical RAM on the device, MB. Stable across calls.
    /// Used by the pack to gate large-model variants on devices
    /// where the per-process available reading is misleading
    /// (Android in particular). Same explicit-rename gotcha as
    /// `available_memory_mb`.
    #[serde(default, rename = "physicalMemoryMB")]
    pub physical_memory_mb: Option<i64>,
}
