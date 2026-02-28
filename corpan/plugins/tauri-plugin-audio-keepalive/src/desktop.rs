#![allow(unexpected_cfgs)]

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{NowPlayingArgs, StartKeepAliveArgs};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<AudioKeepAlive<R>> {
    Ok(AudioKeepAlive(app.clone()))
}

/// Access to the audio keepalive APIs (desktop).
/// On desktop, background audio already works — this is a no-op.
pub struct AudioKeepAlive<R: Runtime>(AppHandle<R>);

impl<R: Runtime> AudioKeepAlive<R> {
    pub fn start(&self, _args: StartKeepAliveArgs) -> crate::Result<()> {
        // Desktop doesn't need keepalive — OS doesn't suspend background audio
        Ok(())
    }

    pub fn stop(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn update_now_playing(&self, _args: NowPlayingArgs) -> crate::Result<()> {
        Ok(())
    }
}
