use crate::models::{PlayArgs, RegisterListenerArgs, RemoveListenerArgs, SetVolumeArgs};
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_radio_stream);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<RadioStream<R>> {
    #[cfg(target_os = "android")]
    let handle =
        api.register_android_plugin("com.corpora.radio_stream", "RadioStreamPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_radio_stream)?;
    Ok(RadioStream(handle))
}

/// Mobile-side handle for the native radio player.
pub struct RadioStream<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> RadioStream<R> {
    pub fn play(&self, args: PlayArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("play", Some(args))
            .map_err(|e| {
                println!("[RADIO_STREAM] play error: {:?}", e);
                e.into()
            })
    }

    pub fn pause(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("pause", Some(()))
            .map_err(|e| {
                println!("[RADIO_STREAM] pause error: {:?}", e);
                e.into()
            })
    }

    pub fn resume(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("resume", Some(()))
            .map_err(|e| {
                println!("[RADIO_STREAM] resume error: {:?}", e);
                e.into()
            })
    }

    pub fn stop(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("stop", Some(()))
            .map_err(|e| {
                println!("[RADIO_STREAM] stop error: {:?}", e);
                e.into()
            })
    }

    pub fn set_volume(&self, args: SetVolumeArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("setVolume", Some(args))
            .map_err(|e| {
                println!("[RADIO_STREAM] set_volume error: {:?}", e);
                e.into()
            })
    }

    pub fn register_listener(&self, args: RegisterListenerArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("registerListener", Some(args))
            .map_err(|e| {
                println!("[RADIO_STREAM] register_listener error: {:?}", e);
                e.into()
            })
    }

    pub fn remove_listener(&self, args: RemoveListenerArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("removeListener", Some(args))
            .map_err(|e| {
                println!("[RADIO_STREAM] remove_listener error: {:?}", e);
                e.into()
            })
    }
}
