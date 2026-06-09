#![allow(unexpected_cfgs)]

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{
    PrepareResult, ScoringParams, StartSessionResult, StatusResult, TranscriptionResult,
    WhisperParams,
};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Stt<R>> {
    Ok(Stt(app.clone()))
}

pub struct Stt<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Stt<R> {
    pub fn prepare(&self, model: Option<String>) -> crate::Result<PrepareResult> {
        let _ = model;
        Ok(PrepareResult {
            ready: false,
            model: String::new(),
            message: Some("STT not supported on desktop in this build".to_string()),
            code: Some("UNKNOWN".to_string()),
        })
    }

    pub fn start_session(
        &self,
        session_id: String,
        _language: String,
        _expected_text: String,
        _whisper_params: Option<WhisperParams>,
        _scoring_params: Option<ScoringParams>,
    ) -> crate::Result<StartSessionResult> {
        Ok(StartSessionResult {
            started: false,
            session_id,
        })
    }

    pub fn stop_session(&self, session_id: String) -> crate::Result<TranscriptionResult> {
        Ok(TranscriptionResult {
            session_id,
            ..Default::default()
        })
    }

    pub fn cancel_session(&self, _session_id: String) -> crate::Result<()> {
        Ok(())
    }

    pub fn is_available(&self) -> crate::Result<bool> {
        Ok(false)
    }

    pub fn get_status(&self) -> crate::Result<StatusResult> {
        Ok(StatusResult {
            available: false,
            prepared: false,
            model: None,
            recording: false,
            message: Some("STT not supported on desktop in this build".to_string()),
            available_memory_mb: None,
            physical_memory_mb: None,
            prior_init_crash: None,
        })
    }
}
