//! Settings an operator places in `config.json` in the app's data folder.
//! Everything is optional: with none, the app is lexical-only and offline.
//!
//! ```json
//! { "hub": "https://hub.example", "hub_ca": "/path/hub-ca.pem",
//!   "embedder": { "model": "/path/embeddinggemma-2-Q8_0.gguf", "server": "/opt/homebrew/bin/llama-server" },
//!   "llm_url": "http://127.0.0.1:8080/v1", "llm_model": "<name>",
//!   "prefill_policy": { "fields": ["minutes", "parts"] } }
//! ```

use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    /// The hub's address (https; plain http only to this machine). Without it
    /// the app never opens a network connection.
    #[serde(default)]
    pub hub: Option<String>,
    /// A PEM file with the hub's CA: the only roots trusted for the hub (a pin).
    /// Without it, the platform's trust store.
    #[serde(default)]
    pub hub_ca: Option<PathBuf>,
    /// Search by meaning through a managed local embedding server.
    #[serde(default)]
    pub embedder: Option<EmbedderConfig>,
    /// The model the engine may ask (an OpenAI-compatible `…/v1` with JSON-schema output) for
    /// suggesting an entry, prefilling a lesson and choosing the manual's sentences for a question.
    /// Without it every screen works with the model off.
    #[serde(default)]
    pub llm_url: Option<String>,
    /// Its model name (the first the server lists when absent).
    #[serde(default)]
    pub llm_model: Option<String>,
    /// The lesson fields the model may prefill on this device (the engine's default: minutes, parts).
    #[serde(default)]
    pub prefill_policy: Option<harvest_core::assist::PrefillPolicy>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EmbedderConfig {
    /// The GGUF embedding model file.
    pub model: PathBuf,
    /// The `llama-server` binary that serves it.
    pub server: PathBuf,
}

impl Config {
    /// `config.json` in `dir`; no file is the default (offline, lexical).
    pub fn load(dir: &Path) -> Result<Self, String> {
        let path = dir.join("config.json");
        match std::fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display())),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(format!("{}: {e}", path.display())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Config;

    #[test]
    fn reads_the_model_settings() {
        let c: Config = serde_json::from_str(r#"{"llm_url": "http://127.0.0.1:8080/v1", "llm_model": "m", "prefill_policy": {"fields": ["minutes", "parts"]}}"#).unwrap();
        assert_eq!(c.llm_url.as_deref(), Some("http://127.0.0.1:8080/v1"));
        assert_eq!(c.llm_model.as_deref(), Some("m"));
        assert_eq!(c.prefill_policy.unwrap().fields, ["minutes", "parts"]);
        let none: Config = serde_json::from_str("{}").unwrap();
        assert!(none.llm_url.is_none() && none.prefill_policy.is_none());
    }
}
