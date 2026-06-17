use serde::{Deserialize, Serialize};

/// Cross-platform metadata for an installed TTS voice.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceInfo {
    /// Stable, platform-native identifier.
    /// - iOS/macOS: AVSpeechSynthesisVoice.identifier
    /// - Android:   Voice.getName() or a synthesized stable key
    pub id: String,

    /// Human-friendly display name when available.
    pub name: Option<String>,

    /// BCP-47 language tag (e.g., "en-US", "pt-BR").
    pub language: String,

    /// Optional engine / vendor label (e.g., "com.google.android.tts", "Apple TTS").
    pub engine: Option<String>,

    /// Optional gender signal if the platform exposes it.
    /// One of: "male" | "female" | "unspecified"
    pub gender: Option<String>,

    /// Cross-platform quality bucket:
    /// "enhanced" (iOS Enhanced/Premium) |
    /// "very_high" | "high" | "normal" | "default" | "low" | "very_low"
    pub quality: Option<String>,

    /// Optional signal for voices that require network access (Android only).
    pub network_required: Option<bool>,
}

/// Minimal engine inventory/status (Android; others return supported=false).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsEngineInfo {
    pub package_name: String,
    pub label: Option<String>,
    pub is_system: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsEngineStatus {
    pub supported: bool,
    pub default_engine: Option<String>,
    pub engines: Vec<TtsEngineInfo>,
    pub google_installed: bool,
    pub google_default: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakArgs {
    pub text: String,
    pub language: Option<String>,
    pub rate: Option<f32>,
    // Accept either "voice_id" (from callers) or "voiceId" (canonical),
    // and serialize *as* "voiceId" when forwarding to iOS.
    #[serde(rename = "voiceId", alias = "voice_id")]
    pub voice_id: Option<String>,
}

/// Arguments for concurrent TTS speak (same as SpeakArgs but separate type for clarity).
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakConcurrentArgs {
    pub text: String,
    pub language: Option<String>,
    pub rate: Option<f32>,
    #[serde(rename = "voiceId", alias = "voice_id")]
    pub voice_id: Option<String>,
}

/// Result from speak_concurrent containing the utterance ID for tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakResult {
    /// Unique identifier for this utterance, used to track completion events.
    pub utterance_id: String,
}

/// Engine entry inside a TtsHealthProbe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeEngineInfo {
    pub package_name: String,
    pub label: Option<String>,
    /// "enabled" | "disabled_user" | "disabled" | "default" | "disabled_until_used" | "not_installed"
    pub enabled_state: String,
    pub manifest_enabled: bool,
    pub is_installed: bool,
    /// Has TTS_SERVICE intent that 3rd-party apps can bind to (Samsung's SMT is "private" → false).
    #[serde(default)]
    pub is_bindable: bool,
    pub is_usable: bool,
}

/// Comprehensive engine + voice + state probe used for the onboarding rescue UX.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsHealthProbe {
    pub supported: bool,
    /// "ready" | "pending" | "failed"
    pub init_state: String,
    pub current_engine: Option<String>,
    pub voice_count: u32,
    pub voices_empty: bool,
    pub default_engine: Option<String>,
    pub engines: Vec<ProbeEngineInfo>,
    pub google_installed: bool,
    pub google_enabled: bool,
    pub google_default: bool,
    /// "ready" | "engine_disabled_user" | "engine_disabled" | "engine_not_installed"
    /// | "no_voice_data" | "no_engine" | "engine_hung"
    pub diagnosis: String,
    /// Convenience boolean: equivalent to (initState == "ready" && !voicesEmpty).
    pub ready: bool,
}

/// Result of a recovery attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoverResult {
    pub recovered: bool,
    pub engine: Option<String>,
    pub diagnosis: Option<String>,
    pub voice_count: Option<u32>,
    pub already_healthy: Option<bool>,
}

/// Result of an explicit engine bind attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindEngineResult {
    pub ok: bool,
    /// "not_installed" | "disabled_user" | "disabled" | "bind_timeout" | unset on success
    pub reason: Option<String>,
    pub engine: Option<String>,
    pub voice_count: Option<u32>,
}

/// Result of a per-language voice data installation request.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallVoiceDataResult {
    /// "already_installed" | "launched_install_flow" | "not_supported" | "engine_not_ready"
    pub status: String,
}

/// Arguments for `synthesize_to_buffer` — render TTS to RAW AUDIO without playing
/// it through the speaker (so it never ducks the music). Mirrors `SpeakArgs`.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesizeArgs {
    pub text: String,
    pub language: Option<String>,
    pub rate: Option<f32>,
    // Accept either "voice_id" (from callers) or "voiceId" (canonical),
    // and serialize *as* "voiceId" when forwarding to the native plugin.
    #[serde(rename = "voiceId", alias = "voice_id")]
    pub voice_id: Option<String>,
}

/// Result of `synthesize_to_buffer`: base64-encoded raw audio + decode metadata.
///
/// The PCM bytes ride the IPC as base64 (pragmatic transport — the pack caches
/// the decoded bytes in IndexedDB). `codec` disambiguates the byte layout:
///   - "wav"     ⇒ a complete 16-bit PCM WAV container (header + samples)
///   - "pcm-i16" ⇒ raw little-endian signed 16-bit samples (use sample_rate/channels)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SynthesizeResult {
    /// Base64-encoded audio bytes (a WAV container or raw PCM, per `codec`).
    pub pcm_base64: String,
    pub sample_rate: u32,
    pub channels: u8,
    pub duration_ms: u32,
    /// "wav" | "pcm-i16"
    pub codec: String,
    /// The voice that actually rendered the audio (resolved native identifier).
    pub voice_id: String,
}
