package com.corpora.audio_keepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the app alive for background audio playback.
 *
 * Shows a persistent notification with media controls and holds a partial wake lock
 * to prevent the CPU from sleeping during audio playback.
 */
class AudioKeepAliveService : Service() {

    companion object {
        private const val CHANNEL_ID = "audio_keepalive"
        private const val NOTIFICATION_ID = 9001
    }

    private var mediaSession: MediaSessionCompat? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentTitle = "Stargate Reader"
    private var currentArtist = "Narrator"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        setupMediaSession()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "UPDATE_NOW_PLAYING" -> {
                intent.getStringExtra("title")?.let { currentTitle = it }
                intent.getStringExtra("artist")?.let { currentArtist = it }
                val positionMs = if (intent.hasExtra("positionMs")) intent.getDoubleExtra("positionMs", 0.0) else null
                val durationMs = if (intent.hasExtra("durationMs")) intent.getDoubleExtra("durationMs", 0.0) else null
                updateMediaSession(positionMs, durationMs)
                updateNotification()
            }
            else -> {
                // Initial start
                intent?.getStringExtra("title")?.let { currentTitle = it }
                intent?.getStringExtra("artist")?.let { currentArtist = it }
                updateMediaSession(null, null)
                startForeground(NOTIFICATION_ID, buildNotification())
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Audio Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps audio playing in the background"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun setupMediaSession() {
        mediaSession = MediaSessionCompat(this, "StargateReader").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    // TODO: relay to WebView via Tauri event
                }
                override fun onPause() {
                    // TODO: relay to WebView via Tauri event
                }
                override fun onSkipToNext() {
                    // TODO: relay to WebView
                }
                override fun onSkipToPrevious() {
                    // TODO: relay to WebView
                }
            })
            isActive = true
        }
    }

    private fun updateMediaSession(positionMs: Double?, durationMs: Double?) {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .apply {
                    durationMs?.let {
                        putLong(MediaMetadataCompat.METADATA_KEY_DURATION, it.toLong())
                    }
                }
                .build()
        )

        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            )
            .setState(
                PlaybackStateCompat.STATE_PLAYING,
                positionMs?.toLong() ?: PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                1.0f
            )

        mediaSession?.setPlaybackState(stateBuilder.build())
    }

    private fun buildNotification(): Notification {
        // Intent to open the app when notification is tapped
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession?.sessionToken)
            )
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "corpan:audio-keepalive"
        ).apply {
            acquire(4 * 60 * 60 * 1000L) // 4 hours max
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
}
