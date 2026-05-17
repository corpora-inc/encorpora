package com.corpora.stt

import android.util.Log

/**
 * Kotlin wrapper around a whisper.cpp `whisper_context*`. Mirrors the
 * Swift `WhisperCppContext` actor in `ios/Sources/STTPlugin.swift`.
 *
 * The opaque pointer is held as a `Long`. The native side casts back
 * to `whisper_context*`. After [release] the handle is invalid.
 *
 * Concurrency: this class is not internally synchronized. Callers
 * (currently `SttPlugin`) serialize transcribe + free against any
 * in-flight calls via their own queue / dispatcher.
 */
class WhisperContext private constructor(private var ctxPtr: Long) {

    val isAlive: Boolean get() = ctxPtr != 0L

    fun release() {
        if (ctxPtr != 0L) {
            nativeFree(ctxPtr)
            ctxPtr = 0L
        }
    }

    /**
     * Run a single-pass transcribe. Returns 0 on success, non-zero on
     * whisper.cpp error. Samples must be 16 kHz f32 mono.
     *
     * @param nThreads compute workers — should be the device's
     *                 high-performance core count to avoid the perf
     *                 vs efficiency cluster race (see
     *                 WhisperCpuConfig).
     * @param overrides optional per-call overrides for
     *                  `whisper_full_params`. Each nullable field is
     *                  unboxed to a sentinel here (NaN / -1 / "") so
     *                  the JNI signature stays primitive — the C++
     *                  side treats those sentinels as "no override."
     */
    fun transcribe(
        samples: FloatArray,
        language: String,
        nThreads: Int,
        overrides: WhisperParamsArg? = null,
    ): Int {
        if (ctxPtr == 0L) return -1
        // Unbox nullable Float? to NaN ("unset"). The C++ side checks
        // `std::isnan` to decide whether to override the corresponding
        // `whisper_full_params` field.
        val nanIfNull: (Float?) -> Float = { it ?: Float.NaN }
        // Tri-state booleans across JNI as Int: -1 = unset, 0 = false,
        // 1 = true. Keeps the JNI signature primitive.
        val triBool: (Boolean?) -> Int = {
            when (it) {
                null -> -1
                false -> 0
                true -> 1
            }
        }
        return nativeFullTranscribe(
            ctxPtr,
            samples,
            language,
            false,
            nThreads,
            nanIfNull(overrides?.temperature),
            nanIfNull(overrides?.temperature_inc),
            nanIfNull(overrides?.entropy_thold),
            nanIfNull(overrides?.logprob_thold),
            nanIfNull(overrides?.no_speech_thold),
            triBool(overrides?.suppress_blank),
            triBool(overrides?.suppress_nst),
            overrides?.initial_prompt ?: "",
        )
    }

    fun numSegments(): Int =
        if (ctxPtr == 0L) 0 else nativeNumSegments(ctxPtr)

    fun segmentText(idx: Int): String =
        if (ctxPtr == 0L) "" else nativeSegmentText(ctxPtr, idx)

    fun segmentNoSpeechProb(idx: Int): Float =
        if (ctxPtr == 0L) 0f else nativeSegmentNoSpeechProb(ctxPtr, idx)

    fun numTokens(segIdx: Int): Int =
        if (ctxPtr == 0L) 0 else nativeNumTokens(ctxPtr, segIdx)

    fun tokenText(segIdx: Int, tokIdx: Int): String =
        if (ctxPtr == 0L) "" else nativeTokenText(ctxPtr, segIdx, tokIdx)

    /** float[5] = { p, plog, t0_10ms, t1_10ms, id }. */
    fun tokenData(segIdx: Int, tokIdx: Int): FloatArray? =
        if (ctxPtr == 0L) null else nativeTokenData(ctxPtr, segIdx, tokIdx)

    private external fun nativeFree(ctxPtr: Long)
    private external fun nativeFullTranscribe(
        ctxPtr: Long,
        samples: FloatArray,
        language: String,
        translate: Boolean,
        nThreads: Int,
        // Param overrides — NaN / -1 / "" sentinels for "unset".
        // See `transcribe()` above for the encoding scheme.
        temperature: Float,
        temperatureInc: Float,
        entropyThold: Float,
        logprobThold: Float,
        noSpeechThold: Float,
        suppressBlank: Int,
        suppressNst: Int,
        initialPrompt: String,
    ): Int
    private external fun nativeNumSegments(ctxPtr: Long): Int
    private external fun nativeSegmentText(ctxPtr: Long, segIdx: Int): String
    private external fun nativeSegmentNoSpeechProb(ctxPtr: Long, segIdx: Int): Float
    private external fun nativeNumTokens(ctxPtr: Long, segIdx: Int): Int
    private external fun nativeTokenText(ctxPtr: Long, segIdx: Int, tokIdx: Int): String
    private external fun nativeTokenData(ctxPtr: Long, segIdx: Int, tokIdx: Int): FloatArray?

    companion object {
        private const val TAG = "WhisperJNI-Kotlin"

        init {
            try {
                System.loadLibrary("c++_shared")
            } catch (t: Throwable) {
                Log.w(TAG, "c++_shared load skipped: ${t.message}")
            }
            System.loadLibrary("whisper-jni")
        }

        @JvmStatic
        external fun nativeVersion(): String

        @JvmStatic
        external fun nativeInitFromFile(path: String): Long

        fun load(path: String): WhisperContext? {
            val ptr = nativeInitFromFile(path)
            if (ptr == 0L) return null
            return WhisperContext(ptr)
        }
    }
}
