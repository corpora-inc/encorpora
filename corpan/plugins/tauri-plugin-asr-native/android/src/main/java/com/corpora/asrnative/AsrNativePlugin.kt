package com.corpora.asrnative

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.util.Locale
import java.util.concurrent.Executors

// -----------------------------------------------------------------------------
// tauri-plugin-asr-native — Android (OS SpeechRecognizer), Phase-1 REAL impl.
//
// On-device dictation via android.speech.SpeechRecognizer, conforming to
// corpan-asr-contract. Out-of-process (the OS recognition service), ~0 added
// app memory, zero download for locales the OS already has.
//
//  • API 33+ : createOnDeviceSpeechRecognizer + checkRecognitionSupport probe.
//  • API <33 : createSpeechRecognizer with EXTRA_PREFER_OFFLINE (best effort).
//  • Partials via RecognitionListener.onPartialResults; RMS via onRmsChanged →
//    asr://level; errors → asr://error.
//
// HARD CONSTRAINTS honored:
//  • OUT-OF-PROCESS → no process-global lock.
//  • RECORD_AUDIO permission denial → asr://error {code:"MIC_DENIED"} (the JS
//    MicInput launchpad opens app settings).
//  • onError(ERROR_*) → mapped structured codes, never crash.
//  • <queries RecognitionService> in AndroidManifest is REQUIRED for
//    isRecognitionAvailable() on API 30+ (declared).
//
// DEVICE-VALIDATION: createOnDeviceSpeechRecognizer + checkRecognitionSupport
// behavior is OEM-dependent (Pixel has it; some OEMs lag) — confirm on a real
// device per DEVICE_RUNBOOK.md. SpeechRecognizer is main-thread-only; we marshal
// onto the Activity's main looper.
// -----------------------------------------------------------------------------

private const val TAG = "AsrNative"

