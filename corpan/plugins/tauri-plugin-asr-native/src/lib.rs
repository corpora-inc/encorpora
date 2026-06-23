//! # tauri-plugin-asr-native
//!
//! Provider-agnostic dictation over OS-native STT — Apple
//! SpeechAnalyzer/SFSpeechRecognizer (iOS) + Android SpeechRecognizer.
//! Conforms to the FROZEN `corpan-asr-contract`. Zero download, ~0 added app
//! memory, out-of-process (so NO process-global init lock is needed — the
//! `ggml_backend_sched_split_graph` lesson applies only to in-process
//! runtimes like whisper/qwen/onnx).
//!
//! See `corpan/docs/STT_MASTERPLAN.md` (Phase 1) + `ASR_SUBTEAM_SPECS.md`
//! (Worker B). STUB STATUS: Rust bridge + command surface are complete and
//! contract-conformant; the Swift/Kotlin engines are scaffolded stubs that
//! report `is_available=false` until implemented + a device build is run
//! (OWNER-OWNED — this crate ships code, not a device binary).

#![allow(unexpected_cfgs)]

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::AsrNative;
#[cfg(mobile)]
use mobile::AsrNative;

/// Extension trait so `app.asr_native()` resolves the managed state.
pub trait AsrNativeExt<R: Runtime> {
    fn asr_native(&self) -> &AsrNative<R>;
}

impl<R: Runtime, T: Manager<R>> AsrNativeExt<R> for T {
    fn asr_native(&self) -> &AsrNative<R> {
        self.state::<AsrNative<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("asr-native")
        .invoke_handler(tauri::generate_handler![
            commands::capabilities,
            commands::is_available,
            commands::ensure,
            commands::start_session,
            commands::stop_session,
            commands::cancel_session,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let provider = mobile::init(app, api)?;
            #[cfg(desktop)]
            let provider = desktop::init(app, api)?;
            app.manage(provider);
            Ok(())
        })
        .build()
}
