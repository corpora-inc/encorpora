//! Tauri command surface. Names + payloads match the FROZEN contract
//! (`corpan_asr_contract::commands`). Each command delegates to the
//! platform impl (`AsrNative<R>`), which is the mobile bridge on iOS/Android
//! and an "unavailable" stub on desktop (native desktop STT can be added
//! later behind the same trait without touching callers).

use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::AsrNativeExt;
use crate::Result;

#[command]
pub(crate) async fn capabilities<R: Runtime>(app: AppHandle<R>) -> Result<AsrCapability> {
    app.asr_native().capabilities()
}

#[command]
pub(crate) async fn is_available<R: Runtime>(
    app: AppHandle<R>,
    args: IsAvailableArgs,
) -> Result<IsAvailableResult> {
    app.asr_native().is_available(args)
}

#[command]
pub(crate) async fn ensure<R: Runtime>(
    app: AppHandle<R>,
    args: EnsureArgs,
) -> Result<EnsureResult> {
    app.asr_native().ensure(args)
}

#[command]
pub(crate) async fn start_session<R: Runtime>(
    app: AppHandle<R>,
    args: TranscribeArgs,
) -> Result<TranscribeStartResult> {
    app.asr_native().start_session(args)
}

#[command]
pub(crate) async fn stop_session<R: Runtime>(
    app: AppHandle<R>,
    args: SessionRef,
) -> Result<TranscriptOut> {
    app.asr_native().stop_session(args)
}

#[command]
pub(crate) async fn cancel_session<R: Runtime>(
    app: AppHandle<R>,
    args: SessionRef,
) -> Result<()> {
    app.asr_native().cancel_session(args)
}