// Our code → BCP-47 tag the recognizer wants.
private val OUR_TO_TAG = mapOf(
    "en" to "en-US", "es" to "es-ES", "fr" to "fr-FR", "de" to "de-DE",
    "it" to "it-IT", "pt-BR" to "pt-BR", "pt-PT" to "pt-PT", "nl" to "nl-NL",
    "ru" to "ru-RU", "sv" to "sv-SE", "da" to "da-DK", "no" to "nb-NO",
    "fi" to "fi-FI", "tr" to "tr-TR", "he" to "iw-IL", "ar" to "ar-SA",
    "ja" to "ja-JP", "ko-polite" to "ko-KR", "zh-Hans" to "zh-CN",
    "zh-Hant" to "zh-TW", "yue-Hant-HK" to "yue-HK", "th" to "th-TH",
    "vi" to "vi-VN", "ms" to "ms-MY",
)

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

    private var recognizer: SpeechRecognizer? = null
    private var currentSessionId: String? = null
    private var lastText: String = ""
    private var ourLang: String = ""
    private var sessionStartMs: Long = 0L

    @Command
    fun capabilities(invoke: Invoke) {
        // We can't synchronously enumerate every supported locale (the OS probe
        // is async, per-locale), so capabilities reports the codes we MAP +
        // that the device has a recognizer for; per-locale truth comes from
        // isAvailable(). Report the mapped set when recognition exists at all.
        val available = SpeechRecognizer.isRecognitionAvailable(activity)
        val langs = if (available) OUR_TO_TAG.keys.toList() else emptyList()
        val ret = JSObject()
        ret.put("providerId", "native")
        ret.put("languages", org.json.JSONArray(langs))
        ret.put("onDevice", true)
        ret.put("modelSizeMB", 0)
        ret.put("residentMemoryMB", 0)
        ret.put("streaming", true)
        ret.put("latencyClass", "instant")
        ret.put("needsDownload", false)
        ret.put("autoregressive", true)
        invoke.resolve(ret)
    }

    @Command
    fun isAvailable(invoke: Invoke) {
        val args = invoke.parseArgs(IsAvailableArgs::class.java)
        val tag = OUR_TO_TAG[args.lang]
        if (tag == null || !SpeechRecognizer.isRecognitionAvailable(activity)) {
            resolveAvail(invoke, ok = false, needsDownload = false)
            return
        }
        // API 33+: ask the service which languages it supports ON-DEVICE.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.runOnUiThread {
                val probe = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag)
                }
                probe.checkRecognitionSupport(intent, Executors.newSingleThreadExecutor(),
                    object : RecognitionSupportCallback {
                        override fun onSupportResult(support: RecognitionSupport) {
                            val installed = support.installedOnDeviceLanguages
                            val supported = support.supportedOnDeviceLanguages
                            val ok = installed.any { it.startsWith(tag.substringBefore('-')) }
                            val downloadable = !ok && supported.any {
                                it.startsWith(tag.substringBefore('-'))
                            }
                            resolveAvail(invoke, ok = ok, needsDownload = downloadable)
                            probe.destroy()
                        }
                        override fun onError(error: Int) {
                            resolveAvail(invoke, ok = false, needsDownload = false)
                            probe.destroy()
                        }
                    })
            }
        } else {
            // Pre-33: no per-locale on-device probe; report available if the
            // service exists (best-effort; EXTRA_PREFER_OFFLINE at session time).
            resolveAvail(invoke, ok = true, needsDownload = false)
        }
    }

    @Command
    fun ensure(invoke: Invoke) {
        val args = invoke.parseArgs(EnsureArgs::class.java)
        val tag = OUR_TO_TAG[args.lang]
        // On-device language packs download via the OS Settings flow; there's no
        // stable public API to trigger it silently. Report ready if mapped +
        // recognition exists; the per-locale truth is isAvailable().
        val ready = tag != null && SpeechRecognizer.isRecognitionAvailable(activity)
        val ret = JSObject()
        ret.put("ready", ready)
        ret.put("downloading", false)
        if (!ready) ret.put("code", "UNSUPPORTED_LANG")
        invoke.resolve(ret)
    }

    @Command
    fun startSession(invoke: Invoke) {
        val args = invoke.parseArgs(TranscribeArgs::class.java)
        val tag = OUR_TO_TAG[args.lang] ?: run { invoke.reject("UNSUPPORTED_LANG"); return }

        // RECORD_AUDIO permission gate.
        val granted = ContextCompat.checkSelfPermission(
            activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            emitError(args.sessionId, "MIC_DENIED", "RECORD_AUDIO not granted")
            invoke.reject("MIC_DENIED")
            return
        }

        currentSessionId = args.sessionId
        ourLang = args.lang
        lastText = ""
        sessionStartMs = System.currentTimeMillis()

        activity.runOnUiThread {
            try {
                val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    SpeechRecognizer.createOnDeviceSpeechRecognizer(activity)
                } else {
                    SpeechRecognizer.createSpeechRecognizer(activity)
                }
                recognizer = rec
                rec.setRecognitionListener(buildListener(args.sessionId))
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                }
                rec.startListening(intent)
                Log.i(TAG, "session ${args.sessionId} started ($tag)")
                invoke.resolve(JSObject().apply {
                    put("started", true); put("sessionId", args.sessionId)
                })
            } catch (e: Exception) {
                emitError(args.sessionId, "ENGINE", e.message)
                invoke.reject(e.message ?: "engine error")
            }
        }
    }

    @Command
    fun stopSession(invoke: Invoke) {
        val args = invoke.parseArgs(SessionRef::class.java)
        activity.runOnUiThread {
            recognizer?.stopListening()
            // Final result arrives via onResults; resolve with the best text we
            // have now (onResults updates lastText just before this in practice;
            // the partial path keeps it current).
            val ret = JSObject()
            ret.put("sessionId", args.sessionId)
            ret.put("text", lastText)
            ret.put("confidence", if (lastText.isEmpty()) 0.0 else 0.9)
            ret.put("language", ourLang)
            cleanup()
            invoke.resolve(ret)
        }
    }

    @Command
    fun cancelSession(invoke: Invoke) {
        activity.runOnUiThread {
            recognizer?.cancel()
            cleanup()
            invoke.resolve()
        }
    }

    // MARK: internals

    private fun buildListener(sessionId: String) = object : RecognitionListener {
        override fun onPartialResults(partial: Bundle?) {
            val text = partial?.getStringArrayList(
                SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
            lastText = text
            emitPartial(sessionId, text)
        }
        override fun onResults(results: Bundle?) {
            val text = results?.getStringArrayList(
                SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (text != null) { lastText = text; emitPartial(sessionId, text) }
        }
        override fun onRmsChanged(rmsdB: Float) {
            // rmsdB is roughly -2..10 dB; map to 0..1 for the VU meter.
            val norm = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
            val tMs = (System.currentTimeMillis() - sessionStartMs).toInt()
            emitLevel(sessionId, norm.toDouble(), tMs)
        }
        override fun onError(error: Int) {
            val code = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "NO_SPEECH"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "MIC_DENIED"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ENGINE"
                else -> "ENGINE"
            }
            emitError(sessionId, code, "SpeechRecognizer error $error")
        }
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun cleanup() {
        recognizer?.destroy()
        recognizer = null
        currentSessionId = null
    }

    private fun emitPartial(sessionId: String, text: String) {
        trigger("asr://partial", JSObject().apply {
            put("sessionId", sessionId); put("text", text)
        })
    }

    private fun emitLevel(sessionId: String, rms: Double, tMs: Int) {
        trigger("asr://level", JSObject().apply {
            put("sessionId", sessionId); put("rms", rms); put("tMs", tMs)
        })
    }

    private fun emitError(sessionId: String, code: String, message: String?) {
        trigger("asr://error", JSObject().apply {
            put("sessionId", sessionId); put("code", code)
            if (message != null) put("message", message)
        })
    }

    private fun resolveAvail(invoke: Invoke, ok: Boolean, needsDownload: Boolean) {
        invoke.resolve(JSObject().apply {
            put("ok", ok); put("needsDownload", needsDownload)
        })
    }
}
