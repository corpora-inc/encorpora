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
use desktop::Admob;
#[cfg(mobile)]
use mobile::Admob;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the AdMob APIs.
pub trait AdmobExt<R: Runtime> {
    fn admob(&self) -> &Admob<R>;
}

impl<R: Runtime, T: Manager<R>> crate::AdmobExt<R> for T {
    fn admob(&self) -> &Admob<R> {
        self.state::<Admob<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_admob);

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("admob")
        .invoke_handler(tauri::generate_handler![
            commands::init_admob,
            commands::load_interstitial,
            commands::show_interstitial,
            commands::load_rewarded,
            commands::show_rewarded,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let admob = mobile::init(app, api)?;
                app.manage(admob);
            }

            #[cfg(desktop)]
            {
                let admob = desktop::init(app, api)?;
                app.manage(admob);
            }

            Ok(())
        })
        .build()
}
