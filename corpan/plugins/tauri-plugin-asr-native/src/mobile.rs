//! Mobile impl — forwards each command to the native plugin (Swift on iOS,
//! Kotlin on Android) via `run_mobile_plugin`. The native side is the real
//! engine: Apple SpeechAnalyzer/SFSpeechRecognizer + Android SpeechRecognizer,
//! out-of-process, ~0 added app memory.
//!
//! STUB STATUS: the Rust bridge + command shapes are complete and
//! contract-conformant; the Swift/Kotlin engines are scaffolded stubs (see
//! ios/Sources + android/src) that return `is_available=false` until their
//! real implementations land + a device build is run (OWNER-OWNED). So today
//! the host router treats native as "covers nothing yet" and falls through —
//! exactly the desktop behavior — with NO crash and NO fake transcripts.

use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;
use crate::Result;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.corpora.asrnative";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_asr_native);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<AsrNative<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AsrNativePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_asr_native)?;
    Ok(AsrNative(handle))
}

/// Access to the asr-native APIs (mobile bridge to Swift/Kotlin).
pub struct AsrNative<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> AsrNative<R> {
    pub fn capabilities(&self) -> Result<AsrCapability> {
        Ok(self.0.run_mobile_plugin("capabilities", ())?)
    }

    pub fn is_available(&self, args: IsAvailableArgs) -> Result<IsAvailableResult> {
        Ok(self.0.run_mobile_plugin("isAvailable", args)?)
    }

    pub fn ensure(&self, args: EnsureArgs) -> Result<EnsureResult> {
        Ok(self.0.run_mobile_plugin("ensure", args)?)
    }

    pub fn start_session(&self, args: TranscribeArgs) -> Result<TranscribeStartResult> {
        Ok(self.0.run_mobile_plugin("startSession", args)?)
    }

    pub fn stop_session(&self, args: SessionRef) -> Result<TranscriptOut> {
        Ok(self.0.run_mobile_plugin("stopSession", args)?)
    }

    pub fn cancel_session(&self, args: SessionRef) -> Result<()> {
        Ok(self.0.run_mobile_plugin("cancelSession", args)?)
    }
}
