package com.corpora.asrnative

import android.app.Activity
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

// -----------------------------------------------------------------------------
// tauri-plugin-asr-native — Android (OS SpeechRecognizer), Phase-1 SCAFFOLD STUB.
//
// Contract-conformant command surface (capabilities / isAvailable / ensure /
// startSession / stopSession / cancelSession) matching corpan-asr-contract +
// the Swift side. The REAL android.speech.SpeechRecognizer path
// (createOnDeviceSpeechRecognizer on API 33+, EXTRA_PREFER_OFFLINE, partial
// results via RecognitionListener, RMS via onRmsChanged) is TODO and reports
// isAvailable=false until implemented + a device build is run (OWNER-OWNED —
// ASR_SUBTEAM_SPECS.md Worker B). Until then the host router treats native as
// "covers nothing" and falls through — NO crash, NO fake transcripts.
//
// HARD CONSTRAINTS for the real impl (documented here):
//  • OUT-OF-PROCESS (the OS recognition service) → no process-global lock.
//  • Probe SpeechRecognizer.isRecognitionAvailable(context) +, API 33+,
//    isOnDeviceRecognitionAvailable; the <queries> in AndroidManifest is
//    REQUIRED for this to return true on API 30+.
//  • Permission denial → emit code "MIC_DENIED" (host MicInput launchpad).
//  • Interruption / onError → emit "INTERRUPTED"/"ENGINE", never crash.
// -----------------------------------------------------------------------------

private const val TAG = "AsrNative"

@InvokeArg
class IsAvailableArgs { lateinit var lang: String }

@InvokeArg
class EnsureArgs { lateinit var lang: String }

@InvokeArg
class TranscribeArgs {
    lateinit var sessionId: String
    lateinit var lang: String
    lateinit var mode: String
}

@InvokeArg
class SessionRef { lateinit var sessionId: String }

@TauriPlugin
class AsrNativePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun capabilities(invoke: Invoke) {
        val ret = JSObject()
        ret.put("providerId", "native")
        // TODO(real impl): probe supported on-device locales ∩ our codes.
        ret.put("languages", org.json.JSONArray())
        ret.put("onDevice", true)
        ret.put("modelSizeMB", 0)
        ret.put("residentMemoryMB", 0) // out-of-process: ~0 added app memory
        ret.put("streaming", true)
        ret.put("latencyClass", "instant")
        ret.put("needsDownload", false)
        ret.put("autoregressive", true)
        invoke.resolve(ret)
    }

    @Command
    fun isAvailable(invoke: Invoke) {
        val args = invoke.parseArgs(IsAvailableArgs::class.java)
        // TODO(real impl): SpeechRecognizer.isRecognitionAvailable(activity) +
        // (API 33+) isOnDeviceRecognitionAvailable; map args.lang → a BCP-47
        // tag and check the service reports it. Stub → unavailable (keyboard
        // floor; NOT an error).
        Log.i(TAG, "isAvailable(${args.lang}) → stub:false")
        val ret = JSObject()
        ret.put("ok", false)
        ret.put("needsDownload", false)
        invoke.resolve(ret)
    }

    @Command
    fun ensure(invoke: Invoke) {
        invoke.parseArgs(EnsureArgs::class.java)
        // TODO(real impl): trigger an on-device language-pack download where the
        // OS exposes it (Intent ACTION_GET_LANGUAGE_DETAILS / downloadModel).
        val ret = JSObject()
        ret.put("ready", false)
        ret.put("downloading", false)
        ret.put("code", "UNSUPPORTED_LANG")
        invoke.resolve(ret)
    }

    @Command
    fun startSession(invoke: Invoke) {
        val args = invoke.parseArgs(TranscribeArgs::class.java)
        // TODO(real impl):
        //  1. RECORD_AUDIO permission check; denial → trigger("asr://error",
        //     {sessionId, code:"MIC_DENIED"}).
        //  2. SpeechRecognizer.createOnDeviceSpeechRecognizer(activity) (API 33+)
        //     else createSpeechRecognizer; RecognizerIntent with
        //     EXTRA_PREFER_OFFLINE + EXTRA_LANGUAGE = locale, EXTRA_PARTIAL_RESULTS.
        //  3. RecognitionListener.onPartialResults → trigger("asr://partial",…);
        //     onRmsChanged → trigger("asr://level",…);
        //     onError(ERROR_*) → trigger("asr://error", code mapped).
        Log.i(TAG, "startSession(${args.sessionId}, ${args.lang}) → stub: unavailable")
        invoke.reject("native STT not implemented (stub); router should not call this when isAvailable=false")
    }

    @Command
    fun stopSession(invoke: Invoke) {
        val args = invoke.parseArgs(SessionRef::class.java)
        // TODO(real impl): stopListening + resolve the final transcript.
        val ret = JSObject()
        ret.put("sessionId", args.sessionId)
        ret.put("text", "")
        ret.put("confidence", 0.0)
        ret.put("language", "")
        invoke.resolve(ret)
    }

    @Command
    fun cancelSession(invoke: Invoke) {
        // TODO(real impl): recognizer.cancel() + destroy(); release the mic.
        invoke.resolve()
    }
}
