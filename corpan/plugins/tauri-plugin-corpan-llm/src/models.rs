//! Serde models for the public IPC surface of the plugin.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    /// Whether a model is currently in memory.
    pub loaded: bool,
    /// Pack id of the loaded model (e.g. `"llm-base-qwen3-4b-v1"`), if any.
    pub model_id: Option<String>,
    /// Backend in use: `"metal"`, `"vulkan"`, `"cpu"`, or `null` when unloaded.
    pub backend: Option<String>,
    /// Available device memory in MB at last probe.
    pub available_memory_mb: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadArgs {
    /// Pack id whose GGUF should be loaded.
    pub model_pack_id: String,
    /// Optional: number of layers to offload to GPU. `None` = auto.
    pub gpu_layers: Option<i32>,
    /// Optional: context size override. Default 4096.
    pub context_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatOptions {
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub repeat_penalty: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// Stop sequences to terminate generation early.
    #[serde(default)]
    pub stop: Vec<String>,
}

impl Default for ChatOptions {
    fn default() -> Self {
        Self {
            temperature: Some(0.55),
            top_p: Some(0.9),
            repeat_penalty: Some(1.2),
            max_tokens: Some(1500),
            stop: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatArgs {
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub options: ChatOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StopArgs {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryPackDbArgs {
    pub pack_id: String,
    pub db_name: String,
    pub sql: String,
    #[serde(default)]
    pub params: Vec<serde_json::Value>,
    #[serde(default)]
    pub max_rows: Option<u32>,
}

/// Emitted as `llm-token:{sessionId}` while a generation streams.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEvent {
    pub session_id: String,
    pub token: String,
}

/// Emitted as `llm-done:{sessionId}` when generation completes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoneEvent {
    pub session_id: String,
    pub total_tokens: u32,
    pub elapsed_ms: u64,
}

/// Emitted as `llm-error:{sessionId}` on failure.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
    pub session_id: String,
    pub code: String,
    pub error: String,
}
