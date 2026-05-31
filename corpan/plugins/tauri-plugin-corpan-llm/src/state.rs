//! Plugin state + the real llama.cpp inference runtime.
//!
//! ## Threading model — a dedicated inference actor thread
//!
//! `llama.cpp` is process-global: `llama_backend_init()` must run once, and a
//! `LlamaContext` borrows its `LlamaModel` and is `!Send`. Tauri command futures
//! must be `Send`, so we cannot hold a context across `.await`. The clean,
//! correct answer (and the one that matches llama.cpp's own model) is a single
//! **actor thread** that owns the backend + loaded model and processes a command
//! queue. It:
//!   - loads/unloads the model,
//!   - runs each chat generation to completion, emitting `llm-token:{id}` /
//!     `llm-done:{id}` / `llm-error:{id}` events directly via the `AppHandle`,
//!   - never lets the model/context cross a thread boundary.
//!
//! Cancellation does NOT go through the queue (a running generation would block
//! it). Instead `stop()` flips a shared `AtomicBool` the generation loop polls.
//!
//! The same code runs on every platform — only the GPU backend differs (Metal on
//! Apple via the `metal` cargo feature; CPU elsewhere).

use std::collections::HashMap;
use std::num::NonZeroU32;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;

use crate::error::{Error, Result};
use crate::models::{ChatArgs, ChatMessage, ChatOptions, LoadArgs, QueryPackDbArgs, StatusResponse};
use crate::models::{DoneEvent, ErrorEvent, TokenEvent};

const DEFAULT_CTX: u32 = 4096;
const BATCH_CAP: usize = 512;

// ============================================================
// Public state handle (held by Tauri as managed state)
// ============================================================

#[derive(Clone)]
pub struct LlmState {
    inner: Arc<Shared>,
}

struct Shared {
    tx: Sender<Cmd>,
    status: Mutex<StatusSnapshot>,
    /// Per-session cancellation flags. `stop()` flips these; the generation loop
    /// polls them. Kept out of the actor queue so a running gen can be cancelled.
    cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Clone, Default)]
struct StatusSnapshot {
    model_id: Option<String>,
    backend: Option<String>,
}

/// Commands handed to the actor thread.
enum Cmd {
    Load {
        gguf_path: PathBuf,
        model_id: String,
        n_gpu_layers: Option<i32>,
        resp: Sender<Result<String>>, // Ok(backend_name)
    },
    Unload {
        resp: Sender<()>,
    },
    Chat {
        session_id: String,
        app: AppHandle<tauri::Wry>,
        messages: Vec<ChatMessage>,
        options: ChatOptions,
        cancel: Arc<AtomicBool>,
    },
}

impl LlmState {
    pub fn new() -> Self {
        let (tx, rx) = std::sync::mpsc::channel::<Cmd>();
        let inner = Arc::new(Shared {
            tx,
            status: Mutex::new(StatusSnapshot::default()),
            cancels: Mutex::new(HashMap::new()),
        });
        let actor_status = inner.clone();
        std::thread::Builder::new()
            .name("corpan-llm".into())
            .spawn(move || actor_loop(rx, actor_status))
            .expect("spawn corpan-llm actor thread");
        Self { inner }
    }

    pub fn status(&self) -> StatusResponse {
        let s = self.inner.status.lock();
        StatusResponse {
            loaded: s.model_id.is_some(),
            model_id: s.model_id.clone(),
            backend: s.backend.clone(),
            available_memory_mb: device_memory_mb(),
        }
    }

