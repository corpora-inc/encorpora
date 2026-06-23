package com.corpora.stt

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * 16 kHz f32 mono mic capture, mirroring the iOS `AVAudioEngine` setup
 * in `STTPlugin.swift`. Whisper.cpp expects exactly that input format.
 *
 * Usage:
 *   - construct once at boot: `AudioRecorder()`
 *   - `startRecording()` to begin appending samples to the buffer
 *   - `stopRecording()` returns the captured FloatArray
 *   - `cancelRecording()` discards the buffer
 *   - `release()` at app teardown
 *
 * The internal AudioRecord stays warm between sessions to dodge the
 * ~hundreds-of-ms startup cost on first record. Samples are only
 * appended while `recording` is true, so the always-running tap
 * silently discards frames between sessions — same pattern as the iOS
 * engine pre-warm.
 */
class AudioRecorder {

    companion object {
        private const val TAG = "Whisper"
        const val TARGET_SAMPLE_RATE = 16_000
    }

    private val recording = AtomicBoolean(false)
    private val running = AtomicBoolean(false)
    private var record: AudioRecord? = null
    private var captureThread: Thread? = null

    @Volatile
    private var captured: ArrayList<Float> = ArrayList(TARGET_SAMPLE_RATE * 10)

    /**
     * Called on the capture thread once per successful read while
     * `recording` is true, ~8 Hz at 2048-frame reads. Receives the RMS
     * over the chunk and the running sample count since the most
     * recent `startRecording()` — the plugin uses this to forward an
     * `audio_level` event to the WebView for client-side silence
     * detection.
     */
    @Volatile
    var onLevel: ((rms: Float, samplesSinceStart: Long) -> Unit)? = null

    @Volatile
    private var samplesSinceStart: Long = 0

    /**
     * Build the AudioRecord and start the capture thread. AudioRecord
     * itself is configured at TARGET_SAMPLE_RATE so the OS does any
     * needed resampling for us — no AVAudioConverter equivalent
     * required.
     */
    @SuppressLint("MissingPermission")
    fun start() {
        if (running.get()) return

        val minBuf = AudioRecord.getMinBufferSize(
            TARGET_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_FLOAT,
        )
        if (minBuf <= 0) {
            throw IllegalStateException(
                "AudioRecord.getMinBufferSize returned $minBuf — device " +
                    "doesn't support 16 kHz mono float PCM."
            )
        }
        // 4x min buffer gives slack so we don't drop frames if the
        // capture thread stalls briefly.
        val bufBytes = maxOf(minBuf * 4, TARGET_SAMPLE_RATE * 4)

        val r = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            TARGET_SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_FLOAT,
            bufBytes,
        )
        if (r.state != AudioRecord.STATE_INITIALIZED) {
            r.release()
            throw IllegalStateException("AudioRecord failed to initialize")
        }

        record = r
        running.set(true)
        r.startRecording()
        Log.i(TAG, "audio engine started inputFormat: ${TARGET_SAMPLE_RATE}Hz ch: 1 buf: $bufBytes")

        captureThread = thread(name = "stt-capture", isDaemon = true) {
            val readBuf = FloatArray(2048)
            while (running.get()) {
                val n = try {
                    r.read(readBuf, 0, readBuf.size, AudioRecord.READ_BLOCKING)
                } catch (e: Throwable) {
                    Log.e(TAG, "AudioRecord.read threw: ${e.message}", e)
                    break
                }
                if (n <= 0) {
                    if (n == AudioRecord.ERROR_INVALID_OPERATION ||
                        n == AudioRecord.ERROR_BAD_VALUE
                    ) {
                        Log.e(TAG, "AudioRecord.read error code $n; bailing")
                        break
                    }
                    continue
                }
                if (!recording.get()) continue

                // Per-buffer RMS for the pack-side silence detector.
                // Cost is ~10 µs for 2048 floats. Computed outside the
                // capture-buffer lock so the critical section stays
                // identical to before this feature.
                val cb = onLevel
                if (cb != null) {
                    var sum = 0.0
                    for (i in 0 until n) {
                        val v = readBuf[i]
                        sum += v.toDouble() * v.toDouble()
                    }
                    val rms = kotlin.math.sqrt(sum / n).toFloat()
                    samplesSinceStart += n
                    try {
                        cb(rms, samplesSinceStart)
                    } catch (e: Throwable) {
                        Log.e(TAG, "onLevel threw: ${e.message}", e)
                    }
                }

                synchronized(this) {
                    val target = captured
                    target.ensureCapacity(target.size + n)
                    for (i in 0 until n) target.add(readBuf[i])
                }
            }
        }
    }

    /**
     * Begin appending captured samples to the internal buffer. Idempotent
     * — calling while already recording resets the buffer.
     */
    fun startRecording() {
        synchronized(this) {
            captured = ArrayList(TARGET_SAMPLE_RATE * 10)
        }
        samplesSinceStart = 0
        recording.set(true)
    }

    /**
     * Stop appending and return the captured samples. Engine stays
     * warm.
     */
    fun stopRecording(): FloatArray {
        recording.set(false)
        return synchronized(this) {
            val out = FloatArray(captured.size)
            for (i in captured.indices) out[i] = captured[i]
            captured = ArrayList(TARGET_SAMPLE_RATE * 10)
            out
        }
    }

    /** Drop captured samples without returning them. */
    fun cancelRecording() {
        recording.set(false)
        synchronized(this) {
            captured = ArrayList(TARGET_SAMPLE_RATE * 10)
        }
    }

    /** Tear down. After this `start()` would need to be called again. */
    fun release() {
        running.set(false)
        recording.set(false)
        try {
            captureThread?.join(250)
        } catch (_: Throwable) {
        }
        captureThread = null
        try {
            record?.stop()
        } catch (_: Throwable) {
        }
        try {
            record?.release()
        } catch (_: Throwable) {
        }
        record = null
        Log.i(TAG, "audio engine released")
    }
}
