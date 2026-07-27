#![allow(unexpected_cfgs)]

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{AdResult, AdUnitArgs, InitArgs};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Admob<R>> {
    Ok(Admob(app.clone()))
}

/// Desktop stub — ads are not shown on desktop.
pub struct Admob<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Admob<R> {
    pub fn init_admob(&self, _args: InitArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn load_interstitial(&self, _args: AdUnitArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn show_interstitial(&self) -> crate::Result<AdResult> {
        Ok(AdResult {
            shown: false,
            rewarded: false,
            error: Some("Ads not available on desktop".to_string()),
        })
    }

    pub fn load_rewarded(&self, _args: AdUnitArgs) -> crate::Result<()> {
        Ok(())
    }

    pub fn show_rewarded(&self) -> crate::Result<AdResult> {
        Ok(AdResult {
            shown: false,
            rewarded: false,
            error: Some("Ads not available on desktop".to_string()),
        })
    }
}
