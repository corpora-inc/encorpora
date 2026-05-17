use crate::models::{
    CancelSessionArgs, PrepareArgs, PrepareResult, StartSessionArgs, StartSessionResult,
    StatusResult, StopSessionArgs, TranscriptionResult, WhisperParams,
};
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_stt);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Stt<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.corpora.stt", "SttPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_stt)?;
    Ok(Stt { handle })
}

pub struct Stt<R: Runtime> {
    handle: PluginHandle<R>,
}

impl<R: Runtime> Stt<R> {
    pub fn prepare(&self, model: Option<String>) -> crate::Result<PrepareResult> {
        let args = PrepareArgs { model };
        self.handle
            .run_mobile_plugin::<PrepareResult>("prepare", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] prepare error: {:?}", e);
                e.into()
            })
    }

    pub fn start_session(
        &self,
        session_id: String,
        language: String,
        expected_text: String,
        whisper_params: Option<WhisperParams>,
    ) -> crate::Result<StartSessionResult> {
        let args = StartSessionArgs {
            session_id,
            language,
            expected_text,
            whisper_params,
        };
        self.handle
            .run_mobile_plugin::<StartSessionResult>("startSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] start_session error: {:?}", e);
                e.into()
            })
    }

    pub fn stop_session(&self, session_id: String) -> crate::Result<TranscriptionResult> {
        let args = StopSessionArgs { session_id };
        self.handle
            .run_mobile_plugin::<TranscriptionResult>("stopSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] stop_session error: {:?}", e);
                e.into()
            })
    }

    pub fn cancel_session(&self, session_id: String) -> crate::Result<()> {
        let args = CancelSessionArgs { session_id };
        self.handle
            .run_mobile_plugin::<()>("cancelSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] cancel_session error: {:?}", e);
                e.into()
            })
    }

    pub fn is_available(&self) -> crate::Result<bool> {
        self.handle
            .run_mobile_plugin::<bool>("isAvailable", Some(()))
            .map_err(|e| {
                println!("[MOBILE_STT] is_available error: {:?}", e);
                e.into()
            })
    }

    pub fn get_status(&self) -> crate::Result<StatusResult> {
        self.handle
            .run_mobile_plugin::<StatusResult>("getStatus", Some(()))
            .map_err(|e| {
                println!("[MOBILE_STT] get_status error: {:?}", e);
                e.into()
            })
    }
}
