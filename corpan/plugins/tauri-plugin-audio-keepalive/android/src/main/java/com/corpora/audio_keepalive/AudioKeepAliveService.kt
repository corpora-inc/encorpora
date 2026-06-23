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
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
        private const val ACTION_SYNC_PLAYBACK_STATE = "SYNC_PLAYBACK_STATE"
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
    private var lastNowPlayingToken: Long = Long.MIN_VALUE
    private var appIconBitmap: Bitmap? = null

    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var noisyReceiver: BroadcastReceiver? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        appIconBitmap = loadAppIconBitmap()
        setupMediaSession()
        acquireWakeLock()
        requestAudioFocus()
        registerNoisyReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SKIP_BACK -> {
                Log.d(TAG, "ACTION_SKIP_BACK")
                handleSkipBackCommand("notification")
            }
            ACTION_PLAY_PAUSE -> {
                Log.d(TAG, "ACTION_PLAY_PAUSE isPlaying=$isPlaying")
                if (isPlaying) {
                    handlePauseCommand("notification")
                } else {
                    handlePlayCommand("notification")
                }
            }
            ACTION_SKIP_FORWARD -> {
                Log.d(TAG, "ACTION_SKIP_FORWARD")
                handleSkipForwardCommand("notification")
            }
            "PAUSE_PLAYBACK" -> {
                Log.d(TAG, "PAUSE_PLAYBACK")
                handlePauseCommand("plugin")
            }
            "RESUME_PLAYBACK" -> {
                Log.d(TAG, "RESUME_PLAYBACK")
                handlePlayCommand("plugin")
            }
            ACTION_SYNC_PLAYBACK_STATE -> {
                val requestedPlaying = intent.getBooleanExtra("isPlaying", isPlaying)
                Log.d(TAG, "ACTION_SYNC_PLAYBACK_STATE requestedPlaying=$requestedPlaying current=$isPlaying")
                if (requestedPlaying != isPlaying) {
                    if (isPlaying && !requestedPlaying) {
                        snapshotPositionNow()
                    }
                    isPlaying = requestedPlaying
                    if (isPlaying) {
                        lastPositionUpdateTime = SystemClock.elapsedRealtime()
                    }
                }
                updateMediaSession()
                updateNotification()
            }
            "UPDATE_NOW_PLAYING" -> {
                if (intent.hasExtra("nowPlayingToken")) {
                    val token = intent.getLongExtra("nowPlayingToken", Long.MIN_VALUE)
                    if (token < lastNowPlayingToken) {
                        Log.d(TAG, "Dropping stale now-playing token=$token last=$lastNowPlayingToken")
                        return START_STICKY
                    }
                    lastNowPlayingToken = token
                }
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
                    val requestedPlaying = intent.getBooleanExtra("isPlaying", isPlaying)
                    if (isPlaying && !requestedPlaying && !intent.hasExtra("positionMs")) {
                        snapshotPositionNow()
                    }
                    isPlaying = requestedPlaying
                    if (isPlaying && !intent.hasExtra("positionMs")) {
                        lastPositionUpdateTime = SystemClock.elapsedRealtime()
                    }
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
                lastPositionUpdateTime = SystemClock.elapsedRealtime()
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
                    Log.d(TAG, "MediaSession onPlay")
                    handlePlayCommand("mediaSession")
                }

                override fun onPause() {
                    Log.d(TAG, "MediaSession onPause")
                    handlePauseCommand("mediaSession")
                }

                override fun onSkipToNext() {
                    Log.d(TAG, "MediaSession onSkipToNext")
                    handleSkipForwardCommand("mediaSession")
                }

                override fun onSkipToPrevious() {
                    Log.d(TAG, "MediaSession onSkipToPrevious")
                    handleSkipBackCommand("mediaSession")
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

    private fun handlePlayCommand(source: String) {
        if (isPlaying) {
            Log.d(TAG, "handlePlayCommand($source) ignored: already playing")
            return
        }
        isPlaying = true
        lastPositionUpdateTime = SystemClock.elapsedRealtime()
        updateMediaSession()
        updateNotification()
        Log.d(TAG, "handlePlayCommand($source) -> fireEvent(audio-keepalive:play)")
        fireEvent("audio-keepalive:play")
    }

    private fun handlePauseCommand(source: String) {
        if (!isPlaying) {
            Log.d(TAG, "handlePauseCommand($source) ignored: already paused")
            return
        }
        snapshotPositionNow()
        isPlaying = false
        updateMediaSession()
        updateNotification()
        Log.d(TAG, "handlePauseCommand($source) -> fireEvent(audio-keepalive:pause)")
        fireEvent("audio-keepalive:pause")
    }

    private fun handleSkipForwardCommand(source: String) {
        Log.d(TAG, "handleSkipForwardCommand($source) -> fireEvent(audio-keepalive:skipForward)")
        fireEvent("audio-keepalive:skipForward")
    }

    private fun handleSkipBackCommand(source: String) {
        Log.d(TAG, "handleSkipBackCommand($source) -> fireEvent(audio-keepalive:skipBack)")
        fireEvent("audio-keepalive:skipBack")
    }

    private fun updateMediaSession() {
        val durationLong = currentDurationMs.toLong()
        val positionLong = effectivePositionMs()
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .apply {
                    if (currentBookTitle.isNotEmpty()) {
                        putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentBookTitle)
                    }
                    if (durationLong > 0) {
                        putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationLong)
                    }
                    appIconBitmap?.let { icon ->
                        putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, icon)
                        putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, icon)
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
                positionLong,
                rate,
                SystemClock.elapsedRealtime()
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
            .setLargeIcon(appIconBitmap)
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
        Log.d(TAG, "fireEvent($event)")
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

    // ── Position / Artwork Helpers ──────────────────────────────────────

    private fun effectivePositionMs(): Long {
        val base = currentPositionMs.toLong().coerceAtLeast(0L)
        val driftAdjusted = if (isPlaying && lastPositionUpdateTime > 0L) {
            val elapsed = (SystemClock.elapsedRealtime() - lastPositionUpdateTime).coerceAtLeast(0L)
            base + elapsed
        } else {
            base
        }
        val duration = currentDurationMs.toLong()
        return if (duration > 0L) driftAdjusted.coerceIn(0L, duration) else driftAdjusted
    }

    private fun snapshotPositionNow() {
        currentPositionMs = effectivePositionMs().toDouble()
        lastPositionUpdateTime = SystemClock.elapsedRealtime()
    }

    private fun loadAppIconBitmap(): Bitmap? {
        val iconRes = applicationInfo.icon
        if (iconRes == 0) return null
        return try {
            BitmapFactory.decodeResource(resources, iconRes)
        } catch (_: Exception) {
            null
        }
    }
}