    /// Resolve the GGUF from the installed base pack and ask the actor to load it.
    pub async fn load_model(&self, app: AppHandle<tauri::Wry>, args: LoadArgs) -> Result<()> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| Error::Internal(format!("app_data_dir: {e}")))?;
        let gguf_path = app_data
            .join("corpan-packs")
            .join(&args.model_pack_id)
            .join("model")
            .join("base.gguf");
        if !gguf_path.exists() {
            return Err(Error::ModelNotFound(gguf_path.display().to_string()));
        }

        // Integrity preflight: a truncated/corrupt download is the most common
        // cause of llama.cpp returning a null model. Verify size + GGUF magic
        // here so the error is unambiguous (and we don't blame memory/GPU).
        let meta = std::fs::metadata(&gguf_path)
            .map_err(|e| Error::LlamaCpp(format!("stat gguf: {e}")))?;
        let size = meta.len();
        let mut magic = [0u8; 4];
        {
            use std::io::Read;
            let mut f = std::fs::File::open(&gguf_path)
                .map_err(|e| Error::LlamaCpp(format!("open gguf: {e}")))?;
            let _ = f.read_exact(&mut magic);
        }
        let magic_ok = &magic == b"GGUF";
        log::info!(
            "[corpan-llm] gguf preflight size={} magic_ok={} ({:?})",
            size, magic_ok, magic
        );
        if size < 1_000_000 || !magic_ok {
            return Err(Error::ModelCorrupt(format!(
                "size={size} bytes, magic={magic:?} (expected GGUF)"
            )));
        }

        let (resp_tx, resp_rx) = std::sync::mpsc::channel();
        self.inner
            .tx
            .send(Cmd::Load {
                gguf_path,
                model_id: args.model_pack_id.clone(),
                n_gpu_layers: args.gpu_layers,
                resp: resp_tx,
            })
            .map_err(|_| Error::Internal("inference thread gone".into()))?;

        // Model load is a multi-second mmap; wait off the async executor.
        let inner = self.inner.clone();
        let model_id = args.model_pack_id.clone();
        let backend = tauri::async_runtime::spawn_blocking(move || resp_rx.recv())
            .await
            .map_err(|e| Error::Internal(format!("load join: {e}")))?
            .map_err(|_| Error::Internal("inference thread dropped load response".into()))??;

        let mut s = inner.status.lock();
        s.model_id = Some(model_id);
        s.backend = Some(backend);
        Ok(())
    }

    pub async fn unload(&self) -> Result<()> {
        let (resp_tx, resp_rx) = std::sync::mpsc::channel();
        self.inner
            .tx
            .send(Cmd::Unload { resp: resp_tx })
            .map_err(|_| Error::Internal("inference thread gone".into()))?;
        let _ = tauri::async_runtime::spawn_blocking(move || resp_rx.recv()).await;
        let mut s = self.inner.status.lock();
        s.model_id = None;
        s.backend = None;
        self.inner.cancels.lock().clear();
        Ok(())
    }

    pub fn stop(&self, session_id: &str) -> Result<()> {
        let cancels = self.inner.cancels.lock();
        if let Some(flag) = cancels.get(session_id) {
            flag.store(true, Ordering::SeqCst);
            Ok(())
        } else {
            Err(Error::InvalidSession(session_id.to_string()))
        }
    }

    /// Kick off a streaming generation. Returns immediately with the session id;
    /// tokens stream via `llm-token:{id}` events emitted by the actor thread.
    pub fn start_chat(
        &self,
        app: AppHandle<tauri::Wry>,
        session_id: String,
        args: ChatArgs,
    ) -> Result<()> {
        if self.inner.status.lock().model_id.is_none() {
            return Err(Error::ModelNotLoaded);
        }
        let cancel = Arc::new(AtomicBool::new(false));
        self.inner
            .cancels
            .lock()
            .insert(session_id.clone(), cancel.clone());
        self.inner
            .tx
            .send(Cmd::Chat {
                session_id,
                app,
                messages: args.messages,
                options: args.options,
                cancel,
            })
            .map_err(|_| Error::Internal("inference thread gone".into()))
    }

    pub async fn query_pack_db(&self, _args: &QueryPackDbArgs) -> Result<serde_json::Value> {
        // Packs use HostApi.queryPackDb (the host's rusqlite path) instead.
        Err(Error::Internal(
            "llm_query_pack_db not wired — use HostApi.queryPackDb".into(),
        ))
    }
}

// ============================================================
// The actor thread
// ============================================================

