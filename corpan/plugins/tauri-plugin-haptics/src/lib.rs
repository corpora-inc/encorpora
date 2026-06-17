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
use desktop::Haptics;
#[cfg(mobile)]
use mobile::Haptics;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the haptics APIs.
pub trait HapticsExt<R: Runtime> {
    fn haptics(&self) -> &Haptics<R>;
}

impl<R: Runtime, T: Manager<R>> crate::HapticsExt<R> for T {
    fn haptics(&self) -> &Haptics<R> {
        self.state::<Haptics<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_haptics);

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("haptics")
        .invoke_handler(tauri::generate_handler![commands::impact])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let haptics = mobile::init(app, api)?;
                app.manage(haptics);
            }

            #[cfg(desktop)]
            {
                let haptics = desktop::init(app, api)?;
                app.manage(haptics);
            }

            Ok(())
        })
        .build()
}
