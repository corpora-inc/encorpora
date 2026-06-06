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
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::LlamaToken;

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
        eprintln!(
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

/// A persistent inference context plus the exact tokens currently resident in
/// its KV cache (seq 0). Held across chat turns so we can REUSE the cached
/// prefix instead of re-prefilling system+grounding+history every turn.
///
/// SAFETY: `ctx` borrows the actor's loaded `LlamaModel`, but we erase that
/// borrow to `'static` so the context can live in the actor's state across
/// command-loop iterations (a `LlamaContext<'a>` can't otherwise coexist with a
/// reassignable `Option<LlamaModel>` — self-reference). This is sound ONLY
/// because: (1) the actor thread is the sole owner and the context never leaves
/// it; (2) we ALWAYS drop the session (`session = None`) BEFORE dropping or
/// replacing the model (see `Cmd::Load` / `Cmd::Unload`), so the erased borrow
/// never dangles.
struct ChatSession {
    ctx: LlamaContext<'static>,
    /// Tokens currently committed in KV seq 0 (prompt prefix + tokens decoded so
    /// far). The longest common prefix of this and the next turn's prompt is
    /// what we get to skip re-prefilling.
    cached: Vec<LlamaToken>,
    /// Thread count baked into `ctx` at creation (for the PERF log; the context's
    /// thread count is fixed once created).
    threads: i32,
}

/// Create a fresh inference context for `model` and erase its borrow to
/// `'static`. See `ChatSession` SAFETY. Caller MUST ensure the returned session
/// is dropped before `model`.
fn new_session(backend: &LlamaBackend, model: &LlamaModel) -> Result<ChatSession> {
    let threads = perf_core_count();
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(Some(NonZeroU32::new(DEFAULT_CTX).unwrap()))
        .with_n_threads(threads)
        .with_n_threads_batch(threads);
    let ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| Error::LlamaCpp(format!("context: {e}")))?;
    // SAFETY: lifetime-only transmute (LlamaContext is `{ NonNull, &model }`);
    // soundness rests on the drop-order invariant documented on `ChatSession`.
    let ctx: LlamaContext<'static> = unsafe { std::mem::transmute(ctx) };
    Ok(ChatSession {
        ctx,
        cached: Vec::new(),
        threads,
    })
}

/// Length of the longest common prefix of two token slices.
fn common_prefix_len(a: &[LlamaToken], b: &[LlamaToken]) -> usize {
    a.iter().zip(b.iter()).take_while(|(x, y)| x == y).count()
}

