use crate::content_packs;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel, Special};
use llama_cpp_2::sampling::LlamaSampler;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Emitter, Runtime, State};

const EVENT_DELTA: &str = "corpan://local-llm/delta";
const EVENT_DONE: &str = "corpan://local-llm/done";
const EVENT_ERROR: &str = "corpan://local-llm/error";
const EVENT_CANCELLED: &str = "corpan://local-llm/cancelled";

static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Default)]
pub struct LocalLlmState {
    pub inflight: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    backend: Arc<Mutex<Option<Arc<LlamaBackend>>>>,
}

impl LocalLlmState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmGenerateRequest {
    pub pack_id: Option<String>,
    pub model_path: String,
    pub messages: Vec<LocalLlmMessage>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub repeat_penalty: Option<f32>,
    pub context_length: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmStartResponse {
    pub request_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmCancelResponse {
    pub request_id: String,
    pub cancelled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeltaEventPayload {
    request_id: String,
    delta: String,
    accumulated_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DoneEventPayload {
    request_id: String,
    output: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorEventPayload {
    request_id: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct ContentPackManifestLite {
    id: String,
    llm: Option<PackLlmManifest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackLlmManifest {
    runtime: Option<String>,
    default_model: Option<String>,
    models: Option<Vec<PackLlmModelManifest>>,
    defaults: Option<PackLlmDefaults>,
    chat_template: Option<String>,
    chat_template_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackLlmModelManifest {
    id: Option<String>,
    name: Option<String>,
    path: String,
    size_bytes: Option<u64>,
    recommended: Option<bool>,
    quant_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackLlmDefaults {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub repeat_penalty: Option<f32>,
    pub max_tokens: Option<u32>,
    pub context_length: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackLlmModelOut {
    pub id: String,
    pub name: String,
    pub relative_path: String,
    pub absolute_path: Option<String>,
    pub exists: bool,
    pub size_bytes: Option<u64>,
    pub recommended: bool,
    pub quant_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackLlmConfigOut {
    pub runtime: Option<String>,
    pub default_model: Option<String>,
    pub models: Vec<PackLlmModelOut>,
    pub defaults: Option<PackLlmDefaults>,
    pub chat_template_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalLlmRuntimeStatus {
    pub backend: &'static str,
    pub command_path: String,
    pub available: bool,
    pub detail: Option<String>,
}

enum GenerationOutcome {
    Completed(String),
    Cancelled(String),
}

fn next_request_id() -> String {
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let sequence = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("llm-{epoch}-{sequence}")
}

fn now_seed() -> u32 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| (d.as_millis() & 0xffff_ffff) as u32)
        .unwrap_or(0)
}

fn validate_pack_id(pack_id: &str) -> Result<(), String> {
    let id = pack_id.trim();
    if id.is_empty() {
        return Err("packId is empty".to_string());
    }
    if id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err(format!("Invalid packId: {pack_id}"));
    }
    Ok(())
}

fn pack_dir_for<R: Runtime>(app: &AppHandle<R>, pack_id: &str) -> Result<PathBuf, String> {
    validate_pack_id(pack_id)?;
    let root = content_packs::pack_root(app)?;
    let dir = root.join(pack_id);
    let manifest = dir.join("manifest.json");
    if !manifest.exists() {
        return Err(format!("Pack not installed: {pack_id}"));
    }
    Ok(dir)
}

pub fn resolve_pack_asset_path<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if relative_path.trim().is_empty() {
        return Err("Asset path is empty".to_string());
    }
    let rel = Path::new(relative_path);
    if rel.is_absolute() {
        return Err("Pack asset path must be relative".to_string());
    }
    let pack_dir = pack_dir_for(app, pack_id)?;
    let full = pack_dir.join(rel);
    if !full.exists() {
        return Err(format!("Pack asset not found: {}", full.display()));
    }
    let pack_canon = pack_dir.canonicalize().map_err(|e| e.to_string())?;
    let full_canon = full.canonicalize().map_err(|e| e.to_string())?;
    if !full_canon.starts_with(&pack_canon) {
        return Err("Pack asset path escapes pack root".to_string());
    }
    Ok(full_canon)
}

fn resolve_model_path<R: Runtime>(
    app: &AppHandle<R>,
    request: &LocalLlmGenerateRequest,
) -> Result<PathBuf, String> {
    if let Some(pack_id) = request.pack_id.as_deref() {
        return resolve_pack_asset_path(app, pack_id, &request.model_path);
    }
    let path = Path::new(&request.model_path);
    if !path.is_absolute() {
        return Err("modelPath must be absolute when packId is omitted".to_string());
    }
    if !path.exists() {
        return Err(format!("Model path not found: {}", path.display()));
    }
    path.canonicalize()
        .map_err(|e| format!("Failed to canonicalize model path {}: {e}", path.display()))
}

fn read_pack_manifest(pack_dir: &Path) -> Result<ContentPackManifestLite, String> {
    let path = pack_dir.join("manifest.json");
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read manifest {}: {e}", path.display()))?;
    serde_json::from_str::<ContentPackManifestLite>(&raw)
        .map_err(|e| format!("Invalid manifest JSON {}: {e}", path.display()))
}

fn render_model_name(model: &PackLlmModelManifest, fallback_id: &str) -> String {
    if let Some(name) = model.name.as_ref() {
        if !name.trim().is_empty() {
            return name.trim().to_string();
        }
    }
    if let Some(quant) = model.quant_type.as_ref() {
        if !quant.trim().is_empty() {
            return format!("{quant} ({fallback_id})");
        }
    }
    fallback_id.to_string()
}

pub fn get_pack_llm_config<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: &str,
) -> Result<PackLlmConfigOut, String> {
    let pack_dir = pack_dir_for(app, pack_id)?;
    let manifest = read_pack_manifest(&pack_dir)?;
    if manifest.id != pack_id {
        return Err(format!(
            "Pack id mismatch in manifest: expected '{pack_id}', found '{}'",
            manifest.id
        ));
    }
    let llm = manifest
        .llm
        .ok_or_else(|| format!("Pack {pack_id} does not define an llm section"))?;
    let models = llm
        .models
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(idx, model)| {
            let model_id = model
                .id
                .clone()
                .filter(|v| !v.trim().is_empty())
                .unwrap_or_else(|| format!("model-{}", idx + 1));
            let absolute_path = resolve_pack_asset_path(app, pack_id, &model.path)
                .ok()
                .and_then(|path| path.to_str().map(|v| v.to_string()));
            PackLlmModelOut {
                id: model_id.clone(),
                name: render_model_name(&model, &model_id),
                relative_path: model.path,
                absolute_path: absolute_path.clone(),
                exists: absolute_path.is_some(),
                size_bytes: model.size_bytes,
                recommended: model.recommended.unwrap_or(false),
                quant_type: model.quant_type,
            }
        })
        .collect::<Vec<_>>();

    Ok(PackLlmConfigOut {
        runtime: llm.runtime,
        default_model: llm.default_model,
        models,
        defaults: llm.defaults,
        chat_template_path: llm.chat_template_path.or(llm.chat_template),
    })
}

fn ensure_backend_initialized(
    backend_slot: &Arc<Mutex<Option<Arc<LlamaBackend>>>>,
) -> Result<Arc<LlamaBackend>, String> {
    let mut guard = backend_slot
        .lock()
        .map_err(|_| "LLM backend lock poisoned".to_string())?;
    if let Some(backend) = guard.as_ref() {
        return Ok(Arc::clone(backend));
    }
    let backend = LlamaBackend::init()
        .map_err(|err| format!("Failed to initialize llama.cpp backend: {err}"))?;
    let backend = Arc::new(backend);
    *guard = Some(Arc::clone(&backend));
    Ok(backend)
}

fn build_prompt(model: &LlamaModel, request: &LocalLlmGenerateRequest) -> Result<String, String> {
    let chat_messages = request
        .messages
        .iter()
        .map(|msg| {
            LlamaChatMessage::new(msg.role.clone(), msg.content.clone())
                .map_err(|err| format!("Invalid chat message: {err}"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    if let Ok(template) = model.chat_template(None) {
        if let Ok(prompt) = model.apply_chat_template(&template, &chat_messages, true) {
            return Ok(prompt);
        }
    }

    let mut fallback = String::new();
    for message in &request.messages {
        fallback.push_str(message.role.trim());
        fallback.push_str(": ");
        fallback.push_str(&message.content);
        fallback.push('\n');
    }
    fallback.push_str("assistant: ");
    Ok(fallback)
}

fn build_sampler(request: &LocalLlmGenerateRequest) -> LlamaSampler {
    let repeat_penalty = request.repeat_penalty.unwrap_or(1.1).max(0.0);
    let top_p = request.top_p.unwrap_or(0.9).clamp(0.0, 1.0);
    let temperature = request.temperature.unwrap_or(0.7).clamp(0.0, 2.0);
    let mut samplers = vec![LlamaSampler::top_k(40)];

    if repeat_penalty > 0.0 {
        samplers.insert(0, LlamaSampler::penalties(128, repeat_penalty, 0.0, 0.0));
    }
    if top_p > 0.0 && top_p < 1.0 {
        samplers.push(LlamaSampler::top_p(top_p, 1));
    }
    if temperature > 0.0 {
        samplers.push(LlamaSampler::temp(temperature));
        samplers.push(LlamaSampler::dist(now_seed()));
    } else {
        samplers.push(LlamaSampler::greedy());
    }
    LlamaSampler::chain_simple(samplers)
}

fn load_model(backend: &LlamaBackend, model_path: &Path) -> Result<LlamaModel, String> {
    let params = LlamaModelParams::default();
    LlamaModel::load_from_file(backend, model_path, &params).map_err(|err| {
        format!(
            "Failed to load GGUF model '{}': {err}",
            model_path.display()
        )
    })
}

fn run_generation_with_llama<R: Runtime>(
    app: &AppHandle<R>,
    backend: Arc<LlamaBackend>,
    cancel: Arc<AtomicBool>,
    request_id: &str,
    request: &LocalLlmGenerateRequest,
    model_path: &Path,
) -> Result<GenerationOutcome, String> {
    if cancel.load(Ordering::Relaxed) {
        return Ok(GenerationOutcome::Cancelled(String::new()));
    }

    let model = load_model(backend.as_ref(), model_path)?;
    let prompt = build_prompt(&model, request)?;
    let mut prompt_tokens = model
        .str_to_token(&prompt, AddBos::Never)
        .map_err(|err| format!("Failed to tokenize prompt: {err}"))?;

    if prompt_tokens.is_empty() {
        prompt_tokens = model
            .str_to_token(&prompt, AddBos::Always)
            .map_err(|err| format!("Failed to tokenize prompt: {err}"))?;
    }
    if prompt_tokens.is_empty() {
        return Err("Prompt tokenization produced zero tokens".to_string());
    }

    let n_ctx = request.context_length.unwrap_or(4096).clamp(128, 65535);
    let n_ctx = NonZeroU32::new(n_ctx).expect("n_ctx is clamped to non-zero");
    let prompt_len = u32::try_from(prompt_tokens.len()).unwrap_or(u32::MAX);
    let n_batch = prompt_len.min(n_ctx.get()).max(32);
    let n_ubatch = n_batch.min(512);
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(Some(n_ctx))
        .with_n_batch(n_batch)
        .with_n_ubatch(n_ubatch);
    let mut ctx = model
        .new_context(backend.as_ref(), ctx_params)
        .map_err(|err| format!("Failed to create inference context: {err}"))?;

    let mut prompt_batch = LlamaBatch::new(prompt_tokens.len(), 1);
    prompt_batch
        .add_sequence(&prompt_tokens, 0, false)
        .map_err(|err| format!("Failed to add prompt to batch: {err}"))?;
    ctx.decode(&mut prompt_batch)
        .map_err(|err| format!("Failed to decode prompt: {err}"))?;

    let mut sampler = build_sampler(request);
    sampler.accept_many(prompt_tokens.iter());

    let mut output = String::new();
    let max_tokens = request.max_tokens.unwrap_or(256).clamp(1, 4096);
    let mut token_position = i32::try_from(prompt_tokens.len()).unwrap_or(i32::MAX - 1);
    let max_ctx = i32::try_from(ctx.n_ctx()).unwrap_or(i32::MAX);
    let mut generation_batch = LlamaBatch::new(1, 1);
    let mut sample_idx =
        i32::try_from(prompt_tokens.len().saturating_sub(1)).unwrap_or(i32::MAX - 1);

    for _ in 0..max_tokens {
        if cancel.load(Ordering::Relaxed) {
            return Ok(GenerationOutcome::Cancelled(output));
        }

        let token = sampler.sample(&ctx, sample_idx);
        sampler.accept(token);
        if model.is_eog_token(token) {
            break;
        }

        let token_bytes = model
            .token_to_bytes(token, Special::Tokenize)
            .map_err(|err| format!("Failed to decode token text: {err}"))?;
        let delta = String::from_utf8_lossy(&token_bytes).to_string();
        if !delta.is_empty() {
            output.push_str(&delta);
            let _ = app.emit(
                EVENT_DELTA,
                DeltaEventPayload {
                    request_id: request_id.to_string(),
                    delta,
                    accumulated_text: output.clone(),
                },
            );
        }

        if token_position >= max_ctx.saturating_sub(1) {
            break;
        }
        generation_batch.clear();
        generation_batch
            .add(token, token_position, &[0], true)
            .map_err(|err| format!("Failed to queue sampled token: {err}"))?;
        ctx.decode(&mut generation_batch)
            .map_err(|err| format!("Failed to decode sampled token: {err}"))?;
        token_position = token_position.saturating_add(1);
        sample_idx = 0;
    }

    Ok(GenerationOutcome::Completed(output))
}

fn validate_messages(messages: &[LocalLlmMessage]) -> Result<(), String> {
    if messages.is_empty() {
        return Err("messages must not be empty".to_string());
    }
    for message in messages {
        if message.role.trim().is_empty() {
            return Err("message.role must not be empty".to_string());
        }
        if message.content.trim().is_empty() {
            return Err("message.content must not be empty".to_string());
        }
    }
    Ok(())
}

#[command]
pub fn content_packs_resolve_asset_path(
    app: AppHandle,
    pack_id: String,
    relative_path: String,
) -> Result<String, String> {
    let path = resolve_pack_asset_path(&app, &pack_id, &relative_path)?;
    Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn content_packs_get_llm_config(
    app: AppHandle,
    pack_id: String,
) -> Result<PackLlmConfigOut, String> {
    get_pack_llm_config(&app, &pack_id)
}

#[command]
pub fn local_llm_runtime_status(state: State<'_, LocalLlmState>) -> LocalLlmRuntimeStatus {
    match ensure_backend_initialized(&state.backend) {
        Ok(_backend) => {
            let devices = llama_cpp_2::list_llama_ggml_backend_devices();
            let summary = if devices.is_empty() {
                "no backend devices reported".to_string()
            } else {
                devices
                    .iter()
                    .map(|d| format!("{}:{} ({})", d.backend, d.name, d.description))
                    .collect::<Vec<_>>()
                    .join("; ")
            };
            LocalLlmRuntimeStatus {
                backend: "llama.cpp-embedded",
                command_path: "embedded".to_string(),
                available: true,
                detail: Some(summary),
            }
        }
        Err(err) => LocalLlmRuntimeStatus {
            backend: "llama.cpp-embedded",
            command_path: "embedded".to_string(),
            available: false,
            detail: Some(err),
        },
    }
}

#[command]
pub async fn local_llm_generate_stream(
    app: AppHandle,
    state: State<'_, LocalLlmState>,
    request: LocalLlmGenerateRequest,
) -> Result<LocalLlmStartResponse, String> {
    validate_messages(&request.messages)?;
    let model_path = resolve_model_path(&app, &request)?;
    let request_id = next_request_id();
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = state
            .inflight
            .lock()
            .map_err(|_| "LLM inflight lock poisoned".to_string())?;
        guard.insert(request_id.clone(), cancel.clone());
    }

    let inflight = state.inflight.clone();
    let backend_slot = state.backend.clone();
    let app_handle = app.clone();
    let request_for_task = request.clone();
    let request_id_for_task = request_id.clone();
    let model_path_for_task = model_path.clone();

    tauri::async_runtime::spawn(async move {
        let request_id_for_emit = request_id_for_task.clone();
        let cancel_for_job = cancel.clone();
        let job = tauri::async_runtime::spawn_blocking(move || {
            let backend = ensure_backend_initialized(&backend_slot)?;
            run_generation_with_llama(
                &app_handle,
                backend,
                cancel_for_job,
                &request_id_for_task,
                &request_for_task,
                &model_path_for_task,
            )
        })
        .await;

        let outcome = match job {
            Ok(result) => result,
            Err(err) => Err(format!("Local generation worker failed: {err}")),
        };

        match outcome {
            Ok(GenerationOutcome::Completed(output)) => {
                let _ = app.emit(
                    EVENT_DONE,
                    DoneEventPayload {
                        request_id: request_id_for_emit.clone(),
                        output,
                    },
                );
            }
            Ok(GenerationOutcome::Cancelled(output)) => {
                let _ = app.emit(
                    EVENT_CANCELLED,
                    DoneEventPayload {
                        request_id: request_id_for_emit.clone(),
                        output,
                    },
                );
            }
            Err(err) => {
                let _ = app.emit(
                    EVENT_ERROR,
                    ErrorEventPayload {
                        request_id: request_id_for_emit.clone(),
                        message: err,
                    },
                );
            }
        }

        if let Ok(mut guard) = inflight.lock() {
            guard.remove(&request_id_for_emit);
        }
    });

    Ok(LocalLlmStartResponse { request_id })
}

#[command]
pub fn local_llm_cancel(
    state: State<'_, LocalLlmState>,
    request_id: String,
) -> Result<LocalLlmCancelResponse, String> {
    let cancelled = {
        let guard = state
            .inflight
            .lock()
            .map_err(|_| "LLM inflight lock poisoned".to_string())?;
        if let Some(cancel) = guard.get(&request_id) {
            cancel.store(true, Ordering::Relaxed);
            true
        } else {
            false
        }
    };
    Ok(LocalLlmCancelResponse {
        request_id,
        cancelled,
    })
}
