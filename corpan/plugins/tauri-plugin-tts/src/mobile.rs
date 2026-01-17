// src/mobile.rs
use crate::models::{SpeakArgs, TtsEngineStatus, VoiceInfo};
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

// For flexible decoding of iOS `{ voices:[...] }` or Android `[...]`
use serde_json;
use std::io;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_tts);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Tts<R>> {
    #[cfg(target_os = "android")]
    let handle =
        api.register_android_plugin("space.httpjames.tauri_plugin_tts", "ExamplePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_tts)?;
    Ok(Tts(handle))
}

/// Access to the TTS APIs on mobile (Android/iOS).
pub struct Tts<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Tts<R> {
    /// New entry point: speak with an optional explicit `voice_id`.
    /// The native mobile plugins should accept `voice_id` and pick that exact system voice
    /// (Android: Voice.getName(), iOS: AVSpeechSynthesisVoice.identifier).
    pub fn speak(
        &self,
        text: String,
        language: Option<String>,
        rate: Option<f32>,
        voice_id: Option<String>,
    ) -> crate::Result<()> {
        let args = SpeakArgs {
            text,
            language,
            rate,
            voice_id,
        };
        self.0
            .run_mobile_plugin::<()>("speak", Some(args))
            .map_err(|e| {
                println!("[MOBILE_TTS] speak error: {:?}", e);
                e.into()
            })
    }

    pub fn stop(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("stop", Some(()))
            .map_err(|e| {
                println!("[MOBILE_TTS] stop error: {:?}", e);
                e.into()
            })
    }

    /// Open the closest-possible system UI for managing/downloading TTS voices.
    /// - Android: opens Text-to-Speech settings.
    /// - iOS: opens the app's Settings page (user navigates to Accessibility ▸ Spoken Content).
    pub fn open_tts_settings(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("openTtsSettings", Some(()))
            .map_err(|e| {
                println!("[MOBILE_TTS] open_tts_settings error: {:?}", e);
                e.into()
            })
    }

    /// Best-effort programmatic voice install (Android only).
    /// Returns `true` if a request was issued to the engine, `false` otherwise.
    pub fn install_tts_data_if_supported(&self) -> crate::Result<bool> {
        self.0
            .run_mobile_plugin::<bool>("installTtsDataIfSupported", Some(()))
            .map_err(|e| {
                println!("[MOBILE_TTS] install_tts_data_if_supported error: {:?}", e);
                e.into()
            })
    }

    /// Enumerate installed/available voices with cross-platform metadata.
    /// Accept both shapes:
    ///   - Android: `[ VoiceInfo, ... ]`
    ///   - iOS:     `{ "voices": [ VoiceInfo, ... ] }`
    pub fn list_voices(&self) -> crate::Result<Vec<VoiceInfo>> {
        let val = self
            .0
            .run_mobile_plugin::<serde_json::Value>("listVoices", Some(()))?;

        let arr = if let Some(v) = val.get("voices") {
            v
        } else {
            &val
        };

        let voices: Vec<VoiceInfo> = serde_json::from_value(arr.clone()).map_err(|e| {
            // Map to the plugin's error type via std::io::Error (which we can convert)
            let io_err = io::Error::new(io::ErrorKind::Other, format!("decode voices: {e}"));
            crate::Error::from(io_err)
        })?;

        Ok(voices)
    }

    /// Android engine inventory + status. Returns supported=false on non-Android mobile.
    pub fn get_tts_engine_status(&self) -> crate::Result<TtsEngineStatus> {
        #[cfg(target_os = "android")]
        {
            self.0
                .run_mobile_plugin::<TtsEngineStatus>("getTtsEngineStatus", Some(()))
                .map_err(|e| {
                    println!("[MOBILE_TTS] get_tts_engine_status error: {:?}", e);
                    e.into()
                })
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok(TtsEngineStatus {
                supported: false,
                default_engine: None,
                engines: Vec::new(),
                google_installed: false,
                google_default: false,
            })
        }
    }

    /// Open a store listing for a given engine package (Android only).
    pub fn open_tts_engine_store(&self, package_name: String) -> crate::Result<bool> {
        #[cfg(target_os = "android")]
        {
            #[derive(serde::Serialize)]
            #[serde(rename_all = "camelCase")]
            struct Args {
                package_name: String,
            }

            let args = Args { package_name };
            self.0
                .run_mobile_plugin::<bool>("openTtsEngineStore", Some(args))
                .map_err(|e| {
                    println!("[MOBILE_TTS] open_tts_engine_store error: {:?}", e);
                    e.into()
                })
        }
        #[cfg(not(target_os = "android"))]
        {
            Ok(false)
        }
    }
}
