use crate::models::{NowPlayingArgs, StartKeepAliveArgs};
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_audio_keepalive);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<AudioKeepAlive<R>> {
    #[cfg(target_os = "android")]
    let handle =
        api.register_android_plugin("com.corpora.audio_keepalive", "AudioKeepAlivePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_audio_keepalive)?;
    Ok(AudioKeepAlive(handle))
}

/// Access to the audio keepalive APIs on mobile (Android/iOS).
pub struct AudioKeepAlive<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> AudioKeepAlive<R> {
    pub fn start(&self, args: StartKeepAliveArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("startAudioKeepalive", Some(args))
            .map_err(|e| {
                println!("[AUDIO_KEEPALIVE] start error: {:?}", e);
                e.into()
            })
    }

    pub fn stop(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("stopAudioKeepalive", Some(()))
            .map_err(|e| {
                println!("[AUDIO_KEEPALIVE] stop error: {:?}", e);
                e.into()
            })
    }

    pub fn update_now_playing(&self, args: NowPlayingArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("updateNowPlaying", Some(args))
            .map_err(|e| {
                println!("[AUDIO_KEEPALIVE] update_now_playing error: {:?}", e);
                e.into()
            })
    }

    pub fn pause(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("pauseAudioKeepalive", Some(()))
            .map_err(|e| {
                println!("[AUDIO_KEEPALIVE] pause error: {:?}", e);
                e.into()
            })
    }

    pub fn resume(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("resumeAudioKeepalive", Some(()))
            .map_err(|e| {
                println!("[AUDIO_KEEPALIVE] resume error: {:?}", e);
                e.into()
            })
    }
}