fn actor_loop(rx: Receiver<Cmd>, shared: Arc<Shared>) {
    let backend = match LlamaBackend::init() {
        Ok(b) => b,
        Err(e) => {
            log::error!("[corpan-llm] backend init failed: {e}");
            return;
        }
    };
    let mut model: Option<LlamaModel> = None;

    while let Ok(cmd) = rx.recv() {
        match cmd {
            Cmd::Load {
                gguf_path,
                model_id,
                n_gpu_layers,
                resp,
            } => {
                let want_gpu = n_gpu_layers.unwrap_or(999).max(0) as u32;
                // Free any previously-loaded model BEFORE allocating the new one.
                // The weights are a ~2.5 GB resident buffer (a GPU buffer under
                // Metal); on unified-memory iOS, holding the old copy while
                // loading a second exceeds the per-app jetsam limit and llama.cpp
                // returns null from BOTH the GPU and CPU paths. This is exactly
                // the pack exit→re-enter reload case: drop first, then load.
                if model.is_some() {
                    log::info!("[corpan-llm] dropping previously-loaded model before reload");
                    model = None;
                }
                let avail = device_memory_mb();
                log::info!("[corpan-llm] load START {model_id} want_gpu={want_gpu} avail={avail:?}MB");
                // Try full GPU offload first (Metal). On unified-memory iOS the
                // weights become a ~2.5 GB resident GPU buffer that can exceed the
                // per-app jetsam limit; if that fails, fall back to CPU + mmap so
                // the weights stay file-backed/evictable (slower but reliable).
                let load_with = |ngl: u32| {
                    let mp = LlamaModelParams::default().with_n_gpu_layers(ngl);
                    LlamaModel::load_from_file(&backend, &gguf_path, &mp)
                };
                let outcome: Result<(LlamaModel, String)> = match load_with(want_gpu) {
                    Ok(m) => Ok((m, backend_name())),
                    Err(e_gpu) if want_gpu > 0 => {
                        log::warn!("[corpan-llm] GPU load failed ({e_gpu}); retrying CPU+mmap");
                        match load_with(0) {
                            Ok(m) => Ok((m, "cpu".to_string())),
                            Err(e_cpu) => Err(Error::LlamaCpp(format!(
                                "load failed (gpu: {e_gpu}; cpu: {e_cpu}); avail ~{} MB",
                                avail.map(|m| m.to_string()).unwrap_or_else(|| "?".into())
                            ))),
                        }
                    }
                    Err(e) => Err(Error::LlamaCpp(format!(
                        "load: {e}; avail ~{} MB",
                        avail.map(|m| m.to_string()).unwrap_or_else(|| "?".into())
                    ))),
                };
                match outcome {
                    Ok((m, backend_str)) => {
                        model = Some(m);
                        log::info!("[corpan-llm] loaded {model_id} ({backend_str})");
                        let _ = resp.send(Ok(backend_str));
                    }
                    Err(e) => {
                        log::error!("[corpan-llm] {e}");
                        let _ = resp.send(Err(e));
                    }
                }
            }
            Cmd::Unload { resp } => {
                model = None;
                let _ = resp.send(());
            }
            Cmd::Chat {
                session_id,
                app,
                messages,
                options,
                cancel,
            } => {
                let result = match model.as_ref() {
                    Some(m) => run_chat(&backend, m, messages, options, app.clone(), &session_id, &cancel),
                    None => Err(Error::ModelNotLoaded),
                };
                if let Err(e) = result {
                    let (code, msg) = e.code_and_message();
                    let _ = app.emit(
                        &format!("llm-error:{session_id}"),
                        ErrorEvent {
                            session_id: session_id.clone(),
                            code: code.to_string(),
                            error: msg,
                        },
                    );
                }
                // Clean up the cancellation flag for this session.
                shared.cancels.lock().remove(&session_id);
            }
        }
    }
}

