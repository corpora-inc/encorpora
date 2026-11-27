//! The model interface. The engine asks a model only for small, schema-bound
//! jobs (expand, select, compose, grade, structure) and checks every answer.
//!
//! The app bridges [`Llm`] to its local llama.cpp runtime (turning the JSON
//! schema into a grammar); the CLI uses [`OpenAiCompatible`] against any
//! OpenAI-compatible server (`--llm http://host:port/v1`).

use crate::error::{Error, Result};
use serde::de::DeserializeOwned;
use serde_json::Value;
#[cfg(feature = "cli")]
use std::path::Path;

/// One constrained completion.
#[derive(Debug, Clone)]
pub struct LlmRequest {
    pub system: String,
    pub user: String,
    /// `(name, JSON schema)` the output must satisfy. The backend must
    /// constrain decoding to it (grammar / `response_format`).
    pub schema: (String, Value),
    pub max_tokens: u32,
    pub temperature: f32,
}

/// A text model.
pub trait Llm: Send + Sync {
    /// The exact model id, recorded in the audit log.
    fn id(&self) -> String;
    /// Return the raw completion text (JSON matching `req.schema`).
    fn complete(&self, req: &LlmRequest) -> Result<String>;
}

/// Complete and parse; strips a ```json fence some servers add.
pub fn complete_json<T: DeserializeOwned>(llm: &dyn Llm, req: &LlmRequest) -> Result<T> {
    let raw = llm.complete(req)?;
    let t = raw.trim();
    let t = t
        .strip_prefix("```json")
        .or_else(|| t.strip_prefix("```"))
        .map(|s| s.trim_end_matches("```").trim())
        .unwrap_or(t);
    serde_json::from_str(t).map_err(|e| Error::Llm(format!("output does not match schema: {e}")))
}

/// An OpenAI-compatible chat-completions client (llama.cpp server, vLLM,
/// and similar). Plain HTTP for a local or lab server.
#[cfg(feature = "cli")]
pub struct OpenAiCompatible {
    base: String,
    model: String,
    agent: ureq::Agent,
}

#[cfg(feature = "cli")]
impl OpenAiCompatible {
    /// `base` is the `/v1` root. With no `model`, the server's first listed
    /// model is used.
    pub fn new(base: &str, model: Option<&str>, timeout: std::time::Duration) -> Result<Self> {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(timeout))
            .build()
            .into();
        let base = base.trim_end_matches('/').to_string();
        let model = match model {
            Some(m) => m.to_string(),
            None => {
                let v: Value = agent
                    .get(&format!("{base}/models"))
                    .call()
                    .map_err(|e| Error::Llm(format!("{base}/models: {e}")))?
                    .body_mut()
                    .read_json()
                    .map_err(|e| Error::Llm(format!("{base}/models: {e}")))?;
                v["data"][0]["id"]
                    .as_str()
                    .ok_or_else(|| Error::Llm("server lists no model".into()))?
                    .to_string()
            }
        };
        Ok(Self { base, model, agent })
    }
}

#[cfg(feature = "cli")]
impl Llm for OpenAiCompatible {
    fn id(&self) -> String {
        self.model.clone()
    }

    fn complete(&self, req: &LlmRequest) -> Result<String> {
        let body = serde_json::json!({
            "model": self.model,
            "messages": [
                {"role": "system", "content": req.system},
                {"role": "user", "content": req.user},
            ],
            "temperature": req.temperature,
            "max_tokens": req.max_tokens,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": req.schema.0, "schema": req.schema.1, "strict": true},
            },
            // Reasoning models (Granite 4.2, Qwen-style templates) otherwise
            // spend the whole budget thinking and return empty content.
            // llama.cpp and vLLM read this; other servers ignore it.
            "chat_template_kwargs": {"enable_thinking": false},
        });
        let v: Value = self
            .agent
            .post(&format!("{}/chat/completions", self.base))
            .send_json(&body)
            .map_err(|e| Error::Llm(format!("chat/completions: {e}")))?
            .body_mut()
            .read_json()
            .map_err(|e| Error::Llm(format!("chat/completions: {e}")))?;
        if let Some(path) = std::env::var_os("HARVEST_LLM_LOG") {
            log_exchange(Path::new(&path), &body, &v);
        }
        let choice = &v["choices"][0];
        match choice["message"]["content"].as_str() {
            Some(c) if !c.trim().is_empty() => Ok(c.to_string()),
            _ => Err(Error::Llm(format!(
                "empty content (finish_reason {}{})",
                choice["finish_reason"].as_str().unwrap_or("none"),
                if choice["message"]["reasoning_content"].is_string() {
                    "; the model reasoned instead of answering"
                } else {
                    ""
                }
            ))),
        }
    }
}

/// Append one request/response pair as a JSON line (`HARVEST_LLM_LOG`), for
/// reviewing what a model actually wrote. A failed write is reported, never
/// fatal.
#[cfg(feature = "cli")]
fn log_exchange(path: &Path, request: &Value, response: &Value) {
    use std::io::Write;
    let line = serde_json::json!({"request": request, "response": response}).to_string();
    let res = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .and_then(|mut f| writeln!(f, "{line}"));
    if let Err(e) = res {
        eprintln!("harvest: HARVEST_LLM_LOG {}: {e}", path.display());
    }
}

/// A scripted model for tests: returns queued outputs in order and records
/// every request.
#[derive(Default)]
pub struct ScriptedLlm {
    pub outputs: std::sync::Mutex<std::collections::VecDeque<String>>,
    pub requests: std::sync::Mutex<Vec<LlmRequest>>,
}

impl ScriptedLlm {
    pub fn new(outputs: impl IntoIterator<Item = String>) -> Self {
        Self {
            outputs: std::sync::Mutex::new(outputs.into_iter().collect()),
            requests: Default::default(),
        }
    }
    /// The schema names requested so far.
    pub fn asked(&self) -> Vec<String> {
        self.requests
            .lock()
            .unwrap()
            .iter()
            .map(|r| r.schema.0.clone())
            .collect()
    }
}

impl Llm for ScriptedLlm {
    fn id(&self) -> String {
        "scripted-test-model".into()
    }
    fn complete(&self, req: &LlmRequest) -> Result<String> {
        self.requests.lock().unwrap().push(req.clone());
        self.outputs
            .lock()
            .unwrap()
            .pop_front()
            .ok_or_else(|| Error::Llm("script exhausted".into()))
    }
}
