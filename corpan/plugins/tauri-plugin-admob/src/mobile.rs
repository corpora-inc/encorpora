use crate::models::{AdResult, AdUnitArgs, BannerArgs, BannerResult, InitArgs};
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_admob);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Admob<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.corpora.admob", "AdmobPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_admob)?;
    Ok(Admob(handle))
}

/// Access to the AdMob APIs on mobile (Android/iOS).
pub struct Admob<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Admob<R> {
    pub fn init_admob(&self, args: InitArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("initAdmob", Some(args))
            .map_err(|e| {
                println!("[ADMOB] init error: {:?}", e);
                e.into()
            })
    }

    pub fn load_interstitial(&self, args: AdUnitArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("loadInterstitial", Some(args))
            .map_err(|e| {
                println!("[ADMOB] load_interstitial error: {:?}", e);
                e.into()
            })
    }

    pub fn show_interstitial(&self) -> crate::Result<AdResult> {
        self.0
            .run_mobile_plugin::<AdResult>("showInterstitial", Some(()))
            .map_err(|e| {
                println!("[ADMOB] show_interstitial error: {:?}", e);
                e.into()
            })
    }

    pub fn load_rewarded(&self, args: AdUnitArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("loadRewarded", Some(args))
            .map_err(|e| {
                println!("[ADMOB] load_rewarded error: {:?}", e);
                e.into()
            })
    }

    pub fn show_rewarded(&self) -> crate::Result<AdResult> {
        self.0
            .run_mobile_plugin::<AdResult>("showRewarded", Some(()))
            .map_err(|e| {
                println!("[ADMOB] show_rewarded error: {:?}", e);
                e.into()
            })
    }

    pub fn show_banner(&self, args: BannerArgs) -> crate::Result<BannerResult> {
        self.0
            .run_mobile_plugin::<BannerResult>("showBanner", Some(args))
            .map_err(|e| {
                println!("[ADMOB] show_banner error: {:?}", e);
                e.into()
            })
    }

    pub fn hide_banner(&self) -> crate::Result<BannerResult> {
        self.0
            .run_mobile_plugin::<BannerResult>("hideBanner", Some(()))
            .map_err(|e| {
                println!("[ADMOB] hide_banner error: {:?}", e);
                e.into()
            })
    }
}
