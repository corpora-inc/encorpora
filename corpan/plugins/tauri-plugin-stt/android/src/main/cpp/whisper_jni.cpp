// JNI shim bridging Kotlin <-> whisper.cpp on Android.
//
// Mirrors the Swift `WhisperCppContext` actor pattern from
// `ios/Sources/STTPlugin.swift` — the Kotlin side owns the opaque
// `whisper_context*` (passed back as a jlong) and calls back in via
// these methods to load / free / transcribe.
//
// All non-trivial work (transcribe) runs on whatever thread Kotlin
// dispatches us from; Kotlin handles thread-safety with its actor /
// queue pattern.

#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>
#include "whisper.h"

#define LOG_TAG "WhisperJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

extern "C" {

// ---------------------------------------------------------------------
// Init / free
// ---------------------------------------------------------------------

JNIEXPORT jlong JNICALL
Java_com_corpora_stt_WhisperContext_nativeInitFromFile(
        JNIEnv *env,
        jclass /* clazz */,
        jstring jpath) {
    const char *path = env->GetStringUTFChars(jpath, nullptr);
    if (!path) {
        LOGE("nativeInitFromFile: GetStringUTFChars returned null");
        return 0;
    }
    LOGI("loading whisper model from: %s", path);

    struct whisper_context_params cparams = whisper_context_default_params();
    // CPU only on Android for Phase 1 (the same Metal compute path we
    // use on iOS doesn't exist here, and OpenCL/Vulkan backends aren't
    // built into our CMake config).
    cparams.use_gpu = false;

    struct whisper_context *ctx =
            whisper_init_from_file_with_params(path, cparams);

    env->ReleaseStringUTFChars(jpath, path);
    if (!ctx) {
        LOGE("whisper_init_from_file_with_params returned null");
        return 0;
    }
    LOGI("whisper model loaded ok, ctx=%p", (void *) ctx);
    return reinterpret_cast<jlong>(ctx);
}

JNIEXPORT void JNICALL
Java_com_corpora_stt_WhisperContext_nativeFree(
        JNIEnv *env,
        jobject /* thiz */,
        jlong ctxPtr) {
    if (ctxPtr == 0) return;
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    LOGI("whisper_free ctx=%p", (void *) ctx);
    whisper_free(ctx);
}

JNIEXPORT jstring JNICALL
Java_com_corpora_stt_WhisperContext_nativeVersion(
        JNIEnv *env,
        jclass /* clazz */) {
    return env->NewStringUTF("v1.8.4");
}

// ---------------------------------------------------------------------
// Transcribe
//
// Single-pass `whisper_full` decode with the language and prompt the
// caller supplies. Returns 0 on success, non-zero on failure (whisper
// internal error code). Samples must be 16 kHz f32 mono.
// ---------------------------------------------------------------------

JNIEXPORT jint JNICALL
Java_com_corpora_stt_WhisperContext_nativeFullTranscribe(
        JNIEnv *env,
        jobject /* thiz */,
        jlong ctxPtr,
        jfloatArray jsamples,
        jstring jlanguage,
        jboolean translate,
        jint nThreads) {
    if (ctxPtr == 0) {
        LOGE("nativeFullTranscribe: ctxPtr is null");
        return -1;
    }
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);

    jsize n = env->GetArrayLength(jsamples);
    if (n <= 0) {
        LOGE("nativeFullTranscribe: empty samples buffer");
        return -2;
    }
    jfloat *samples = env->GetFloatArrayElements(jsamples, nullptr);
    if (!samples) {
        LOGE("nativeFullTranscribe: GetFloatArrayElements returned null");
        return -3;
    }

    const char *lang = env->GetStringUTFChars(jlanguage, nullptr);

    struct whisper_full_params params =
            whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
    params.print_progress   = false;
    params.print_special    = false;
    params.print_realtime   = false;
    params.print_timestamps = false;
    params.translate        = (bool) translate;
    params.language         = lang;
    params.token_timestamps = true;   // per-token timing for scoring
    params.no_context       = true;
    params.single_segment   = false;
    params.suppress_blank   = true;
    // Match iOS: greedy with one beam.
    params.greedy.best_of   = 1;
    // Multi-threaded compute pinned to the high-performance core
    // count. The earlier SIGSEGV in `ggml_vec_dot_f16` was actually
    // two bugs stacked: (1) the JIT'd fp16 NEON kernels were emitted
    // for armv8-a (no fp16 ISA) instead of armv8.2-a+fp16 — fixed
    // in CMake. (2) ggml workers spread across perf + efficiency
    // cores read torn memory across the cluster boundary. The Kotlin
    // side computes `WhisperCpuConfig.preferredThreadCount` from
    // `/proc/cpuinfo` to count only perf cores and passes it here.
    if (nThreads > 0) {
        params.n_threads = nThreads;
    }

    LOGI("whisper_full: samples=%d language=%s translate=%d",
         (int) n, lang ? lang : "(null)", (int) translate);
    int rc = whisper_full(ctx, params, samples, (int) n);

    // whisper.cpp's built-in per-phase profile (load / mel / sample /
    // encode / decode / batchd / total). Goes to stderr, which our
    // Rust stderr forwarder routes into logcat as `RustStdoutStderr`
    // — searchable as `whisper_print_timings:` in `adb logcat`.
    // Tells us encoder-vs-decoder split per transcribe.
    whisper_print_timings(ctx);

    if (lang) env->ReleaseStringUTFChars(jlanguage, lang);
    env->ReleaseFloatArrayElements(jsamples, samples, JNI_ABORT);

    if (rc != 0) {
        LOGE("whisper_full returned %d", rc);
    }
    return (jint) rc;
}

