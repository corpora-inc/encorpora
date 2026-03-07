package com.corpora.audio_keepalive

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
internal class StartKeepAliveArgs {
    var title: String? = null
    var artist: String? = null
    var bookTitle: String? = null
    var positionMs: Double? = null
    var durationMs: Double? = null
}

@InvokeArg
internal class NowPlayingArgs {
    var title: String? = null
    var artist: String? = null
    var positionMs: Double? = null
    var durationMs: Double? = null
    var bookTitle: String? = null
    var isPlaying: Boolean? = null
    var nowPlayingToken: Long? = null
}

@InvokeArg
internal class TraceEventArgs {
    var seq: Long = 0L
    var elapsedMs: Double = 0.0
    var event: String = ""
    var details: String? = null
}

@TauriPlugin
class AudioKeepAlivePlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        var onMediaCommand: ((String, JSObject) -> Unit)? = null
    }

    private var isActive = false
    private var webView: WebView? = null

    override fun load(webview: WebView) {
        webView = webview
    }

    override fun onDestroy() {
        webView = null
        onMediaCommand = null
        isActive = false
    }

    private fun dispatchDirectCommand(event: String) {
        val js = when (event) {
            "audio-keepalive:play" -> "window.__stargateNativeCmd && window.__stargateNativeCmd('play');"
            "audio-keepalive:pause" -> "window.__stargateNativeCmd && window.__stargateNativeCmd('pause');"
            "audio-keepalive:skipForward" -> "window.__stargateNativeCmd && window.__stargateNativeCmd('skipForward');"
            "audio-keepalive:skipBack" -> "window.__stargateNativeCmd && window.__stargateNativeCmd('skipBack');"
            else -> null
        } ?: return

        webView?.evaluateJavascript(js, null)
    }

    private fun dispatchEventToWeb(event: String, data: JSObject) {
        activity.runOnUiThread {
            try {
                android.util.Log.d("AudioKeepAlive", "Dispatching event to web: $event")
                dispatchDirectCommand(event)
                trigger(event, data)
            } catch (t: Throwable) {
                android.util.Log.e("AudioKeepAlive", "Failed to dispatch event $event: ${t.message}", t)
            }
        }
    }

    @Command
    fun startAudioKeepalive(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(StartKeepAliveArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        try {
            val serviceIntent = Intent(activity, AudioKeepAliveService::class.java).apply {
                putExtra("title", args.title ?: "Stargate Reader")
                putExtra("artist", args.artist ?: "Narrator")
                putExtra("bookTitle", args.bookTitle ?: "")
                args.positionMs?.let { putExtra("positionMs", it) }
                args.durationMs?.let { putExtra("durationMs", it) }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(serviceIntent)
            } else {
                activity.startService(serviceIntent)
            }

            onMediaCommand = { cmd, data -> dispatchEventToWeb(cmd, data) }
            isActive = true
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to start keepalive service: ${e.message}")
        }
    }

    @Command
    fun stopAudioKeepalive(invoke: Invoke) {
        try {
            val serviceIntent = Intent(activity, AudioKeepAliveService::class.java)
            activity.stopService(serviceIntent)
            onMediaCommand = null
            isActive = false
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to stop keepalive service: ${e.message}")
        }
    }

    @Command
    fun pauseAudioKeepalive(invoke: Invoke) {
        try {
            val serviceIntent = Intent(activity, AudioKeepAliveService::class.java).apply {
                action = "SYNC_PLAYBACK_STATE"
                putExtra("isPlaying", false)
            }
            activity.startService(serviceIntent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to pause keepalive: ${e.message}")
        }
    }

    @Command
    fun resumeAudioKeepalive(invoke: Invoke) {
        try {
            val serviceIntent = Intent(activity, AudioKeepAliveService::class.java).apply {
                action = "SYNC_PLAYBACK_STATE"
                putExtra("isPlaying", true)
            }
            activity.startService(serviceIntent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to resume keepalive: ${e.message}")
        }
    }

    @Command
    fun updateNowPlaying(invoke: Invoke) {
        if (!isActive) {
            invoke.resolve()
            return
        }
        val args = try {
            invoke.parseArgs(NowPlayingArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        try {
            val updateIntent = Intent(activity, AudioKeepAliveService::class.java).apply {
                action = "UPDATE_NOW_PLAYING"
                putExtra("title", args.title)
                putExtra("artist", args.artist)
                args.positionMs?.let { putExtra("positionMs", it) }
                args.durationMs?.let { putExtra("durationMs", it) }
                args.bookTitle?.let { putExtra("bookTitle", it) }
                args.isPlaying?.let { putExtra("isPlaying", it) }
                args.nowPlayingToken?.let { putExtra("nowPlayingToken", it) }
            }
            activity.startService(updateIntent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to update now playing: ${e.message}")
        }
    }

    @Command
    fun traceEvent(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(TraceEventArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        val base = "[AUDIO_KEEPALIVE][TRACE] seq=${args.seq} t=${String.format("%.1f", args.elapsedMs)}ms event=${args.event}"
        val message = if (args.details.isNullOrBlank()) base else "$base details=${args.details}"
        android.util.Log.d("AudioKeepAlive", message)
        invoke.resolve()
    }
}
