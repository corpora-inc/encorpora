package com.corpora.audio_keepalive

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import app.tauri.plugin.JSObject

class AudioKeepAliveService : Service() {

    companion object {
        private const val TAG = "AudioKeepAlive"
        private const val CHANNEL_ID = "audio_keepalive"
        private const val NOTIFICATION_ID = 9001

        private const val ACTION_SKIP_BACK = "com.corpora.audio_keepalive.SKIP_BACK"
        private const val ACTION_PLAY_PAUSE = "com.corpora.audio_keepalive.PLAY_PAUSE"
        private const val ACTION_SKIP_FORWARD = "com.corpora.audio_keepalive.SKIP_FORWARD"
    }

    private var mediaSession: MediaSessionCompat? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentTitle = "Stargate Reader"
    private var currentArtist = "Narrator"
    private var currentBookTitle = ""
    private var isPlaying = true

    private var currentPositionMs: Double = 0.0
    private var currentDurationMs: Double = 0.0
    private var lastPositionUpdateTime: Long = 0L

    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var noisyReceiver: BroadcastReceiver? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        setupMediaSession()
        acquireWakeLock()
        requestAudioFocus()
        registerNoisyReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SKIP_BACK -> {
                mediaSession?.controller?.transportControls?.skipToPrevious()
            }
            ACTION_PLAY_PAUSE -> {
                if (isPlaying) {
                    mediaSession?.controller?.transportControls?.pause()
                } else {
                    mediaSession?.controller?.transportControls?.play()
                }
            }
            ACTION_SKIP_FORWARD -> {
                mediaSession?.controller?.transportControls?.skipToNext()
            }
            "PAUSE_PLAYBACK" -> {
                mediaSession?.controller?.transportControls?.pause()
            }
            "RESUME_PLAYBACK" -> {
                mediaSession?.controller?.transportControls?.play()
            }
            "UPDATE_NOW_PLAYING" -> {
                intent.getStringExtra("title")?.let { currentTitle = it }
                intent.getStringExtra("artist")?.let { currentArtist = it }
                intent.getStringExtra("bookTitle")?.let { currentBookTitle = it }
                if (intent.hasExtra("positionMs")) {
                    currentPositionMs = intent.getDoubleExtra("positionMs", 0.0)
                    lastPositionUpdateTime = SystemClock.elapsedRealtime()
                }
                if (intent.hasExtra("durationMs")) {
                    currentDurationMs = intent.getDoubleExtra("durationMs", 0.0)
                }
                if (intent.hasExtra("isPlaying")) {
                    isPlaying = intent.getBooleanExtra("isPlaying", true)
                }
                updateMediaSession()
                updateNotification()
            }
            else -> {
                // Initial start
                intent?.getStringExtra("title")?.let { currentTitle = it }
                intent?.getStringExtra("artist")?.let { currentArtist = it }
                intent?.getStringExtra("bookTitle")?.let { currentBookTitle = it }
                if (intent?.hasExtra("positionMs") == true) {
                    currentPositionMs = intent.getDoubleExtra("positionMs", 0.0)
                    lastPositionUpdateTime = SystemClock.elapsedRealtime()
                }
                if (intent?.hasExtra("durationMs") == true) {
                    currentDurationMs = intent.getDoubleExtra("durationMs", 0.0)
                }
                isPlaying = true
                updateMediaSession()
                startForeground(NOTIFICATION_ID, buildNotification())
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        unregisterNoisyReceiver()
        abandonAudioFocus()
        releaseWakeLock()
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    // ── Notification Channel ────────────────────────────────────────────

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

    // ── MediaSession ────────────────────────────────────────────────────

    private fun setupMediaSession() {
        mediaSession = MediaSessionCompat(this, "StargateReader").apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            )
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    isPlaying = true
                    lastPositionUpdateTime = SystemClock.elapsedRealtime()
                    updateMediaSession()
                    updateNotification()
                    fireEvent("audio-keepalive:play")
                }

                override fun onPause() {
                    isPlaying = false
                    lastPositionUpdateTime = SystemClock.elapsedRealtime()
                    updateMediaSession()
                    updateNotification()
                    fireEvent("audio-keepalive:pause")
                }

