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
use desktop::Stt;
#[cfg(mobile)]
use mobile::Stt;

pub trait SttExt<R: Runtime> {
    fn stt(&self) -> &Stt<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SttExt<R> for T {
    fn stt(&self) -> &Stt<R> {
        self.state::<Stt<R>>().inner()
    }
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_stt);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("stt")
        .invoke_handler(tauri::generate_handler![
            commands::prepare,
            commands::start_session,
            commands::stop_session,
            commands::cancel_session,
            commands::is_available,
            commands::get_status,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let stt = mobile::init(app, api)?;
                app.manage(stt);
            }
            #[cfg(desktop)]
            {
                let stt = desktop::init(app, api)?;
                app.manage(stt);
            }
            Ok(())
        })
        .build()
}