/// Run one full generation, emitting token/done events. Blocking; runs on the
/// actor thread so the `!Send` context never leaves it.
fn run_chat(
    backend: &LlamaBackend,
    model: &LlamaModel,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
    app: AppHandle<tauri::Wry>,
    session_id: &str,
    cancel: &AtomicBool,
) -> Result<()> {
    let n_ctx = DEFAULT_CTX;
    // Note: the RNG seed lives in the sampler (`LlamaSampler::dist`), not the
    // context params, in current llama-cpp-2.
    let ctx_params =
        LlamaContextParams::default().with_n_ctx(Some(NonZeroU32::new(n_ctx).unwrap()));
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| Error::LlamaCpp(format!("context: {e}")))?;

    let prompt = format_chatml(&messages);
    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|e| Error::LlamaCpp(format!("tokenize: {e}")))?;

    let max_tokens = options.max_tokens.unwrap_or(1500) as i32;
    let n_ctx_i = ctx.n_ctx() as i32;
    if tokens.len() as i32 >= n_ctx_i {
        return Err(Error::Internal("prompt longer than context window".into()));
    }

    // Decode the prompt in BATCH_CAP-sized chunks. A single LlamaBatch holds at
    // most BATCH_CAP tokens, and a grounded system prompt easily exceeds that —
    // so we feed the prompt in windows, requesting logits only on the very last
    // token of the final chunk (that's the position we sample from).
    let mut batch = LlamaBatch::new(BATCH_CAP, 1);
    let n_prompt = tokens.len() as i32;
    let last = n_prompt - 1;
    let mut pos: i32 = 0;
    while pos < n_prompt {
        batch.clear();
        let end = (pos + BATCH_CAP as i32).min(n_prompt);
        for i in pos..end {
            batch
                .add(tokens[i as usize], i, &[0], i == last)
                .map_err(|e| Error::LlamaCpp(format!("batch add: {e}")))?;
        }
        ctx.decode(&mut batch)
            .map_err(|e| Error::LlamaCpp(format!("decode prompt: {e}")))?;
        pos = end;
    }

    let mut sampler = build_sampler(&options);
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    // We always sample from the last token of the most recent decode, which is
    // `batch.n_tokens() - 1` (the final prompt chunk now, then each 1-token step).
    let mut n_cur = n_prompt;
    let start = std::time::Instant::now();
    let mut produced: u32 = 0;
    let gen_limit = (tokens.len() as i32 + max_tokens).min(n_ctx_i);

    while n_cur < gen_limit {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        let token = sampler.sample(&ctx, batch.n_tokens() - 1);
        sampler.accept(token);

        if model.is_eog_token(token) {
            break;
        }

        // token_to_piece feeds bytes through the incremental UTF-8 decoder, so a
        // multi-byte char split across tokens (e.g. a hanzi) emits correctly.
        let piece = model
            .token_to_piece(token, &mut decoder, false, None)
            .map_err(|e| Error::LlamaCpp(format!("detok: {e}")))?;
        if !piece.is_empty() {
            let _ = app.emit(
                &format!("llm-token:{session_id}"),
                TokenEvent {
                    session_id: session_id.to_string(),
                    token: piece,
                },
            );
        }
        produced += 1;

        batch.clear();
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|e| Error::LlamaCpp(format!("batch add: {e}")))?;
        n_cur += 1;
        ctx.decode(&mut batch)
            .map_err(|e| Error::LlamaCpp(format!("decode: {e}")))?;
    }

    let _ = app.emit(
        &format!("llm-done:{session_id}"),
        DoneEvent {
            session_id: session_id.to_string(),
            total_tokens: produced,
            elapsed_ms: start.elapsed().as_millis() as u64,
        },
    );
    Ok(())
}

// ============================================================
// Prompt formatting + sampler
// ============================================================

/// Qwen3 uses ChatML. The pack already prepends the system message, so we just
/// wrap each message and open the assistant turn.
fn format_chatml(messages: &[ChatMessage]) -> String {
    let mut s = String::new();
    for m in messages {
        s.push_str("<|im_start|>");
        s.push_str(&m.role);
        s.push('\n');
        s.push_str(&m.content);
        s.push_str("<|im_end|>\n");
    }
    s.push_str("<|im_start|>assistant\n");
    s
}

fn build_sampler(options: &ChatOptions) -> LlamaSampler {
    let temp = options.temperature.unwrap_or(0.55);
    if temp <= 0.0 {
        return LlamaSampler::greedy();
    }
    let top_p = options.top_p.unwrap_or(0.9);
    let repeat = options.repeat_penalty.unwrap_or(1.2);
    LlamaSampler::chain_simple([
        LlamaSampler::penalties(64, repeat, 0.0, 0.0),
        LlamaSampler::top_k(40),
        LlamaSampler::top_p(top_p, 1),
        LlamaSampler::temp(temp),
        LlamaSampler::dist(seed()),
    ])
}

// ============================================================
// Small helpers
// ============================================================

fn seed() -> u32 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(1234)
}

fn backend_name() -> String {
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        "metal".to_string()
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        "cpu".to_string()
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn device_memory_mb() -> Option<u64> {
    None
}

#[cfg(target_os = "ios")]
fn device_memory_mb() -> Option<u64> {
    // os_proc_available_memory() = bytes this process may still allocate before
    // iOS jetsam terminates it. The meaningful headroom for loading a model.
    extern "C" {
        fn os_proc_available_memory() -> usize;
    }
    let avail = unsafe { os_proc_available_memory() };
    if avail == 0 {
        None
    } else {
        Some((avail as u64) / 1_048_576)
    }
}

#[cfg(target_os = "android")]
fn device_memory_mb() -> Option<u64> {
    None
}

