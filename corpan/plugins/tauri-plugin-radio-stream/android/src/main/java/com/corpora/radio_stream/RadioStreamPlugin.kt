package com.corpora.radio_stream

import android.app.Activity
import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Metadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.extractor.metadata.icy.IcyHeaders
import androidx.media3.extractor.metadata.icy.IcyInfo
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors

@InvokeArg
internal class PlayArgs {
    lateinit var url: String
    var stationName: String? = null
    var country: String? = null
    var language: String? = null
    var faviconUrl: String? = null
}

@InvokeArg
internal class SetVolumeArgs {
    var volume: Float = 1.0f
}

/**
 * Tauri 2 mobile plugin entry point for radio streaming.
 *
 * Architecture:
 *  - PlaybackService is a clean Media3 MediaSessionService — it owns one
 *    ExoPlayer + one MediaSession and lets DefaultMediaNotificationProvider
 *    auto-publish the system media notification + lock-screen card.
 *  - This plugin connects via MediaController.buildAsync(SessionToken) and
 *    issues all play/pause/resume/stop/setVolume commands through the
 *    controller. MediaSessionService auto-foregrounds when the controller
 *    starts playing — no manual startForeground race.
 *  - We install a Player.Listener on the controller; the listener fires on
 *    the main thread and forwards events to JS via Plugin.trigger().
 *  - registerListener is overridden so a JS subscriber that arrives mid-stream
 *    is replayed the latest cached state-changed and icy-metadata payloads.
 */