fn actor_loop(rx: Receiver<Cmd>, shared: Arc<Shared>) {
    let backend = match LlamaBackend::init() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[corpan-llm] backend init failed: {e}");
            return;
        }
    };
    let mut model: Option<LlamaModel> = None;
    // Persistent KV-cache context for the active conversation (see ChatSession).
    // INVARIANT: always dropped (set to None) BEFORE `model` is dropped/replaced.
    let mut session: Option<ChatSession> = None;

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
                    eprintln!("[corpan-llm] dropping previously-loaded model before reload");
                    // INVARIANT: drop the session (its ctx borrows the old model)
                    // BEFORE the model, and its KV belongs to the old weights.
                    session = None;
                    model = None;
                }
                let avail = device_memory_mb();
                let load_start = std::time::Instant::now();
                eprintln!(
                    "[corpan-llm] load START {model_id} want_gpu={want_gpu} avail={avail:?}MB perf_cores={}",
                    perf_core_count()
                );
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
                        eprintln!("[corpan-llm] GPU load failed ({e_gpu}); retrying CPU+mmap");
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
                        eprintln!(
                            "[corpan-llm] loaded {model_id} ({backend_str}) in {}ms",
                            load_start.elapsed().as_millis()
                        );
                        let _ = resp.send(Ok(backend_str));
                    }
                    Err(e) => {
                        eprintln!("[corpan-llm] {e}");
                        let _ = resp.send(Err(e));
                    }
                }
            }
            Cmd::Unload { resp } => {
                // INVARIANT: session before model.
                session = None;
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
                    Some(m) => run_chat(
                        &backend,
                        m,
                        &mut session,
                        messages,
                        options,
                        app.clone(),
                        &session_id,
                        &cancel,
                    ),
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

/// Run one full generation against the persistent session, emitting token/done
/// events. Blocking; runs on the actor thread so the `!Send` context never
/// leaves it. Creates the session on first use, and POISONS it (drops, forcing
/// a clean rebuild next turn) on any error so a half-mutated KV cache is never
/// reused.
fn run_chat(
    backend: &LlamaBackend,
    model: &LlamaModel,
    session: &mut Option<ChatSession>,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
    app: AppHandle<tauri::Wry>,
    session_id: &str,
    cancel: &AtomicBool,
) -> Result<()> {
    if session.is_none() {
        *session = Some(new_session(backend, model)?);
    }
    let result = run_turn(
        session.as_mut().unwrap(),
        model,
        messages,
        options,
        &app,
        session_id,
        cancel,
    );
    if result.is_err() {
        // KV cache may be inconsistent after a mid-turn failure — discard the
        // session so the next turn rebuilds and re-prefills from scratch.
        *session = None;
    }
    result
}

/// One turn against an existing session: window → reuse the cached KV prefix →
/// prefill only the new suffix → generate.
fn run_turn(
    sess: &mut ChatSession,
    model: &LlamaModel,
    messages: Vec<ChatMessage>,
    options: ChatOptions,
    app: &AppHandle<tauri::Wry>,
    session_id: &str,
    cancel: &AtomicBool,
) -> Result<()> {
    let max_tokens = options.max_tokens.unwrap_or(1500) as i32;
    let n_ctx_i = sess.ctx.n_ctx() as i32;
    let threads = sess.threads;

    // Sliding window: the prompt is rebuilt fresh every turn (system + grounding
    // + RAG + the WHOLE history), so an unbounded conversation grows the prompt
    // until it (a) hard-errors at n_ctx and (b) slows decode (attention spans the
    // full KV). Keep all leading system message(s) + the most recent turns that
    // fit a token budget that RESERVES room for the reply; drop oldest turns.
    let reserve = max_tokens.clamp(128, 512);
    let budget = (n_ctx_i - reserve).max(256);
    let (_kept_msgs, tokens, dropped) = window_messages(model, messages, budget)?;
    if dropped > 0 {
        eprintln!(
            "[corpan-llm] context window: dropped {dropped} oldest message(s) to fit {budget} tok (n_ctx={n_ctx_i}, reserve={reserve})"
        );
    }
    let n_prompt = tokens.len() as i32;
    // Defensive floor — should be unreachable after windowing.
    if n_prompt >= n_ctx_i {
        return Err(Error::ContextOverflow);
    }

    // KV PREFIX REUSE: the longest common prefix of this prompt and the tokens
    // already resident in the KV cache costs nothing to re-ingest. Drop the KV
    // past the divergence point, then prefill only the suffix. Self-healing: any
    // change (new system prompt on a language switch, a fresh conversation, the
    // sliding window dropping turns, the prior reply re-tokenizing differently)
    // simply lowers the LCP and re-prefills from there — never incorrect.
    let mut reuse = common_prefix_len(&sess.cached, &tokens);
    // Always (re)decode at least the final prompt token so the sampler has fresh
    // logits for THIS turn, even if the whole prompt was already cached.
    if reuse >= n_prompt as usize {
        reuse = (n_prompt - 1) as usize;
    }
    if reuse < sess.cached.len() {
        sess.ctx
            .clear_kv_cache_seq(Some(0), Some(reuse as u32), None)
            .map_err(|e| Error::LlamaCpp(format!("kv trim: {e}")))?;
        sess.cached.truncate(reuse);
    }

    // Prefill tokens[reuse..] in BATCH_CAP-sized chunks at ABSOLUTE positions
    // [reuse..n_prompt), requesting logits only on the very last token.
    let mut batch = LlamaBatch::new(BATCH_CAP, 1);
    let last = n_prompt - 1;
    let prefill_start = std::time::Instant::now();
    let mut pos: i32 = reuse as i32;
    while pos < n_prompt {
        batch.clear();
        let end = (pos + BATCH_CAP as i32).min(n_prompt);
        for i in pos..end {
            batch
                .add(tokens[i as usize], i, &[0], i == last)
                .map_err(|e| Error::LlamaCpp(format!("batch add: {e}")))?;
        }
        sess.ctx
            .decode(&mut batch)
            .map_err(|e| Error::LlamaCpp(format!("decode prompt: {e}")))?;
        pos = end;
    }
    // The KV now holds the full prompt: cached[..reuse] already equals
    // tokens[..reuse] (LCP), so appending the suffix makes cached == tokens.
    sess.cached.extend_from_slice(&tokens[reuse..]);

    // PERF: report prefilled vs reused so the cache win is visible in logcat.
    let prefilled = n_prompt - reuse as i32;
    let prefill_ms = prefill_start.elapsed().as_millis().max(1) as f64;
    eprintln!(
        "[corpan-llm] PERF prefill: {prefilled} tok (reused {reuse}) in {:.0}ms = {:.1} tok/s | threads={threads} n_ctx={n_ctx_i}",
        prefill_ms,
        (prefilled as f64) * 1000.0 / prefill_ms,
    );

    let mut sampler = build_sampler(&options);
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    // We always sample from the last token of the most recent decode, which is
    // `batch.n_tokens() - 1` (the final prompt chunk now, then each 1-token step).
    let mut n_cur = n_prompt;
    let start = std::time::Instant::now();
    let mut produced: u32 = 0;
    let gen_limit = (n_prompt + max_tokens).min(n_ctx_i);

    while n_cur < gen_limit {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        let token = sampler.sample(&sess.ctx, batch.n_tokens() - 1);
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
        // Keep `cached` in lockstep with the KV: this token is committed by the
        // decode below. (On a later error the whole session is dropped, so a
        // transient mismatch is never observed.)
        sess.cached.push(token);
        n_cur += 1;
        sess.ctx
            .decode(&mut batch)
            .map_err(|e| Error::LlamaCpp(format!("decode: {e}")))?;
    }

    // PERF: decode (token generation) throughput, separate from prefill above.
    let decode_ms = start.elapsed().as_millis().max(1) as f64;
    eprintln!(
        "[corpan-llm] PERF decode: {produced} tok in {:.0}ms = {:.1} tok/s",
        decode_ms,
        (produced as f64) * 1000.0 / decode_ms,
    );

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

/// Number of CPU threads to use for inference = the performance-core count.
///
/// llama.cpp's default (a hardcoded 4, no autodetection) is wrong on phones: a
/// modern Snapdragon is big.LITTLE (e.g. 1 prime + 3-5 performance + 2-4
/// efficiency cores). Using ALL cores oversaturates memory bandwidth (the real
/// bottleneck) and parks threads on slow efficiency cores; the fixed 4 leaves
/// performance cores idle. We detect the performance-core count from sysfs max
/// frequencies (count cores above the slowest tier). Falls back to
/// max(2, available_parallelism/2) when sysfs is unavailable (Apple/desktop).
fn perf_core_count() -> i32 {
    // Manual override (no rebuild): env CORPAN_LLM_THREADS, or on Android
    // `adb shell setprop debug.corpan.llm_threads N`. Lets us A/B thread counts
    // live on-device. >0 wins; 0/unset/invalid → auto-detect below.
    if let Some(n) = thread_override() {
        if n > 0 {
            return n;
        }
    }
    #[cfg(target_os = "android")]
    {
        if let Some(n) = inference_threads_from_sysfs() {
            return n;
        }
    }
    let logical = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    ((logical / 2).max(2)) as i32
}

/// Manual thread-count override from env or (Android) a system property.
fn thread_override() -> Option<i32> {
    if let Ok(v) = std::env::var("CORPAN_LLM_THREADS") {
        if let Ok(n) = v.trim().parse::<i32>() {
            return Some(n);
        }
    }
    #[cfg(target_os = "android")]
    {
        if let Ok(out) = std::process::Command::new("getprop")
            .arg("debug.corpan.llm_threads")
            .output()
        {
            if let Ok(s) = String::from_utf8(out.stdout) {
                if let Ok(n) = s.trim().parse::<i32>() {
                    return Some(n);
                }
            }
        }
    }
    None
}

/// Pick the inference thread count from the Android CPU topology.
///
/// Classify cores by `cpu_capacity` (the kernel's normalized 0..1024 big/LITTLE
/// signal; falls back to `cpuinfo_max_freq`). "Efficiency" = cores below 50% of
/// the max capacity — true LITTLE cores that bottleneck LLM matmul. Use
/// (total − efficiency) big cores; if the chip has NO efficiency tier (e.g.
/// Snapdragon 8 Elite = 2 prime + 6 performance, all ≥74% capacity), reserve ONE
/// core for the OS/UI/render thread so token streaming stays smooth. Clamp [2,total].
///
/// Examples: 8 Elite (1024×2, 765×6) → no LITTLE → 8−1 = 7. 8 Gen 3
/// (1024 + perf×5 + ~300×2) → 2 LITTLE → 6. 4+4 (1024×4, ~400×4) → 4.
#[cfg(target_os = "android")]
fn inference_threads_from_sysfs() -> Option<i32> {
    fn read_core_metrics(file: &str) -> Vec<u64> {
        let mut v = Vec::new();
        for cpu in 0..16 {
            let path = format!("/sys/devices/system/cpu/cpu{cpu}/{file}");
            match std::fs::read_to_string(&path) {
                Ok(s) => {
                    if let Ok(n) = s.trim().parse::<u64>() {
                        v.push(n);
                    }
                }
                Err(_) => break, // contiguous cpuN; stop at the first gap
            }
        }
        v
    }

    // Prefer cpu_capacity (kernel big/LITTLE signal); fall back to max freq.
    let mut metrics = read_core_metrics("cpu_capacity");
    if metrics.len() < 2 {
        metrics = read_core_metrics("cpufreq/cpuinfo_max_freq");
    }
    if metrics.len() < 2 {
        return None;
    }
    let total = metrics.len();
    let max = *metrics.iter().max()?;
    let efficiency = metrics.iter().filter(|&&m| m * 2 < max).count();
    let big = total - efficiency;
    let n = if efficiency == 0 { big.saturating_sub(1) } else { big };
    Some((n.clamp(2, total)) as i32)
}

// ============================================================
// Prompt formatting + sampler
// ============================================================

/// Qwen3 uses ChatML. The pack already prepends the system message, so we just
/// wrap each message and open the assistant turn.
/// Trim oldest non-system turns until the ChatML prompt fits `budget` tokens,
/// always keeping the leading system message(s) AND the most recent turn. The
/// whole prompt is re-tokenized per drop step; that's O(turns) tokenizations
/// only when actually over budget (long conversations), and tokenization is
/// microseconds next to inference. Returns the kept messages, their tokens
/// (incl. BOS, ready to prefill), and how many were dropped.
fn window_messages(
    model: &LlamaModel,
    messages: Vec<ChatMessage>,
    budget: i32,
) -> Result<(Vec<ChatMessage>, Vec<LlamaToken>, usize)> {
    let sys_end = messages.iter().take_while(|m| m.role == "system").count();
    let total = messages.len();
    let mut drop = 0usize;
    loop {
        let kept: Vec<ChatMessage> = messages[..sys_end]
            .iter()
            .chain(messages[sys_end + drop..].iter())
            .cloned()
            .collect();
        let prompt = format_chatml(&kept);
        let tokens = model
            .str_to_token(&prompt, AddBos::Always)
            .map_err(|e| Error::LlamaCpp(format!("tokenize: {e}")))?;
        // Stop when it fits, or when only system + the single newest turn remain
        // (we never drop the current user turn).
        let fits = tokens.len() as i32 <= budget;
        let at_floor = sys_end + drop + 1 >= total;
        if fits || at_floor {
            return Ok((kept, tokens, drop));
        }
        drop += 1;
    }
}

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
    let top_k = options.top_k.unwrap_or(40);
    let min_p = options.min_p.unwrap_or(0.0);
    let repeat = options.repeat_penalty.unwrap_or(1.2);
    let presence = options.presence_penalty.unwrap_or(0.0);
    LlamaSampler::chain_simple([
        LlamaSampler::penalties(64, repeat, 0.0, presence),
        LlamaSampler::top_k(top_k),
        LlamaSampler::top_p(top_p, 1),
        LlamaSampler::min_p(min_p, 1),
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
