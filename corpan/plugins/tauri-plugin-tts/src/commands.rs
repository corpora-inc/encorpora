use crate::{
    models::{SpeakArgs, TtsEngineStatus, VoiceInfo},
    Result, TtsExt,
};
use tauri::{command, AppHandle, Runtime};

/// Speak text using native TTS.
/// Accepts a single `SpeakArgs` payload so (de)serialization is stable across platforms.
///
/// Frontend must call:
///   invoke("plugin:tts|speak", { args: { text, language?, rate?, voice_id? } })
#[command]
pub(crate) async fn speak<R: Runtime>(app: AppHandle<R>, args: SpeakArgs) -> Result<()> {
    println!(
        "[NATIVE_TTS:DEBUG] speak invoked: text='{}', lang={:?}, rate={:?}, voice_id={:?}",
        args.text.chars().take(50).collect::<String>(),
        args.language,
        args.rate,
        args.voice_id
    );

    // Single, unified backend entry point: pass optional voice_id through.
    app.tts()
        .speak(args.text, args.language, args.rate, args.voice_id)?; // <- propagate errors
    Ok(())
}

#[command]
pub(crate) async fn stop<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[NATIVE_TTS:DEBUG] stop invoked");
    app.tts().stop()
}

/// Open the closest-possible system UI for managing/downloading TTS voices.
#[command]
pub(crate) async fn open_tts_settings<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[NATIVE_TTS:DEBUG] open_tts_settings invoked");
    app.tts().open_tts_settings()
}

/// Best-effort programmatic voice install (Android only).
/// - Returns `true` if a request was issued to the system/engine.
/// - Returns `false` on platforms that don't support programmatic install or if no activity could be started.
#[command]
pub(crate) async fn install_tts_data_if_supported<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    println!("[NATIVE_TTS:DEBUG] install_tts_data_if_supported invoked");
    app.tts().install_tts_data_if_supported()
}

/// Android engine inventory/status (supported=false on non-Android).
#[command]
pub(crate) async fn get_tts_engine_status<R: Runtime>(app: AppHandle<R>) -> Result<TtsEngineStatus> {
    println!("[NATIVE_TTS:DEBUG] get_tts_engine_status invoked");
    app.tts().get_tts_engine_status()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenEngineStoreArgs {
    package_name: String,
}

/// Open a store listing for a given TTS engine package (Android only).
#[command]
pub(crate) async fn open_tts_engine_store<R: Runtime>(
    app: AppHandle<R>,
    args: OpenEngineStoreArgs,
) -> Result<bool> {
    println!(
        "[NATIVE_TTS:DEBUG] open_tts_engine_store invoked: package={}",
        args.package_name
    );
    app.tts().open_tts_engine_store(args.package_name)
}

// use tauri::{AppHandle, Runtime};
// use serde_json;
// use crate::{Result, tts::VoiceInfo}; // <-- your crate Result alias

#[tauri::command]
pub(crate) async fn list_voices<R: Runtime>(app: AppHandle<R>) -> Result<Vec<VoiceInfo>> {
    println!("[NATIVE_TTS:DEBUG] list_voices invoked");

    let r = app.tts().list_voices();

    match &r {
        Ok(list) => {
            println!("[NATIVE_TTS:DEBUG] voices.len = {}", list.len());
        }
        Err(e) => println!("[NATIVE_TTS:ERROR] list_voices failed: {:?}", e),
    }

    r
}
