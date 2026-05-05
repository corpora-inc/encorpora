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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionArgs {
    pub session_id: String,
    pub language: String,
    pub expected_text: String,
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
}
