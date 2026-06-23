#![allow(unexpected_cfgs)]

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::ImpactArgs;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Haptics<R>> {
    Ok(Haptics(app.clone()))
}

/// Access to the haptics APIs (desktop).
/// Desktop has no haptic hardware — this is a clean no-op.
pub struct Haptics<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Haptics<R> {
    pub fn impact(&self, _args: ImpactArgs) -> crate::Result<()> {
        // No haptic hardware on desktop — fire-and-forget no-op.
        Ok(())
    }
}
