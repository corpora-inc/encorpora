use tauri::{AppHandle, Runtime};

use super::{Error, Result};

pub struct Subscriptions<R: Runtime> {
    _app: AppHandle<R>,
}

impl<R: Runtime> Subscriptions<R> {
    pub fn init(app: &AppHandle<R>) -> Result<Self> {
        Ok(Self { _app: app.clone() })
    }

    /// Desktop has no native in-app subscription sheet. Returning an error lets
    /// the TS wrapper fall back to `openUrl` to the web subscription page.
    pub fn show_manage_subscriptions(&self) -> Result<()> {
        Err(Error(
            "show_manage_subscriptions is only available on iOS/Android".into(),
        ))
    }
}
