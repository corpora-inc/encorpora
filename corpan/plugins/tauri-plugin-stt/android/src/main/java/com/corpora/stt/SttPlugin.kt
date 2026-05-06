package com.corpora.stt

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

// Stub Android implementation of the STT plugin.
//
// The real implementation lives in `ios/Sources/STTPlugin.swift` and
// uses WhisperKit, which has no Android equivalent we ship to. This
// stub exists so the Tauri plugin's Android module produces a variant
// that the host app's Gradle build can resolve as a project
// dependency.
//
// In practice these `@Command` methods are never called at runtime
// because the pronunciation-coach pack is gated to
// `platforms: ["ios"]` in the catalog (see web/data/packs.json) and
// the host's `filterCatalogForApp` skips it on Android. If anything
// ever does call them, every command rejects with a clear message.
private const val NOT_SUPPORTED =
    "STT not supported on Android — the WhisperKit-backed pipeline is iOS-only."

@TauriPlugin
class SttPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun prepare(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun startSession(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun stopSession(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun cancelSession(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun isAvailable(invoke: Invoke) {
        // Return a clean `false` rather than rejecting — feature
        // detection is an honest no.
        val ret = JSObject()
        ret.put("available", false)
        invoke.resolve(ret)
    }

    @Command
    fun getStatus(invoke: Invoke) {
        val ret = JSObject()
        ret.put("available", false)
        ret.put("ready", false)
        invoke.resolve(ret)
    }

    @Command
    fun wipeModel(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun installModel(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun validateModel(invoke: Invoke) {
        invoke.reject(NOT_SUPPORTED)
    }

    @Command
    fun listInstalled(invoke: Invoke) {
        // Empty array — no models installed because the platform isn't
        // supported. Lets callers branch cleanly without exception
        // handling on the boot path (matching what `isAvailable`
        // returns).
        val ret = JSObject()
        ret.put("installed", JSONArray())
        invoke.resolve(ret)
    }

    @Command
    fun unload(invoke: Invoke) {
        val ret = JSObject()
        ret.put("unloaded", true)
        invoke.resolve(ret)
    }

    // registerListener / removeListener intentionally NOT defined here:
    // the Tauri `Plugin` superclass already provides them as part of
    // the generic event-channel infrastructure. Redefining them in a
    // subclass without `override` is a Kotlin compile error
    // ("hides member of supertype Plugin"). We don't have anything to
    // emit on Android anyway, so we just inherit the base behavior.
}
