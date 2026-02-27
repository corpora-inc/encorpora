package com.corpora.audio_keepalive

import android.app.Activity
import android.content.Intent
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
internal class StartKeepAliveArgs {
    var title: String? = null
    var artist: String? = null
    var bookTitle: String? = null
}

@InvokeArg
internal class NowPlayingArgs {
    var title: String? = null
    var artist: String? = null
    var positionMs: Double? = null
    var durationMs: Double? = null
}

@TauriPlugin
class AudioKeepAlivePlugin(private val activity: Activity) : Plugin(activity) {

    private var isActive = false

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
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(serviceIntent)
            } else {
                activity.startService(serviceIntent)
            }

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
            isActive = false
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to stop keepalive service: ${e.message}")
        }
    }

    @Command
    fun updateNowPlaying(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(NowPlayingArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        try {
            // Send update to the running service
            val updateIntent = Intent(activity, AudioKeepAliveService::class.java).apply {
                action = "UPDATE_NOW_PLAYING"
                putExtra("title", args.title)
                putExtra("artist", args.artist)
                args.positionMs?.let { putExtra("positionMs", it) }
                args.durationMs?.let { putExtra("durationMs", it) }
            }
            activity.startService(updateIntent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Failed to update now playing: ${e.message}")
        }
    }
}
