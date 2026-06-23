package com.corpora.radio_stream

import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Clean MediaSessionService that owns the radio's ExoPlayer and MediaSession.
 *
 * No static state, no manual notification building, no manual startForeground.
 * The plugin connects via MediaController.buildAsync(SessionToken) and drives
 * the player through that controller — Media3's MediaSessionService then
 * auto-foregrounds the service when player.isPlaying flips to true and
 * DefaultMediaNotificationProvider renders the lock-screen card from the
 * MediaItem.MediaMetadata we set on play().
 */
class PlaybackService : MediaSessionService() {

    companion object {
        const val TAG = "RadioStream"
    }

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "PlaybackService.onCreate")

        val attrs = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        // "Icy-MetaData: 1" unlocks Shoutcast inline track metadata in MP3/AAC
        // streams; ExoPlayer surfaces it via Player.Listener.onMetadata.
        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("Corpan-WorldRadio/0.4")
            .setAllowCrossProtocolRedirects(true)
            .setDefaultRequestProperties(mapOf("Icy-MetaData" to "1"))

        val mediaSourceFactory = DefaultMediaSourceFactory(this)
            .setDataSourceFactory(httpFactory)

        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(attrs, /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .setMediaSourceFactory(mediaSourceFactory)
            .build()

        // Tapping the lock-screen / notification body should bring the user
        // back to the radio. Wire the host app's launcher Intent as the
        // session's activity intent so DefaultMediaNotificationProvider
        // surfaces it as the content click target.
        val sessionActivity = packageManager.getLaunchIntentForPackage(packageName)?.let { intent ->
            PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
        }

        mediaSession = MediaSession.Builder(this, player)
            .apply { sessionActivity?.let { setSessionActivity(it) } }
            .build()

        setMediaNotificationProvider(
            DefaultMediaNotificationProvider.Builder(this).build()
        )

        Log.d(TAG, "PlaybackService initialized: player + session ready")
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = mediaSession?.player
        Log.d(
            TAG,
            "onTaskRemoved playWhenReady=${player?.playWhenReady} " +
                "mediaItemCount=${player?.mediaItemCount}"
        )
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "PlaybackService.onDestroy")
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
        super.onDestroy()
    }
}