                override fun onSkipToNext() {
                    fireEvent("audio-keepalive:skipForward")
                }

                override fun onSkipToPrevious() {
                    fireEvent("audio-keepalive:skipBack")
                }

                override fun onSeekTo(pos: Long) {
                    currentPositionMs = pos.toDouble()
                    lastPositionUpdateTime = SystemClock.elapsedRealtime()
                    updateMediaSession()
                    updateNotification()
                    val data = JSObject()
                    data.put("positionMs", pos.toDouble())
                    fireEvent("audio-keepalive:seek", data)
                }

                override fun onStop() {
                    stopSelf()
                }
            })
            isActive = true
        }
    }

    private fun updateMediaSession() {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .apply {
                    if (currentBookTitle.isNotEmpty()) {
                        putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentBookTitle)
                    }
                    if (currentDurationMs > 0) {
                        putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs.toLong())
                    }
                }
                .build()
        )

        val state = if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        val rate = if (isPlaying) 1.0f else 0.0f

        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(
                state,
                currentPositionMs.toLong(),
                rate,
                lastPositionUpdateTime
            )

        mediaSession?.setPlaybackState(stateBuilder.build())
    }

    // ── Notification ────────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentPending = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action: Skip Back 30s
        val skipBackIntent = Intent(this, AudioKeepAliveService::class.java).apply {
            action = ACTION_SKIP_BACK
        }
        val skipBackPending = PendingIntent.getService(
            this, 1, skipBackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action: Play/Pause toggle
        val playPauseIntent = Intent(this, AudioKeepAliveService::class.java).apply {
            action = ACTION_PLAY_PAUSE
        }
        val playPausePending = PendingIntent.getService(
            this, 2, playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Action: Skip Forward 30s
        val skipForwardIntent = Intent(this, AudioKeepAliveService::class.java).apply {
            action = ACTION_SKIP_FORWARD
        }
        val skipForwardPending = PendingIntent.getService(
            this, 3, skipForwardIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(if (currentBookTitle.isNotEmpty()) currentBookTitle else currentArtist)
            .setSubText(if (currentBookTitle.isNotEmpty()) currentArtist else null)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentPending)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_previous, "Back 30s", skipBackPending)
            .addAction(playPauseIcon, playPauseLabel, playPausePending)
            .addAction(android.R.drawable.ic_media_next, "Forward 30s", skipForwardPending)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession?.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification())
    }

    // ── Audio Focus ─────────────────────────────────────────────────────

    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                Log.d(TAG, "Audio focus lost permanently")
                mediaSession?.controller?.transportControls?.pause()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "Audio focus lost transiently (call, etc.)")
                isPlaying = false
                lastPositionUpdateTime = SystemClock.elapsedRealtime()
                updateMediaSession()
                updateNotification()
                fireEvent("audio-keepalive:interruptionBegan")
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.d(TAG, "Audio focus regained")
                val data = JSObject()
                data.put("shouldResume", true)
                fireEvent("audio-keepalive:interruptionEnded", data)
            }
        }
    }

    private fun requestAudioFocus() {
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()

        audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setOnAudioFocusChangeListener(audioFocusChangeListener)
            .build()

        audioManager?.requestAudioFocus(audioFocusRequest!!)
    }

    private fun abandonAudioFocus() {
        audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        audioFocusRequest = null
        audioManager = null
    }

    // ── Headphone Disconnect (ACTION_AUDIO_BECOMING_NOISY) ──────────────

    private fun registerNoisyReceiver() {
        noisyReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                    Log.d(TAG, "Headphones disconnected, pausing")
                    mediaSession?.controller?.transportControls?.pause()
                }
            }
        }
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(noisyReceiver, filter)
        }
    }

    private fun unregisterNoisyReceiver() {
        noisyReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {}
        }
        noisyReceiver = null
    }

    // ── Event Bridge ────────────────────────────────────────────────────

    private fun fireEvent(event: String, data: JSObject = JSObject()) {
        AudioKeepAlivePlugin.onMediaCommand?.invoke(event, data)
    }

    // ── Wake Lock ───────────────────────────────────────────────────────

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