// ---------------------------------------------------------------------
// Result inspection — segments + tokens, called after transcribe.
// ---------------------------------------------------------------------

JNIEXPORT jint JNICALL
Java_com_corpora_stt_WhisperContext_nativeNumSegments(
        JNIEnv * /*env*/,
        jobject /* thiz */,
        jlong ctxPtr) {
    if (ctxPtr == 0) return 0;
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    return (jint) whisper_full_n_segments(ctx);
}

JNIEXPORT jstring JNICALL
Java_com_corpora_stt_WhisperContext_nativeSegmentText(
        JNIEnv *env,
        jobject /* thiz */,
        jlong ctxPtr,
        jint segIdx) {
    if (ctxPtr == 0) return env->NewStringUTF("");
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    const char *t = whisper_full_get_segment_text(ctx, segIdx);
    return env->NewStringUTF(t ? t : "");
}

JNIEXPORT jfloat JNICALL
Java_com_corpora_stt_WhisperContext_nativeSegmentNoSpeechProb(
        JNIEnv * /*env*/,
        jobject /* thiz */,
        jlong ctxPtr,
        jint segIdx) {
    if (ctxPtr == 0) return 0.0f;
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    return whisper_full_get_segment_no_speech_prob(ctx, segIdx);
}

JNIEXPORT jint JNICALL
Java_com_corpora_stt_WhisperContext_nativeNumTokens(
        JNIEnv * /*env*/,
        jobject /* thiz */,
        jlong ctxPtr,
        jint segIdx) {
    if (ctxPtr == 0) return 0;
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    return (jint) whisper_full_n_tokens(ctx, segIdx);
}

JNIEXPORT jstring JNICALL
Java_com_corpora_stt_WhisperContext_nativeTokenText(
        JNIEnv *env,
        jobject /* thiz */,
        jlong ctxPtr,
        jint segIdx,
        jint tokIdx) {
    if (ctxPtr == 0) return env->NewStringUTF("");
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    const char *t = whisper_full_get_token_text(ctx, segIdx, tokIdx);
    return env->NewStringUTF(t ? t : "");
}

// Returns float[5] = { p, plog, t0_ms, t1_ms, id_token }.
// Matches the field set the iOS side reads off
// `whisper_full_get_token_data` via the C API.
JNIEXPORT jfloatArray JNICALL
Java_com_corpora_stt_WhisperContext_nativeTokenData(
        JNIEnv *env,
        jobject /* thiz */,
        jlong ctxPtr,
        jint segIdx,
        jint tokIdx) {
    if (ctxPtr == 0) return nullptr;
    auto *ctx = reinterpret_cast<struct whisper_context *>(ctxPtr);
    whisper_token_data td =
            whisper_full_get_token_data(ctx, segIdx, tokIdx);

    jfloatArray arr = env->NewFloatArray(5);
    if (!arr) return nullptr;
    jfloat vals[5];
    vals[0] = td.p;
    vals[1] = td.plog;
    vals[2] = (jfloat) td.t0;   // 10-ms units
    vals[3] = (jfloat) td.t1;   // 10-ms units
    vals[4] = (jfloat) td.id;   // token id
    env->SetFloatArrayRegion(arr, 0, 5, vals);
    return arr;
}

}  // extern "C"
