//! The model interface. The engine asks a model only for small, schema-bound
//! jobs (expand, select, compose, grade, structure) and checks every answer.
//!
//! The app bridges [`Llm`] to its local llama.cpp runtime (turning the JSON
//! schema into a grammar); the CLI uses [`OpenAiCompatible`] against any
//! OpenAI-compatible server (`--llm http://host:port/v1`).

use crate::error::{Error, Result};
use serde::de::DeserializeOwned;
use serde_json::Value;
#[cfg(feature = "net")]
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

/// Complete and parse. Reasoning models may wrap or precede the JSON with
/// their thinking (`<think>…</think>`, a harmony analysis channel, plain
/// prose) or spend the whole budget on it; the answer is the last JSON object
/// that fits the schema's type. When nothing parses, it asks once more with
/// four times the budget and an instruction to answer with the JSON only.
pub fn complete_json<T: DeserializeOwned>(llm: &dyn Llm, req: &LlmRequest) -> Result<T> {
    let first = llm
        .complete(req)
        .and_then(|raw| parse_json_for::<T>(&raw, &req.schema.1));
    match first {
        Ok(v) => Ok(v),
        Err(e) if is_output_failure(&e) => {
            let mut again = req.clone();
            again.max_tokens = req.max_tokens.saturating_mul(4).max(1024);
            again
                .system
                .push_str(" Do not think aloud or explain: reply with the JSON object only.");
            llm.complete(&again)
                .and_then(|raw| parse_json_for::<T>(&raw, &again.schema.1))
                .map_err(|e2| {
                    Error::Llm(format!(
                        "{}; retried with {} tokens: {}",
                        llm_message(&e),
                        again.max_tokens,
                        llm_message(&e2)
                    ))
                })
        }
        Err(e) => Err(e),
    }
}

/// An error's message without its `llm:` prefix, for nesting.
fn llm_message(e: &Error) -> String {
    match e {
        Error::Llm(m) => m.clone(),
        other => other.to_string(),
    }
}

/// The model answered, but not with usable JSON (as opposed to a transport
/// error, which a retry would not fix).
fn is_output_failure(e: &Error) -> bool {
    matches!(e, Error::Llm(m) if m.starts_with(OUTPUT_PREFIX) || m.starts_with(EMPTY_PREFIX))
}

const OUTPUT_PREFIX: &str = "output does not match schema";
const EMPTY_PREFIX: &str = "empty content";

/// The JSON answer in a model's raw text, for a schema with no required
/// keys (see [`parse_json_for`]).
pub fn parse_json<T: DeserializeOwned>(raw: &str) -> Result<T> {
    parse_json_for(raw, &Value::Null)
}