@TauriPlugin
class RadioStreamPlugin(private val activity: Activity) : Plugin(activity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private var webView: WebView? = null

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private val pendingActions = ArrayDeque<(MediaController) -> Unit>()

    private var lastStateKind: String? = null
    private var lastStatePayload: JSObject? = null
    private var lastIcyPayload: JSObject? = null

    @Volatile
    private var hasReachedPlaying: Boolean = false

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            Log.d(PlaybackService.TAG, "Listener.onPlaybackStateChanged state=${stateName(playbackState)}")
            emitStateForCurrent()
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            Log.d(PlaybackService.TAG, "Listener.onIsPlayingChanged isPlaying=$isPlaying")
            if (isPlaying) hasReachedPlaying = true
            emitStateForCurrent()
        }

        override fun onPlayerError(error: PlaybackException) {
            val msg = error.message ?: error.errorCodeName
            Log.e(PlaybackService.TAG, "Listener.onPlayerError code=${error.errorCode} ($msg)", error)
            emitState("error", msg)
        }

        override fun onMetadata(metadata: Metadata) {
            handleIcyMetadata(metadata)
        }

        /**
         * ExoPlayer's audio-focus management (handleAudioFocus=true) suppresses
         * playback when something else holds focus — most commonly an active
         * phone call. Surface that to the user with a clear message instead of
         * letting the UI hang on "Connecting…".
         */
        override fun onPlaybackSuppressionReasonChanged(suppressionReason: Int) {
            Log.d(PlaybackService.TAG, "Listener.onPlaybackSuppressionReasonChanged reason=${suppressionReasonName(suppressionReason)}")
            when (suppressionReason) {
                Player.PLAYBACK_SUPPRESSION_REASON_NONE -> emitStateForCurrent()
                Player.PLAYBACK_SUPPRESSION_REASON_TRANSIENT_AUDIO_FOCUS_LOSS ->
                    emitState("error", "Audio is in use by another app (e.g. a phone call). Will resume when it's free.")
                Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_ROUTE ->
                    emitState("error", "Current audio route can't play this stream.")
                Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_OUTPUT ->
                    emitState("error", "No suitable audio output available.")
                else -> emitState("error", "Playback suppressed (code $suppressionReason).")
            }
        }
    }

    override fun load(webview: WebView) {
        Log.d(PlaybackService.TAG, "RadioStreamPlugin.load — building MediaController")
        this.webView = webview
        val token = SessionToken(activity, ComponentName(activity, PlaybackService::class.java))
        val future = MediaController.Builder(activity, token).buildAsync()
        controllerFuture = future
        future.addListener({
            val ctrl = try {
                future.get()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "MediaController.buildAsync failed", t)
                return@addListener
            }
            mainHandler.post {
                controller = ctrl
                ctrl.addListener(playerListener)
                Log.d(
                    PlaybackService.TAG,
                    "MediaController connected; draining ${pendingActions.size} pending action(s)"
                )
                while (pendingActions.isNotEmpty()) {
                    val action = pendingActions.removeFirst()
                    try {
                        action(ctrl)
                    } catch (t: Throwable) {
                        Log.e(PlaybackService.TAG, "pending action failed: ${t.message}", t)
                    }
                }
            }
        }, MoreExecutors.directExecutor())
    }

    override fun onDestroy() {
        Log.d(PlaybackService.TAG, "RadioStreamPlugin.onDestroy")
        mainHandler.post {
            controller?.removeListener(playerListener)
            controller?.release()
            controller = null
        }
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
        pendingActions.clear()
        webView = null
    }

    /**
     * Dispatch an event to JS via two parallel paths so a flake on either
     * one doesn't lose us the event:
     *   - WebView.evaluateJavascript → window.__radioStreamEvent(event, payload)
     *   - Plugin.trigger() → registered Channels (the "official" Tauri path)
     *
     * The audio-keepalive plugin relies on the same belt-and-braces pattern
     * (its readers wire window.__readerCmd) and that pair is what actually
     * delivers the lock-screen events in production. Replicating it here
     * means the radio events reach JS even when the Channel registry path
     * silently no-ops (which we observed on Android 14/Media3 1.4 builds).
     */
    private fun dispatchToJs(event: String, payload: JSObject) {
        val payloadJson = payload.toString()
        // Quote the event name for safe JS string injection.
        val safeEvent = event.replace("\\", "\\\\").replace("'", "\\'")
        val js =
            "if (window.__radioStreamEvent) window.__radioStreamEvent('$safeEvent', $payloadJson);"
        mainHandler.post {
            try {
                webView?.evaluateJavascript(js, null)
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "evaluateJavascript($event) failed: ${t.message}", t)
            }
        }
        try {
            trigger(event, payload)
        } catch (t: Throwable) {
            Log.e(PlaybackService.TAG, "trigger($event) failed: ${t.message}", t)
        }
    }

    /**
     * Run `block` with a connected MediaController on the main thread. If the
     * controller hasn't finished connecting yet, queue the block and run it
     * once the buildAsync future resolves.
     */
    private fun withController(block: (MediaController) -> Unit) {
        mainHandler.post {
            val ctrl = controller
            if (ctrl != null) {
                block(ctrl)
            } else {
                pendingActions.add(block)
            }
        }
    }

    // ── @Command surface ─────────────────────────────────────────────────

    @Command
    fun play(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(PlayArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }
        Log.d(PlaybackService.TAG, "@Command play url=${args.url} station=${args.stationName}")

        // Synthetic kind=loading so the UI flips to "Connecting" immediately
        // instead of waiting for ExoPlayer's first BUFFERING tick to proxy
        // through the controller listener.
        hasReachedPlaying = false
        emitState("loading", null)

        withController { ctrl ->
            try {
                val metaBuilder = MediaMetadata.Builder()
                    .setTitle(args.stationName ?: "Radio")
                    .setArtist(args.country ?: args.language ?: "")
                args.faviconUrl?.let {
                    try {
                        metaBuilder.setArtworkUri(android.net.Uri.parse(it))
                    } catch (t: Throwable) {
                        Log.w(PlaybackService.TAG, "bad faviconUrl: ${t.message}")
                    }
                }
                val item = MediaItem.Builder()
                    .setUri(args.url)
                    .setMediaMetadata(metaBuilder.build())
                    .build()
                ctrl.setMediaItem(item)
                ctrl.prepare()
                ctrl.playWhenReady = true
                Log.d(PlaybackService.TAG, "controller.setMediaItem + prepare + playWhenReady=true")
                invoke.resolve()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "play failed", t)
                emitState("error", t.message)
                invoke.reject("play failed: ${t.message}")
            }
        }
    }

    @Command
    fun pause(invoke: Invoke) {
        Log.d(PlaybackService.TAG, "@Command pause")
        withController { ctrl ->
            try {
                ctrl.playWhenReady = false
                invoke.resolve()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "pause failed", t)
                invoke.reject("pause failed: ${t.message}")
            }
        }
    }

    @Command
    fun resume(invoke: Invoke) {
        Log.d(PlaybackService.TAG, "@Command resume")
        withController { ctrl ->
            try {
                ctrl.playWhenReady = true
                invoke.resolve()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "resume failed", t)
                invoke.reject("resume failed: ${t.message}")
            }
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        Log.d(PlaybackService.TAG, "@Command stop")
        withController { ctrl ->
            try {
                ctrl.stop()
                ctrl.clearMediaItems()
                lastIcyPayload = null
                emitState("idle", null)
                invoke.resolve()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "stop failed", t)
                invoke.reject("stop failed: ${t.message}")
            }
        }
    }

    @Command
    fun setVolume(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(SetVolumeArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }
        val v = args.volume.coerceIn(0.0f, 1.0f)
        Log.d(PlaybackService.TAG, "@Command setVolume v=$v (raw=${args.volume})")
        withController { ctrl ->
            try {
                ctrl.volume = v
                invoke.resolve()
            } catch (t: Throwable) {
                Log.e(PlaybackService.TAG, "setVolume failed", t)
                invoke.reject("setVolume failed: ${t.message}")
            }
        }
    }

    /**
     * Override base Plugin.registerListener so a JS subscriber that registers
     * after ExoPlayer has already emitted "playing" (e.g. on hot reload, or
     * just because pack-mount happens within tens of ms of play) gets the
     * cached state replayed immediately. Without this, the UI gets stuck on
     * its initial "loading"/"Connecting" because it missed the transition.
     */
    @Command
    override fun registerListener(invoke: Invoke) {
        // Peek at the event name BEFORE super resolves the invoke. parseArgs
        // is safe to call repeatedly — it re-reads from the stored raw JSON.
        val event: String? = try {
            val raw = invoke.getArgs().optString("event", "")
            if (raw.isBlank()) null else raw
        } catch (_: Throwable) {
            null
        }

        super.registerListener(invoke)

        if (event == null) return
        when (event) {
            "state-changed" -> lastStatePayload?.let {
                Log.d(PlaybackService.TAG, "registerListener: replaying state-changed kind=$lastStateKind")
                dispatchToJs(event, it)
            }
            "icy-metadata" -> lastIcyPayload?.let {
                Log.d(PlaybackService.TAG, "registerListener: replaying icy-metadata")
                dispatchToJs(event, it)
            }
        }
    }

    // ── Player.Listener → JS event bridge ────────────────────────────────

    private fun emitStateForCurrent() {
        val ctrl = controller ?: return
        val kind: String = when (ctrl.playbackState) {
            Player.STATE_IDLE -> "idle"
            Player.STATE_BUFFERING -> if (hasReachedPlaying) "buffering" else "loading"
            Player.STATE_READY -> if (ctrl.isPlaying) "playing" else "paused"
            Player.STATE_ENDED -> "idle"
            else -> "idle"
        }
        emitState(kind, null)
    }

    private fun emitState(kind: String, message: String?) {
        // Dedupe identical (kind, no message) emissions; always re-emit when
        // a message is attached so error diagnostics don't get swallowed.
        if (kind == lastStateKind && message == null) return
        lastStateKind = kind
        val payload = JSObject()
        payload.put("kind", kind)
        if (message != null) payload.put("message", message)
        lastStatePayload = payload
        Log.d(PlaybackService.TAG, "emitState kind=$kind message=$message")
        dispatchToJs("state-changed", payload)
    }

    private fun handleIcyMetadata(metadata: Metadata) {
        var streamTitle: String? = null
        var streamUrl: String? = null
        var name: String? = null
        var genre: String? = null
        var bitrate: Int? = null

        for (i in 0 until metadata.length()) {
            when (val entry = metadata.get(i)) {
                is IcyInfo -> {
                    streamTitle = entry.title ?: streamTitle
                    streamUrl = entry.url ?: streamUrl
                }
                is IcyHeaders -> {
                    name = entry.name ?: name
                    genre = entry.genre ?: genre
                    if (entry.bitrate > 0) bitrate = entry.bitrate
                    streamUrl = entry.url ?: streamUrl
                }
            }
        }

        if (streamTitle == null && streamUrl == null && name == null && genre == null && bitrate == null) {
            return
        }

        val payload = JSObject()
        if (streamTitle != null) payload.put("streamTitle", streamTitle)
        if (streamUrl != null) payload.put("streamUrl", streamUrl)
        if (name != null) payload.put("name", name)
        if (genre != null) payload.put("genre", genre)
        if (bitrate != null) payload.put("bitrate", bitrate)
        lastIcyPayload = payload

        Log.d(PlaybackService.TAG, "icy-metadata title=$streamTitle name=$name genre=$genre bitrate=$bitrate")
        dispatchToJs("icy-metadata", payload)
    }

    private fun stateName(state: Int): String = when (state) {
        Player.STATE_IDLE -> "IDLE"
        Player.STATE_BUFFERING -> "BUFFERING"
        Player.STATE_READY -> "READY"
        Player.STATE_ENDED -> "ENDED"
        else -> "UNKNOWN($state)"
    }

    private fun suppressionReasonName(reason: Int): String = when (reason) {
        Player.PLAYBACK_SUPPRESSION_REASON_NONE -> "NONE"
        Player.PLAYBACK_SUPPRESSION_REASON_TRANSIENT_AUDIO_FOCUS_LOSS -> "TRANSIENT_AUDIO_FOCUS_LOSS"
        Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_ROUTE -> "UNSUITABLE_AUDIO_ROUTE"
        Player.PLAYBACK_SUPPRESSION_REASON_UNSUITABLE_AUDIO_OUTPUT -> "UNSUITABLE_AUDIO_OUTPUT"
        else -> "UNKNOWN($reason)"
    }
}
