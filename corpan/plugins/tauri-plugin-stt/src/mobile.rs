use crate::models::{
    CancelSessionArgs, PrepareArgs, PrepareResult, StartSessionArgs, StartSessionResult,
    StatusResult, StopSessionArgs, TranscriptionResult,
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
    #[cfg(target_os = "ios")]
    {
        let handle = api.register_ios_plugin(init_plugin_stt)?;
        return Ok(Stt { handle: Some(handle) });
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = api;
        Ok(Stt { handle: None })
    }
}

pub struct Stt<R: Runtime> {
    handle: Option<PluginHandle<R>>,
}

#[cfg(target_os = "ios")]
fn unsupported_msg() -> &'static str {
    "STT not available on this build"
}

#[cfg(not(target_os = "ios"))]
fn unsupported_msg() -> &'static str {
    "STT only available on iOS"
}

impl<R: Runtime> Stt<R> {
    pub fn prepare(&self, model: Option<String>) -> crate::Result<PrepareResult> {
        let Some(handle) = &self.handle else {
            return Ok(PrepareResult {
                ready: false,
                model: model.unwrap_or_default(),
                message: Some(unsupported_msg().to_string()),
            });
        };
        let args = PrepareArgs { model };
        handle
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
    ) -> crate::Result<StartSessionResult> {
        let Some(handle) = &self.handle else {
            return Ok(StartSessionResult {
                started: false,
                session_id,
            });
        };
        let args = StartSessionArgs {
            session_id,
            language,
            expected_text,
        };
        handle
            .run_mobile_plugin::<StartSessionResult>("startSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] start_session error: {:?}", e);
                e.into()
            })
    }

    pub fn stop_session(&self, session_id: String) -> crate::Result<TranscriptionResult> {
        let Some(handle) = &self.handle else {
            return Ok(TranscriptionResult {
                session_id,
                ..Default::default()
            });
        };
        let args = StopSessionArgs { session_id };
        handle
            .run_mobile_plugin::<TranscriptionResult>("stopSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] stop_session error: {:?}", e);
                e.into()
            })
    }

    pub fn cancel_session(&self, session_id: String) -> crate::Result<()> {
        let Some(handle) = &self.handle else {
            let _ = session_id;
            return Ok(());
        };
        let args = CancelSessionArgs { session_id };
        handle
            .run_mobile_plugin::<()>("cancelSession", Some(args))
            .map_err(|e| {
                println!("[MOBILE_STT] cancel_session error: {:?}", e);
                e.into()
            })
    }

    pub fn is_available(&self) -> crate::Result<bool> {
        let Some(handle) = &self.handle else {
            return Ok(false);
        };
        handle
            .run_mobile_plugin::<bool>("isAvailable", Some(()))
            .map_err(|e| {
                println!("[MOBILE_STT] is_available error: {:?}", e);
                e.into()
            })
    }

    pub fn get_status(&self) -> crate::Result<StatusResult> {
        let Some(handle) = &self.handle else {
            return Ok(StatusResult {
                available: false,
                prepared: false,
                model: None,
                recording: false,
                message: Some(unsupported_msg().to_string()),
            });
        };
        handle
            .run_mobile_plugin::<StatusResult>("getStatus", Some(()))
            .map_err(|e| {
                println!("[MOBILE_STT] get_status error: {:?}", e);
                e.into()
            })
    }
}
