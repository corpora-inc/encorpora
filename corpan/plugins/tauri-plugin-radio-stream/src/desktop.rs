#![allow(unexpected_cfgs)]

//! Desktop fallback for `tauri-plugin-radio-stream`.
//!
//! macOS native AVPlayer support is on the roadmap, but for the 0.11.8 cut
//! desktop is a no-op: the pack's WebView fallback (HTMLAudioElement +
//! hls.js) drives `npm run dev` design iteration, and the radio app ships
//! to iOS + Android.

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{PlayArgs, RegisterListenerArgs, RemoveListenerArgs, SetVolumeArgs};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<RadioStream<R>> {
    Ok(RadioStream(app.clone()))
}

/// Access to the radio-stream APIs (desktop). No-op until macOS lands.
pub struct RadioStream<R: Runtime>(AppHandle<R>);

impl<R: Runtime> RadioStream<R> {
    pub fn play(&self, _args: PlayArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn pause(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn resume(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn stop(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn set_volume(&self, _args: SetVolumeArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn register_listener(&self, _args: RegisterListenerArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn remove_listener(&self, _args: RemoveListenerArgs) -> crate::Result<()> {
        Ok(())
    }
}
