//! Plugin state. Holds the loaded model (when present) and active sessions.
//!
//! For v0.1: desktop-only inference via `llama-cpp-2`. The mobile bridges
//! (iOS XCFramework + Android JNI to llama.cpp directly) replace the
//! `runtime::*` functions on those platforms via the conditional compilation
//! at the bottom of this file.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Manager, Runtime};

use crate::error::{Error, Result};
use crate::models::{ChatArgs, LoadArgs, QueryPackDbArgs, StatusResponse};

/// Stats returned at end of generation.
pub struct GenStats {
    pub total_tokens: u32,
    pub elapsed_ms: u64,
}

/// Inner state — protected by Mutex; cloning the LlmState is just an Arc clone.
struct Inner {
    /// The model file on disk (resolved via the installed base pack).
    model_path: Option<PathBuf>,
    /// Pack id of currently loaded model.
    model_id: Option<String>,
    /// Backend description.
    backend: Option<String>,
    /// Active session ids that haven't completed.
    sessions: HashMap<String, SessionFlag>,
}

#[derive(Clone)]
pub struct SessionFlag {
    pub stop: Arc<std::sync::atomic::AtomicBool>,
}

#[derive(Clone)]
pub struct LlmState {
    inner: Arc<Mutex<Inner>>,
}

impl Default for LlmState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                model_path: None,
                model_id: None,
                backend: None,
                sessions: HashMap::new(),
            })),
        }
    }
}

impl LlmState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn handle(&self) -> LlmStateHandle {
        LlmStateHandle {
            inner: self.inner.clone(),
        }
    }

    pub fn status(&self) -> StatusResponse {
        let inner = self.inner.lock();
        StatusResponse {
            loaded: inner.model_id.is_some(),
            model_id: inner.model_id.clone(),
            backend: inner.backend.clone(),
            available_memory_mb: device_memory_mb(),
        }
    }

    pub async fn load_model<R: Runtime>(&self, app: AppHandle<R>, args: LoadArgs) -> Result<()> {
        // Resolve the GGUF path from the installed base pack.
        // Installed packs live at app_data_dir()/corpan-packs/{packId}/...
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|e| Error::Internal(format!("app_data_dir: {e}")))?;
        let pack_dir = app_data.join("corpan-packs").join(&args.model_pack_id);
        let gguf_path = pack_dir.join("model").join("base.gguf");
        if !gguf_path.exists() {
            return Err(Error::ModelNotFound(gguf_path.display().to_string()));
        }

        // Memory check — refuse if device clearly can't fit the model.
        let needed_mb = file_size_mb(&gguf_path).unwrap_or(2600);
        if let Some(avail) = device_memory_mb() {
            if avail < needed_mb + 800 {
                return Err(Error::InsufficientMemory);
            }
        }

        let (backend, _ctx) = runtime::load(&gguf_path, args.gpu_layers, args.context_size)?;

        let mut inner = self.inner.lock();
        inner.model_path = Some(gguf_path);
        inner.model_id = Some(args.model_pack_id);
        inner.backend = Some(backend);
        Ok(())
    }

    pub fn unload(&self) -> Result<()> {
        runtime::unload()?;
        let mut inner = self.inner.lock();
        inner.model_path = None;
        inner.model_id = None;
        inner.backend = None;
        inner.sessions.clear();
        Ok(())
    }

    pub fn stop(&self, session_id: &str) -> Result<()> {
        let inner = self.inner.lock();
        if let Some(s) = inner.sessions.get(session_id) {
            s.stop.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        } else {
            Err(Error::InvalidSession(session_id.to_string()))
        }
    }

    pub async fn query_pack_db(&self, _args: &QueryPackDbArgs) -> Result<serde_json::Value> {
        // For v0.1 we delegate to the existing HostApi.queryPackDb on the JS
        // side rather than re-implementing the lookup here. The presence of
        // this command in the IPC surface lets future packs query without
        // going through the SDK shim.
        Err(Error::Internal(
            "llm_query_pack_db not yet wired — use HostApi.queryPackDb".into(),
        ))
    }
}

pub struct LlmStateHandle {
    inner: Arc<Mutex<Inner>>,
}