/// The JSON answer in a model's raw text: the whole text, or else the last
/// object in it, that has every top-level key `schema` requires and
/// deserializes as `T` (serde alone ignores `required`, so a stray `{}` in
/// prose would otherwise pass as an all-default answer).
pub fn parse_json_for<T: DeserializeOwned>(raw: &str, schema: &Value) -> Result<T> {
    let t = strip_reasoning(raw)?;
    let t = t.trim();
    let t = t
        .strip_prefix("```json")
        .or_else(|| t.strip_prefix("```"))
        .map(|s| s.trim_end_matches("```").trim())
        .unwrap_or(t);
    if t.is_empty() {
        return Err(Error::Llm(format!("{EMPTY_PREFIX} (only reasoning)")));
    }
    let required: Vec<&str> = schema["required"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    let accept = |v: Value| -> Option<T> {
        let obj = v.as_object()?;
        if required.iter().any(|k| !obj.contains_key(*k)) {
            return None;
        }
        serde_json::from_value(v).ok()
    };
    let direct = serde_json::from_str::<Value>(t);
    let direct_err = match direct {
        Ok(v) => match accept(v) {
            Some(out) => return Ok(out),
            None => "missing required keys or wrong types".to_string(),
        },
        Err(e) => e.to_string(),
    };
    // The last object in the text that qualifies (an answer after prose).
    let mut found = None;
    for (i, _) in t.match_indices('{') {
        let mut stream = serde_json::Deserializer::from_str(&t[i..]).into_iter::<Value>();
        if let Some(Ok(v)) = stream.next()
            && let Some(out) = accept(v)
        {
            found = Some(out);
        }
    }
    found.ok_or_else(|| Error::Llm(format!("{OUTPUT_PREFIX}: {direct_err}")))
}

/// Drop reasoning a model put in its content: `<think>` blocks (closed,
/// unclosed, or only the closing tag when the template opened it), and a
/// harmony analysis channel. Harmony output with no final channel is all
/// reasoning: an error, so the caller retries instead of reading a draft.
fn strip_reasoning(raw: &str) -> Result<String> {
    let mut s = raw.to_string();
    const FINAL: &str = "<|channel|>final<|message|>";
    if let Some(i) = s.find(FINAL) {
        s = s[i + FINAL.len()..].to_string();
        for end in ["<|return|>", "<|end|>"] {
            if let Some(j) = s.find(end) {
                s.truncate(j);
            }
        }
    } else if s.contains("<|channel|>") {
        return Err(Error::Llm(format!(
            "{EMPTY_PREFIX} (reasoning channel, no final answer)"
        )));
    }
    // A closing tag without its opening one: the template opened the block.
    if let Some(j) = s.rfind("</think>")
        && !s[..j].contains("<think>")
    {
        s = s[j + "</think>".len()..].to_string();
    }
    // <think>…</think>; an unclosed one runs to the end.
    while let Some(i) = s.find("<think>") {
        match s[i..].find("</think>") {
            Some(j) => s.replace_range(i..i + j + "</think>".len(), ""),
            None => s.truncate(i),
        }
    }
    Ok(s)
}

/// An OpenAI-compatible chat-completions client (llama.cpp server, vLLM,
/// and similar). Plain HTTP for a local or lab server.
#[cfg(feature = "net")]
pub struct OpenAiCompatible {
    base: String,
    model: String,
    agent: ureq::Agent,
}

#[cfg(feature = "net")]
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

#[cfg(feature = "net")]
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
            // Reasoning models otherwise spend the whole budget thinking and
            // return empty content. The template switch is not enough with a
            // JSON schema (Gemma 4, gpt-oss on llama.cpp open the reasoning
            // channel anyway); a zero reasoning budget closes it, per
            // request, like `llama-server --reasoning-budget 0`. llama.cpp
            // reads both; vLLM reads the template switch.
            "chat_template_kwargs": {"enable_thinking": false},
            "reasoning_budget_tokens": 0,
        });
        let url = format!("{}/chat/completions", self.base);
        let send = |body: &Value| -> std::result::Result<Value, ureq::Error> {
            self.agent
                .post(&url)
                .send_json(body)?
                .body_mut()
                .read_json()
        };
        let mut body = body;
        let v: Value = match send(&body) {
            Ok(v) => v,
            // A server that rejects the reasoning fields gets the plain request.
            Err(ureq::Error::StatusCode(400 | 422)) => {
                let obj = body.as_object_mut().expect("object");
                obj.remove("chat_template_kwargs");
                obj.remove("reasoning_budget_tokens");
                send(&body).map_err(|e| {
                    Error::Llm(format!(
                        "chat/completions (also retried without the reasoning fields): {e}"
                    ))
                })?
            }
            Err(e) => return Err(Error::Llm(format!("chat/completions: {e}"))),
        };
        if let Some(path) = std::env::var_os("HARVEST_LLM_LOG") {
            log_exchange(Path::new(&path), &body, &v);
        }
        let choice = &v["choices"][0];
        match choice["message"]["content"].as_str() {
            Some(c) if !c.trim().is_empty() => Ok(c.to_string()),
            _ => Err(Error::Llm(format!(
                "{EMPTY_PREFIX} (finish_reason {}{})",
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
#[cfg(feature = "net")]
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
