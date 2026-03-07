#![allow(unexpected_cfgs)]

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{NowPlayingArgs, RegisterListenerArgs, RemoveListenerArgs, StartKeepAliveArgs, TraceEventArgs};

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

    pub fn pause(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn resume(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn register_listener(&self, _args: RegisterListenerArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn remove_listener(&self, _args: RemoveListenerArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn trace_event(&self, _args: TraceEventArgs) -> crate::Result<()> {
        Ok(())
    }
}