impl LlmStateHandle {
    pub async fn stream_chat<F>(
        &self,
        args: ChatArgs,
        session_id: &str,
        on_token: F,
    ) -> Result<GenStats>
    where
        F: FnMut(String) + Send + 'static,
    {
        // Register session
        let flag = SessionFlag {
            stop: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };
        {
            let mut inner = self.inner.lock();
            if inner.model_id.is_none() {
                return Err(Error::ModelNotLoaded);
            }
            if inner.sessions.contains_key(session_id) {
                return Err(Error::GenerationInProgress);
            }
            inner.sessions.insert(session_id.to_string(), flag.clone());
        }

        let result = runtime::stream(args, flag.clone(), on_token).await;

        // Unregister
        {
            let mut inner = self.inner.lock();
            inner.sessions.remove(session_id);
        }

        result
    }
}

fn file_size_mb(path: &std::path::Path) -> Option<u64> {
    std::fs::metadata(path).ok().map(|m| m.len() / 1_048_576)
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
fn device_memory_mb() -> Option<u64> {
    // Desktop: skip; we trust dev machines.
    None
}

#[cfg(target_os = "ios")]
fn device_memory_mb() -> Option<u64> {
    // Implemented by the iOS Swift bridge — returns NSProcessInfo.physicalMemory / 1024^2.
    None
}

#[cfg(target_os = "android")]
fn device_memory_mb() -> Option<u64> {
    // Implemented by Android JNI — reads /proc/meminfo MemAvailable.
    None
}

// ============================================================
// Runtime — desktop uses llama-cpp-2; mobile uses native bridges.
// ============================================================

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod runtime {
    use super::*;

    pub fn load(
        _gguf_path: &std::path::Path,
        _gpu_layers: Option<i32>,
        _context_size: Option<u32>,
    ) -> Result<(String, ())> {
        // TODO: wire llama-cpp-2 here on desktop.
        // For now, stub: pretend loaded, backend "cpu".
        log::info!("[llm] desktop runtime stub — actual llama-cpp-2 load goes here");
        Ok(("cpu".to_string(), ()))
    }

    pub fn unload() -> Result<()> {
        log::info!("[llm] desktop runtime unload (stub)");
        Ok(())
    }

    pub async fn stream<F>(
        args: ChatArgs,
        flag: SessionFlag,
        mut on_token: F,
    ) -> Result<GenStats>
    where
        F: FnMut(String) + Send + 'static,
    {
        // Desktop stub: just echo back the last user message word-by-word as
        // tokens, with a brief delay. Lets pack JS verify the streaming pipe.
        let last_user = args
            .messages
            .iter()
            .rev()
            .find(|m| m.role == "user")
            .map(|m| m.content.clone())
            .unwrap_or_default();
        let words: Vec<&str> = last_user.split_whitespace().collect();
        let mut count = 0u32;
        let start = std::time::Instant::now();
        for w in words {
            if flag.stop.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
            on_token(format!("{w} "));
            count += 1;
            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        }
        Ok(GenStats {
            total_tokens: count,
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }
}

#[cfg(any(target_os = "ios", target_os = "android"))]
mod runtime {
    // The Tauri plugin mobile pattern routes calls through the platform-specific
    // bridge (Swift on iOS, Kotlin on Android). The desktop functions are
    // replaced with mobile-only no-ops here so the crate still compiles.
    use super::*;

    pub fn load(
        _gguf_path: &std::path::Path,
        _gpu_layers: Option<i32>,
        _context_size: Option<u32>,
    ) -> Result<(String, ())> {
        // The actual load is performed by the platform bridge.
        Err(Error::Internal(
            "mobile runtime not yet bridged — polish machine work".into(),
        ))
    }

    pub fn unload() -> Result<()> {
        Ok(())
    }

    pub async fn stream<F>(
        _args: ChatArgs,
        _flag: SessionFlag,
        _on_token: F,
    ) -> Result<GenStats>
    where
        F: FnMut(String) + Send + 'static,
    {
        Err(Error::Internal(
            "mobile runtime not yet bridged — polish machine work".into(),
        ))
    }
}
