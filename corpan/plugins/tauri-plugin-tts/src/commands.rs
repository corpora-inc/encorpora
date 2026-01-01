use crate::{
    models::{SpeakArgs, VoiceInfo},
    Result, TtsExt,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Runtime};

/// Speak text using native TTS.
/// Accepts a single `SpeakArgs` payload so (de)serialization is stable across platforms.
///
/// Frontend must call:
///   invoke("plugin:tts|speak", { args: { text, language?, rate?, voice_id? } })
#[command]
pub(crate) async fn speak<R: Runtime>(app: AppHandle<R>, args: SpeakArgs) -> Result<()> {
    // Debounce state (static for plugin lifetime)
    static mut LAST_SPEAK_TIME: u128 = 0;
    const DEBOUNCE_MS: u128 = 500; // 500ms debounce window

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    println!(
        "[NATIVE_TTS:DEBUG] speak invoked: text='{}', lang={:?}, rate={:?}, voice_id={:?}, time_since_last={}ms",
        args.text.chars().take(50).collect::<String>(),
        args.language,
        args.rate,
        args.voice_id,
        now.saturating_sub(unsafe { LAST_SPEAK_TIME })
    );

    // Debounce bursty calls
    if unsafe { now.saturating_sub(LAST_SPEAK_TIME) < DEBOUNCE_MS } {
        println!("[NATIVE_TTS:DEBUG] speak debounced: too soon after last call");
        return Ok(());
    }
    unsafe { LAST_SPEAK_TIME = now };

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
