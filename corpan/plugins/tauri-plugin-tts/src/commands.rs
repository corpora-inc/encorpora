use crate::{
    models::{
        BindEngineResult, InstallVoiceDataResult, RecoverResult, SpeakArgs, SpeakConcurrentArgs,
        SpeakResult, TtsEngineStatus, TtsHealthProbe, VoiceInfo,
    },
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
        .speak(args.text, args.language, args.rate, args.voice_id)?;
    Ok(())
}

/// Speak text concurrently using native TTS synthesizer pool.
/// Does not debounce - allows rapid sequential and truly simultaneous playback.
/// Returns an utterance_id for tracking completion via tts://status events.
///
/// Frontend must call:
///   invoke("plugin:tts|speak_concurrent", { args: { text, language?, rate?, voice_id? } })
#[command]
pub(crate) async fn speak_concurrent<R: Runtime>(
    app: AppHandle<R>,
    args: SpeakConcurrentArgs,
) -> Result<SpeakResult> {
    println!(
        "[NATIVE_TTS:DEBUG] speak_concurrent invoked: text='{}', lang={:?}, rate={:?}, voice_id={:?}",
        args.text.chars().take(50).collect::<String>(),
        args.language,
        args.rate,
        args.voice_id,
    );

    app.tts().speak_concurrent(
        args.text,
        args.language,
        args.rate,
        args.voice_id,
    )
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

/// Comprehensive engine + voice + state probe used by onboarding rescue UX.
#[command]
pub(crate) async fn probe_tts_health<R: Runtime>(app: AppHandle<R>) -> Result<TtsHealthProbe> {
    println!("[NATIVE_TTS:DEBUG] probe_tts_health invoked");
    app.tts().probe_tts_health()
}

/// Try to bind to a working engine — Google TTS first, then any usable alternative.
#[command]
pub(crate) async fn try_auto_recover<R: Runtime>(app: AppHandle<R>) -> Result<RecoverResult> {
    println!("[NATIVE_TTS:DEBUG] try_auto_recover invoked");
    app.tts().try_auto_recover()
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BindEngineCmdArgs {
    package_name: String,
}

/// Bind to a specific engine package (Android only).
#[command]
pub(crate) async fn bind_engine<R: Runtime>(
    app: AppHandle<R>,
    args: BindEngineCmdArgs,
) -> Result<BindEngineResult> {
    println!(
        "[NATIVE_TTS:DEBUG] bind_engine invoked: package={}",
        args.package_name
    );
    app.tts().bind_engine(args.package_name)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenAppDetailsArgs {
    package_name: String,
}

/// Deep-link to the system "App info" page for a package.
#[command]
pub(crate) async fn open_app_details<R: Runtime>(
    app: AppHandle<R>,
    args: OpenAppDetailsArgs,
) -> Result<bool> {
    println!(
        "[NATIVE_TTS:DEBUG] open_app_details invoked: package={}",
        args.package_name
    );
    app.tts().open_app_details(args.package_name)
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstallVoiceDataCmdArgs {
    language: String,
}

/// Per-language voice data installation request (Android only).
#[command]
pub(crate) async fn install_voice_data_for_language<R: Runtime>(
    app: AppHandle<R>,
    args: InstallVoiceDataCmdArgs,
) -> Result<InstallVoiceDataResult> {
    println!(
        "[NATIVE_TTS:DEBUG] install_voice_data_for_language invoked: language={}",
        args.language
    );
    app.tts().install_voice_data_for_language(args.language)
}
