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
