//! Desktop impl. There is no cross-platform desktop native STT we ship today
//! (macOS Speech could be added later behind this same `AsrNative` API). So
//! desktop reports the provider as present-but-covers-nothing: `capabilities`
//! returns an empty language set, `is_available` is always `{ok:false}`, and
//! `start_session` errors `Unavailable`. The host router then falls through to
//! a downloadable provider or the keyboard — which is the correct behavior,
//! NOT an error condition.

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;
use crate::Result;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<AsrNative<R>> {
    Ok(AsrNative(app.clone()))
}

/// Access to the asr-native APIs (desktop = unavailable stub).
pub struct AsrNative<R: Runtime>(AppHandle<R>);

impl<R: Runtime> AsrNative<R> {
    pub fn capabilities(&self) -> Result<AsrCapability> {
        Ok(AsrCapability {
            provider_id: Some(ProviderId::Native),
            languages: vec![], // desktop: nothing native (yet)
            on_device: true,
            model_size_mb: 0,
            resident_memory_mb: 0,
            streaming: true,
            latency_class: Some(LatencyClass::Instant),
            needs_download: false,
            autoregressive: true,
        })
    }

    pub fn is_available(&self, _args: IsAvailableArgs) -> Result<IsAvailableResult> {
        Ok(IsAvailableResult { ok: false, needs_download: false })
    }

    pub fn ensure(&self, _args: EnsureArgs) -> Result<EnsureResult> {
        Ok(EnsureResult { ready: false, downloading: false, code: Some("UNSUPPORTED_LANG".into()) })
    }

    pub fn start_session(&self, _args: TranscribeArgs) -> Result<TranscribeStartResult> {
        Err(crate::Error::Unavailable("no native STT on desktop".into()))
    }

    pub fn stop_session(&self, _args: SessionRef) -> Result<TranscriptOut> {
        Err(crate::Error::Unavailable("no native STT on desktop".into()))
    }

    pub fn cancel_session(&self, _args: SessionRef) -> Result<()> {
        Ok(())
    }
}
