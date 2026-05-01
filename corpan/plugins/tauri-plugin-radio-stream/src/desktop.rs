#![allow(unexpected_cfgs)]

//! Desktop fallback for `tauri-plugin-radio-stream`.
//!
//! macOS native AVPlayer support is on the roadmap. Until then every
//! command rejects with `Error::NotImplemented` so the pack's JS-side
//! `probeNativeRadio()` lands on the WebView player path
//! (HTMLAudioElement + hls.js) on desktop dev.

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::error::Error;
use crate::models::{PlayArgs, RegisterListenerArgs, RemoveListenerArgs, SetVolumeArgs};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<RadioStream<R>> {
    Ok(RadioStream(app.clone()))
}

/// Access to the radio-stream APIs (desktop). Every command returns
/// `NotImplemented` so the pack falls back to the WebView player.
pub struct RadioStream<R: Runtime>(AppHandle<R>);

impl<R: Runtime> RadioStream<R> {
    pub fn play(&self, _args: PlayArgs) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn pause(&self) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn resume(&self) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn stop(&self) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn set_volume(&self, _args: SetVolumeArgs) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn register_listener(&self, _args: RegisterListenerArgs) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }

    pub fn remove_listener(&self, _args: RemoveListenerArgs) -> crate::Result<()> {
        Err(Error::NotImplemented)
    }
}
