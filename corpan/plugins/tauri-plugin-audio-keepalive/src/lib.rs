#![allow(unexpected_cfgs)]

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::AudioKeepAlive;
#[cfg(mobile)]
use mobile::AudioKeepAlive;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the audio keepalive APIs.
pub trait AudioKeepAliveExt<R: Runtime> {
    fn audio_keepalive(&self) -> &AudioKeepAlive<R>;
}

impl<R: Runtime, T: Manager<R>> crate::AudioKeepAliveExt<R> for T {
    fn audio_keepalive(&self) -> &AudioKeepAlive<R> {
        self.state::<AudioKeepAlive<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_audio_keepalive);

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("audio-keepalive")
        .invoke_handler(tauri::generate_handler![
            commands::start_audio_keepalive,
            commands::stop_audio_keepalive,
            commands::update_now_playing,
            commands::pause_audio_keepalive,
            commands::resume_audio_keepalive,
            commands::register_listener,
            commands::remove_listener,
            commands::trace_event,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let keepalive = mobile::init(app, api)?;
                app.manage(keepalive);
            }

            #[cfg(desktop)]
            {
                let keepalive = desktop::init(app, api)?;
                app.manage(keepalive);
            }

            Ok(())
        })
        .build()
}
