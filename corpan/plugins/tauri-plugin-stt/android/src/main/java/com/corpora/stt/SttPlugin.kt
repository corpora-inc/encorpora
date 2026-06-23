package com.corpora.stt

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.SystemClock
import android.util.Log
import androidx.core.app.ActivityCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.RandomAccessFile
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

// Android implementation of tauri-plugin-stt — Phase 1.
//
// Mirrors the Swift `WhisperManager` in `ios/Sources/STTPlugin.swift`.
// Same wire shapes, same model file layout, same HF base URL, same
// scoring math (see Scoring.kt).
//
// Logs use TAG "Whisper" so the dev-loop tail
// (`adb logcat -s Whisper:* WhisperJNI:*`) catches both this Kotlin
// side and the JNI shim.

private const val TAG = "Whisper"
private const val HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"
private const val DEFAULT_MODEL = "ggml-tiny.bin"
private const val MODELS_SUBDIR = "whisper-cpp/models"
private const val MARKER_SUBDIR = ".pronunciation-coach/installed"
private const val SAMPLE_RATE = 16_000
private const val LEADING_PAD_SAMPLES = 4_800   // 300 ms
private const val GGML_FILE_MAGIC = 0x67676d6c
private const val MIN_PLAUSIBLE_MODEL_BYTES = 1_000_000L
private const val MODEL_PROBE_BYTES = 4096

// Matches the `[_BEG_]`, `[_END_]`, `[_TT_50]`, `[_PT_*]` markers
// whisper.cpp emits when token_timestamps is on. Stripped from token
// text before word-grouping so they don't end up concatenated into the
// user's transcript ("4.[_TT_200]") or poison the per-token logprob
// stats.
private val SPECIAL_TOKEN_RE = Regex("\\[_[^]]*]")

/** Process-global state shared by every [SttPlugin] instance. The native
 *  whisper.cpp/ggml globals it coordinates are process-scoped, so their
 *  guard must be too — a per-instance lock left the cross-instance init
 *  race open (see the comment on [SttPlugin.nativeMutex]). */
private object WhisperNative {
    val mutex = Mutex()
    val instances = AtomicInteger(0)
    val processStartUptimeMs = SystemClock.elapsedRealtime()
    /** Payload of a prior native-init crash breadcrumb, read off disk by
     *  the first [SttPlugin] built this process and held here until
     *  getStatus() hands it to the JS analytics sink (which clears it).
     *  Process-global so it survives Activity recreation and is delivered
     *  exactly once regardless of which instance serves the getStatus call. */
    @Volatile var pendingInitCrash: String? = null
}

@InvokeArg
class PrepareArgs {
    var model: String? = null
}

@InvokeArg
class InstallArgs {
    var model: String? = null
    var onEvent: Channel? = null
    /** Optional override of the source URL. Used for models we host
     *  ourselves (community fine-tunes, self-quantized variants
     *  ggerganov doesn't publish). When null, the install path falls
     *  back to `HF_BASE + model`. */
    var downloadUrl: String? = null
}

@InvokeArg
class ValidateArgs {
    var model: String? = null
}

@InvokeArg
class WipeArgs {
    var model: String? = null
}

/**
 * Per-call whisper.cpp param overrides sent by the pack. Mirrors the
 * iOS `WhisperParamsArg` and the Rust `WhisperParams`. Field names
 * match `whisper_full_params` in whisper.h.
 *
 * All fields are nullable; any unset field falls back to the JNI's
 * library-default behavior. See `nativeFullTranscribe` for the
 * sentinel convention used to thread these through JNI without
 * boxed Java types.
 */
@InvokeArg
class WhisperParamsArg {
    var temperature: Float? = null
    var temperature_inc: Float? = null
    var entropy_thold: Float? = null
    var logprob_thold: Float? = null
    var no_speech_thold: Float? = null
    var suppress_blank: Boolean? = null
    var suppress_nst: Boolean? = null
    var n_threads: Int? = null
    /** Native-script primer fed to whisper.cpp as `initial_prompt`.
     *  Up to ~224 tokens; biases the decoder's first generated tokens
     *  toward the prompt's script and vocabulary. */
    var initial_prompt: String? = null
}

/**
 * Per-call scoring overrides applied on top of the native acoustic
 * ramp picked by `Scoring.pickAcousticRamp(modelName, baseLang)` and
 * the compression-ratio gate threshold. Every field nullable; null
 * means "use the native default for this slot." Mirrors the Swift
 * `ScoringParamsArg`, the Rust `ScoringParams`, and the JS
 * `ScoringParams` in `packs/pronunciation-coach/src/scoringTuning.ts`.
 *
 * Same wire-format gatekeeper rule as `WhisperParamsArg`: Gson drops
 * any field not declared on this class.
 */
@InvokeArg
class ScoringParamsArg {
    var avgZero: Float? = null
    var avgOne: Float? = null
    var minZero: Float? = null
    var minOne: Float? = null
    var textFloor: Float? = null
    var compressionThreshold: Float? = null
}

@InvokeArg
class StartSessionArgs {
    var sessionId: String = ""
    var language: String = ""
    var expectedText: String = ""
    /** Optional per-call overrides for `whisper_full_params`.
     *  Critical: same JSON-roundtrip gotcha as the Rust side — Gson
     *  ignores fields not declared here, so this property must exist
     *  for `whisperParams` to reach the native plugin. */
    var whisperParams: WhisperParamsArg? = null
    /** Optional per-call scoring overlay. Same wire-format gatekeeper
     *  rule — must be declared here to reach the native plugin. */
    var scoringParams: ScoringParamsArg? = null
}

@InvokeArg
class StopSessionArgs {
    var sessionId: String = ""
}

@InvokeArg
class CancelArgs {
    var sessionId: String = ""
}

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone"),
    ],
)
class SttPlugin(private val activity: Activity) : Plugin(activity) {

    private val context: Context = activity.applicationContext
    private val scope = CoroutineScope(Dispatchers.IO + Job())

    // Serializes ALL native whisper.cpp calls (init / transcribe / free).
    // whisper.cpp + ggml share process-global lazy state — the f16/f32
    // and type-trait tables, the CPU backend registry — initialized on
    // first use with no internal locking. Two concurrent inits race on
    // that state and SIGSEGV inside ggml_backend_sched_split_graph. A
    // load racing a free, or a free racing an in-flight transcribe, is a
    // use-after-free for the same reason.
    //
    // The lock MUST be process-global, not per-instance, because the
    // state it guards is process-global. 0.5.1 used a `private val
    // Mutex()`, which only serialized calls within ONE SttPlugin. On
    // Activity recreation (process-restore, low-memory restart, or a
    // config change outside our broad configChanges list) Tauri builds a
    // SECOND SttPlugin with its own mutex while the first instance's init
    // may still be running on a blocking JNI thread — cancellation is
    // cooperative and JNI ignores it (see onDestroy). Two instance-local
    // locks don't exclude each other, so the cross-instance init race
    // still crashed in the field even after 0.5.1 shipped. One shared
    // lock closes it.
    private val nativeMutex = WhisperNative.mutex

    /** 1-based ordinal of this SttPlugin within the process. >1 means the
     *  Activity was recreated — the cross-instance scenario above. */
    private val instanceOrdinal = WhisperNative.instances.incrementAndGet()

    @Volatile private var ctx: WhisperContext? = null
    @Volatile private var loadedModel: String? = null

    @Volatile private var recorder: AudioRecorder? = null
    @Volatile private var activeSessionId: String? = null
    @Volatile private var activeLanguage: String = ""
    @Volatile private var activeExpected: String = ""
    /** Per-call whisper.cpp overrides supplied by the pack via
     *  `startSession.whisperParams`. nil = no overrides this session. */
    @Volatile private var activeWhisperParams: WhisperParamsArg? = null
    /** Per-call scoring overrides (acoustic ramp + textFloor +
     *  compression threshold). nil = use the native ramps unchanged. */
    @Volatile private var activeScoringParams: ScoringParamsArg? = null
    @Volatile private var sessionStartedAt: Long = 0L
    private val freshInstallReadyAt = ConcurrentHashMap<String, Long>()

    init {
        if (instanceOrdinal > 1) {
            Log.w(TAG, "SttPlugin instance #$instanceOrdinal created — Activity was recreated. " +
                "Native lock is process-global, so cross-instance whisper init stays serialized.")
        }
        // A native SIGSEGV inside ggml init can't be caught in the JVM, so
        // the only way to observe it is a breadcrumb that outlives the
        // process: written just before nativeInitFromFile, deleted right
        // after. If it's still on disk now, the previous init never
        // returned — report and clear it.
        reportPriorInitCrash()
    }

    private val http: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    // ---------------------------------------------------------------
    // Paths + install marker (mirrors iOS)
    // ---------------------------------------------------------------

    private fun modelsDir(): File {
        val d = File(context.filesDir, MODELS_SUBDIR)
        if (!d.exists()) d.mkdirs()
        return d
    }

    private fun modelFile(name: String): File = File(modelsDir(), name)

    private fun markerDir(): File {
        val d = File(context.filesDir, MARKER_SUBDIR)
        if (!d.exists()) d.mkdirs()
        return d
    }

    private fun markerFile(name: String): File = File(markerDir(), "$name.marker")

    private fun writeInstallMarker(name: String) {
        try {
            markerFile(name).writeText(
                """{"installed":true,"model":"$name","verifiedBy":"ggml-probe-v2","writtenAt":"${System.currentTimeMillis()}"}"""
            )
        } catch (e: Exception) {
            Log.w(TAG, "failed to write install marker: ${e.message}")
        }
    }

    private fun removeInstallMarker(name: String) {
        markerFile(name).delete()
    }

    private fun installMarkerExists(name: String) = markerFile(name).exists()

    private fun validateModelInternal(name: String): List<String> {
        val problems = validateGgmlModelFile(modelFile(name))
        if (problems.isNotEmpty()) {
            if (installMarkerExists(name)) removeInstallMarker(name)
            return problems
        }
        if (!installMarkerExists(name)) writeInstallMarker(name)
        return emptyList()
    }

    // ---------------------------------------------------------------
    // Native-init safety: pre-load file sanity + crash breadcrumb
    // ---------------------------------------------------------------

    private fun initBreadcrumbFile(): File = File(markerDir(), "stt-init-inflight.json")

    private fun writeInitBreadcrumb(model: String) {
        try {
            initBreadcrumbFile().writeText(
                "{" +
                    "\"model\":\"$model\"," +
                    "\"instanceOrdinal\":$instanceOrdinal," +
                    "\"instancesCreated\":${WhisperNative.instances.get()}," +
                    "\"uptimeMs\":${SystemClock.elapsedRealtime() - WhisperNative.processStartUptimeMs}," +
                    "\"ts\":${System.currentTimeMillis()}" +
                    "}"
            )
        } catch (e: Exception) {
            Log.w(TAG, "failed to write init breadcrumb: ${e.message}")
        }
    }

    private fun clearInitBreadcrumb() {
        try {
            initBreadcrumbFile().delete()
        } catch (e: Exception) {
            Log.w(TAG, "failed to clear init breadcrumb: ${e.message}")
        }
    }

    /** Loud post-mortem for a native init that never returned (almost
     *  always an uncatchable SIGSEGV in whisper.cpp/ggml init). The
     *  breadcrumb's instanceOrdinal / instancesCreated / uptimeMs answer
     *  what the Play Console can't: cold launch vs Activity-recreate, and
     *  whether more than one plugin instance had been built by crash time. Left
     *  as one tagged line for the analytics layer to scrape later. */
    private fun reportPriorInitCrash() {
        val f = initBreadcrumbFile()
        if (!f.exists()) return
        val payload = try { f.readText() } catch (e: Exception) { "<unreadable: ${e.message}>" }
        Log.e(TAG, "STT_INIT_CRASH previous on-device whisper init did not complete " +
            "(probable native SIGSEGV in ggml init) context=$payload")
        // Stash for getStatus() to deliver into the JS on-device analytics
        // sink. The Log line above is for logcat/Play (which we can't pull
        // from a random user's device); this is the durable, harvestable
        // record. Held in process-global state so it's reported exactly once
        // even across Activity recreation.
        WhisperNative.pendingInitCrash = payload
        try { f.delete() } catch (_: Exception) {}
    }

    /** Cheap model-file sanity check before native whisper.cpp sees the file.
     *  Reads only the first and last 4 KiB: enough to reject HTML error pages,
     *  empty/truncated artifacts, unreadable files, and storage-layer readback
     *  failures without buffering a giant model in memory. */
    private fun validateGgmlModelFile(f: File, expectedBytes: Long? = null): List<String> {
        if (!f.exists()) return listOf("<model file missing>")
        if (!f.canRead()) return listOf("<model file unreadable>")
        val size = f.length()
        if (size < MIN_PLAUSIBLE_MODEL_BYTES) {
            return listOf("<model file too small: $size bytes>")
        }
        if (expectedBytes != null && expectedBytes > 0 && size != expectedBytes) {
            return listOf("<model file size mismatch: got $size of $expectedBytes bytes>")
        }
        return try {
            RandomAccessFile(f, "r").use { raf ->
                val b = ByteArray(4)
                if (raf.read(b) != 4) return@use listOf("<model file header unreadable>")
                // GGML_FILE_MAGIC 0x67676d6c, stored little-endian on disk.
                val magic = (b[0].toInt() and 0xff) or
                    ((b[1].toInt() and 0xff) shl 8) or
                    ((b[2].toInt() and 0xff) shl 16) or
                    ((b[3].toInt() and 0xff) shl 24)
                if (magic != GGML_FILE_MAGIC) {
                    return@use listOf("<bad ggml magic: ${String.format("0x%08x", magic)}>")
                }
                if (size > MODEL_PROBE_BYTES.toLong()) {
                    raf.seek(maxOf(0L, size - MODEL_PROBE_BYTES.toLong()))
                    val tail = ByteArray(MODEL_PROBE_BYTES)
                    val n = raf.read(tail)
                    if (n <= 0) return@use listOf("<model file tail unreadable>")
                }
                emptyList()
            }
        } catch (e: Exception) {
            listOf("<model file readback failed: ${e.message}>")
        }
    }

    /** The ONLY path that reaches native whisper init. MUST run while
     *  holding [nativeMutex]. Rejects a non-ggml file before native code
     *  sees it, then brackets the native call with the crash breadcrumb. */
    private fun loadGuarded(name: String, path: String): WhisperContext? {
        val problems = validateGgmlModelFile(File(path))
        if (problems.isNotEmpty()) {
            Log.e(TAG, "refusing to load $name: ${problems.joinToString(", ")}")
            return null
        }
        writeInitBreadcrumb(name)
        try {
            return WhisperContext.load(path)
        } finally {
            clearInitBreadcrumb()
        }
    }

    private fun postInstallSettleMs(name: String): Long {
        val size = modelFile(name).length()
        return when {
            size >= 1_200_000_000L -> 5_000L
            size >= 800_000_000L -> 4_000L
            size >= 500_000_000L -> 2_500L
            size >= 250_000_000L -> 1_250L
            else -> 400L
        }
    }

    private fun markFreshInstall(name: String) {
        val delayMs = postInstallSettleMs(name)
        freshInstallReadyAt[name] = SystemClock.elapsedRealtime() + delayMs
        Log.i(TAG, "fresh install cooldown: $name delayMs=$delayMs")
    }

    private fun waitForFreshInstallSettleIfNeeded(name: String) {
        val readyAt = freshInstallReadyAt[name] ?: return
        val remaining = readyAt - SystemClock.elapsedRealtime()
        if (remaining > 0L) {
            Log.i(TAG, "waiting for fresh install to settle: $name remainingMs=$remaining")
            Thread.sleep(remaining)
        }
        freshInstallReadyAt.remove(name)
    }

    private fun hasMicPermission(): Boolean {
        val s = ActivityCompat.checkSelfPermission(
            activity, Manifest.permission.RECORD_AUDIO
        )
        return s == PackageManager.PERMISSION_GRANTED
    }

    // ---------------------------------------------------------------
    // Commands
    // ---------------------------------------------------------------

    @Command
    fun isAvailable(invoke: Invoke) {
        // Rust expects raw `bool` — see comment on iOS side; using
        // resolveObject(true) emits bare JSON `true`, not
        // {"available":true}.
        //
        // Reflect the actual native-lib load status so the pack can
        // probe up front and route to a "not supported on this
        // device" screen before even offering a model. On x86_64
        // Chromebooks where libhoudini can't translate the
        // armv8.2-a SIMD intrinsics whisper.cpp is built with, this
        // returns false. NOTE: touching WhisperContext here triggers
        // its static initializer if it hasn't already run — which
        // is the *whole point* of the try/catch we added in that
        // companion `init` block. Throwing here is now impossible.
        invoke.resolveObject(WhisperContext.isAvailable())
    }

    @Command
    fun getStatus(invoke: Invoke) {
        val mi = ActivityManager.MemoryInfo()
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        am.getMemoryInfo(mi)

        val totalMB = (mi.totalMem / (1024 * 1024)).toInt()
        // Android has no honest per-app analog of iOS's
        // os_proc_available_memory(): largeMemoryClass is just the
        // Java heap cap (~512 MB) which has nothing to do with how
        // much RAM whisper.cpp can actually use via JNI native
        // allocations. mi.availMem (system-wide free RAM) is closer
        // to the iOS semantics — when Android pressures memory it
        // kills background apps to free it, so a "lots free" reading
        // means the foreground app has headroom.
        val systemFreeMB = (mi.availMem / (1024 * 1024)).toInt()

        val ret = JSObject()
        ret.put("available", WhisperContext.isAvailable())
        WhisperContext.unavailableReason?.let { ret.put("unavailableReason", it) }
        ret.put("prepared", ctx?.isAlive == true)
        loadedModel?.let { ret.put("model", it) }
        ret.put("recording", activeSessionId != null)
        ret.put("availableMemoryMB", systemFreeMB)
        ret.put("physicalMemoryMB", totalMB)
        // One-shot delivery of any prior native-init crash breadcrumb to the
        // app's on-device analytics (the host's getStatus wrapper records it).
        WhisperNative.pendingInitCrash?.let {
            ret.put("priorInitCrash", it)
            WhisperNative.pendingInitCrash = null
            Log.w(TAG, "delivering prior STT init-crash breadcrumb to analytics")
        }
        Log.i(TAG, "status() returning availableMemoryMB=$systemFreeMB physicalMemoryMB=$totalMB")
        invoke.resolve(ret)
    }

    @Command
    fun listInstalled(invoke: Invoke) {
        val arr = JSONArray()
        modelsDir().listFiles()?.forEach { f ->
            if (f.isFile && f.length() > 1_000_000) {
                val obj = JSObject()
                obj.put("model", f.name)
                obj.put("sizeBytes", f.length())
                arr.put(obj)
            }
        }
        val ret = JSObject()
        ret.put("installed", arr)
        invoke.resolve(ret)
    }

    @Command
    fun validateModel(invoke: Invoke) {
        val args = invoke.parseArgs(ValidateArgs::class.java)
        val name = args.model ?: DEFAULT_MODEL
        val problems = validateModelInternal(name)
        val ret = JSObject()
        ret.put("model", name)
        ret.put("valid", problems.isEmpty())
        val arr = JSONArray()
        problems.forEach { arr.put(it) }
        ret.put("problems", arr)
        invoke.resolve(ret)
    }

    @Command
    fun wipeModel(invoke: Invoke) {
        val args = invoke.parseArgs(WipeArgs::class.java)
        val name = args.model ?: DEFAULT_MODEL
        scope.launch {
            if (loadedModel == name) {
                nativeMutex.withLock {
                    if (loadedModel == name) {
                        ctx?.release(); ctx = null; loadedModel = null
                    }
                }
            }
            modelFile(name).delete()
            removeInstallMarker(name)
            Log.i(TAG, "wiped model + marker: $name")
            val ret = JSObject()
            ret.put("wiped", true)
            invoke.resolve(ret)
        }
    }

    @Command
    fun installModel(invoke: Invoke) {
        val args = invoke.parseArgs(InstallArgs::class.java)
        val name = args.model ?: DEFAULT_MODEL
        val channel = args.onEvent
        // Pack-supplied URL wins; otherwise fall back to HF base.
        val sourceUrl = args.downloadUrl?.takeIf { it.isNotEmpty() } ?: (HF_BASE + name)
        Log.i(TAG, "install requested: $name  url: $sourceUrl")

        // Bail BEFORE touching WhisperContext when the native lib
        // failed to load (e.g. x86_64 Chromebook with no matching
        // .so). Any reference to WhisperContext during prepare would otherwise
        // re-throw UnsatisfiedLinkError from the companion's
        // <clinit> — only fatal because Kotlin coroutines have no
        // default uncaught-exception handler that survives. We
        // surface this as a structured STT_UNAVAILABLE error so the
        // pack can render a clear "speech recognition not supported
        // on this device" message instead of crashing.
        if (!WhisperContext.isAvailable()) {
            val reason = WhisperContext.unavailableReason
                ?: "On-device speech recognition is not available on this device."
            Log.w(TAG, "installModel refused: native unavailable — $reason")
            channel?.send(installEvent(name, "failed", null, null, null, reason, "STT_UNAVAILABLE"))
            invoke.reject(reason, "STT_UNAVAILABLE", ex = null)
            return
        }

        if (validateModelInternal(name).isEmpty()) {
            channel?.send(installEvent(name, "verified", 1.0, null, null, null, null))
            val ret = JSObject()
            ret.put("installed", true); ret.put("model", name); ret.put("alreadyInstalled", true)
            invoke.resolve(ret)
            return
        }

        scope.launch {
            // Free any resident model before the (slow) download to keep
            // memory low. Serialized so it can't race an in-flight
            // transcribe/load on another coroutine.
            if (ctx != null) {
                nativeMutex.withLock {
                    if (ctx != null) {
                        Log.i(TAG, "dropping previous ctx before install: $loadedModel")
                        ctx?.release(); ctx = null; loadedModel = null
                    }
                }
            }
            channel?.send(installEvent(name, "downloading", 0.0, null, null, null, null))
            val dest = modelFile(name)
            try {
                downloadFile(sourceUrl, dest) { completed, total, fraction ->
                    channel?.send(installEvent(name, "downloading", fraction, completed, total, null, null))
                    Log.i(TAG, "install progress $name bytes: $completed / $total fraction: ${"%.3f".format(fraction)}")
                }
                Log.i(TAG, "download finished + file barrier passed: ${dest.absolutePath}")
                channel?.send(installEvent(name, "verifying", 1.0, null, null, null, null))
                val problems = validateModelInternal(name)
                if (problems.isEmpty()) {
                    markFreshInstall(name)
                    writeInstallMarker(name)
                    Log.i(TAG, "install verified on disk: $name")
                    channel?.send(installEvent(name, "verified", 1.0, null, null, null, null))
                    val ret = JSObject()
                    ret.put("installed", true); ret.put("model", name); ret.put("alreadyInstalled", false)
                    invoke.resolve(ret)
                } else {
                    val msg = "Model file downloaded but failed verification: ${problems.joinToString(", ")}"
                    Log.e(TAG, msg)
                    dest.delete(); removeInstallMarker(name)
                    channel?.send(installEvent(name, "failed", null, null, null, msg, "LOAD_FAILED"))
                    invoke.reject(msg, "LOAD_FAILED", ex = null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "install failed: ${e.message}", e)
                channel?.send(installEvent(name, "failed", null, null, null, e.message, "DOWNLOAD_FAILED"))
                invoke.reject(e.message ?: "Download failed", "DOWNLOAD_FAILED", ex = null)
            }
        }
    }

    private fun installEvent(
        model: String, phase: String,
        fraction: Double?, completed: Long?, total: Long?,
        error: String?, code: String?,
    ): JSObject {
        val o = JSObject()
        o.put("model", model); o.put("phase", phase)
        if (fraction != null) o.put("fraction", fraction)
        if (completed != null) o.put("completed", completed)
        if (total != null) o.put("total", total)
        if (error != null) o.put("error", error)
        if (code != null) o.put("code", code)
        return o
    }

    @Command
    fun prepare(invoke: Invoke) {
        val args = invoke.parseArgs(PrepareArgs::class.java)
        val name = args.model ?: DEFAULT_MODEL
        Log.i(TAG, "prepare requested (local-only): $name")

        // Same guard as installModel — refuse cleanly when the
        // native library couldn't load on this device. Without this,
        // the WhisperContext.load() call below would re-trigger the
        // companion <clinit> UnsatisfiedLinkError and SIGKILL the
        // app. STT_UNAVAILABLE is a recoverable JS-side error code.
        if (!WhisperContext.isAvailable()) {
            val reason = WhisperContext.unavailableReason
                ?: "On-device speech recognition is not available on this device."
            Log.w(TAG, "prepare refused: native unavailable — $reason")
            val ret = JSObject()
            ret.put("ready", false); ret.put("model", name)
            ret.put("message", reason)
            ret.put("code", "STT_UNAVAILABLE")
            invoke.resolve(ret); return
        }

        if (ctx?.isAlive == true && loadedModel == name) {
            val ret = JSObject(); ret.put("ready", true); ret.put("model", name)
            invoke.resolve(ret); return
        }

        scope.launch {
            nativeMutex.withLock {
                // Re-check under the lock: the fast-path guard above runs
                // before we acquire the mutex, so two near-simultaneous
                // prepare() calls can both reach here. If a sibling call
                // already loaded this exact model while we waited, just
                // report ready instead of redundantly reloading.
                if (ctx?.isAlive == true && loadedModel == name) {
                    val ret = JSObject(); ret.put("ready", true); ret.put("model", name)
                    invoke.resolve(ret); return@launch
                }

                val swappingModels = ctx != null && loadedModel != name
                if (swappingModels) {
                    Log.i(TAG, "unloading previous model before swap: $loadedModel")
                    memSnapshot("swap-before-unload: $loadedModel → $name")
                    ctx?.release(); ctx = null; loadedModel = null
                    // Give the kernel a beat to reclaim freed pages and
                    // hint System.gc to clean up any JNI peer objects.
                    // Android can't force malloc to release like iOS can,
                    // but the GC + brief settle keeps `availMem` honest
                    // for the headroom gate below.
                    System.gc()
                    Thread.sleep(150)
                    memSnapshot("swap-after-settle")
                }
                System.gc()
                Thread.sleep(150)
                memSnapshot("prepare-after-settle: $name")
                waitForFreshInstallSettleIfNeeded(name)
                memSnapshot("prepare-after-fresh-install-barrier: $name")
                val dest = modelFile(name)
                val problems = validateModelInternal(name)
                if (problems.isNotEmpty()) {
                    val ret = JSObject()
                    ret.put("ready", false); ret.put("model", name)
                    ret.put("message", "Model not installed: ${problems.joinToString(", ")}")
                    ret.put("code", "MODEL_NOT_INSTALLED")
                    invoke.resolve(ret); return@launch
                }

                // Memory-headroom gate. Mirror of the iOS check — refuse
                // to load if `availMem` is below the model file size *
                // 1.3 (working memory overhead). Pack routes
                // INSUFFICIENT_MEMORY into a "restart the app" recovery
                // overlay.
                val headroomError = checkMemoryHeadroom(dest)
                if (headroomError != null) {
                    Log.e(TAG, "load refused (INSUFFICIENT_MEMORY): $headroomError")
                    val ret = JSObject()
                    ret.put("ready", false); ret.put("model", name)
                    ret.put("message", headroomError)
                    ret.put("code", "INSUFFICIENT_MEMORY")
                    invoke.resolve(ret); return@launch
                }

                Log.i(TAG, "loading model from disk: $name")
                val loaded = loadGuarded(name, dest.absolutePath)
                if (loaded != null) {
                    ctx = loaded; loadedModel = name
                    writeInstallMarker(name)
                    Log.i(TAG, "loaded ok: $name")
                    val ret = JSObject(); ret.put("ready", true); ret.put("model", name)
                    invoke.resolve(ret)
                } else {
                    val ret = JSObject()
                    ret.put("ready", false); ret.put("model", name)
                    ret.put("message", "Load failed — model file may be corrupt")
                    ret.put("code", "LOAD_FAILED")
                    invoke.resolve(ret)
                }
            }
        }
    }

    /**
     * Snapshot the current memory state to the Android log so the
     * model-swap trajectory is reconstructable from logcat. iOS has
     * a sibling `sttMemSnapshot`; this gives us symmetric diagnostics
     * across platforms when a switch crashes.
     */
    private fun memSnapshot(label: String) {
        val mi = ActivityManager.MemoryInfo()
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        am.getMemoryInfo(mi)
        val availMB = mi.availMem / (1024 * 1024)
        val totalMB = mi.totalMem / (1024 * 1024)
        Log.i(TAG, "memSnapshot[$label]: availMB=$availMB totalMB=$totalMB lowMem=${mi.lowMemory}")
    }

    /**
     * Authoritative "can we safely load this model?" check, mirror of
     * iOS's checkMemoryHeadroom. Returns null when we have headroom,
     * or a human-readable explanation when we don't.
     */
    private fun checkMemoryHeadroom(modelFile: java.io.File): String? {
        val modelBytes = modelFile.length()
        if (modelBytes <= 0L) return null  // missing file — let MODEL_NOT_INSTALLED handle it
        val mi = ActivityManager.MemoryInfo()
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        am.getMemoryInfo(mi)
        val availableBytes = mi.availMem
        // 1.3× for whisper.cpp's working memory (mel filters, encoder
        // hidden states, KV cache, decoder buffers).
        val requiredBytes = (modelBytes.toDouble() * 1.3).toLong()
        val modelMB = modelBytes / (1024 * 1024)
        val availMB = availableBytes / (1024 * 1024)
        val reqMB = requiredBytes / (1024 * 1024)
        Log.i(TAG, "headroom check: modelMB=$modelMB requiredMB=$reqMB availableMB=$availMB lowMem=${mi.lowMemory}")
        if (availableBytes >= requiredBytes && !mi.lowMemory) return null
        return "Need ~$reqMB MB to load this model safely, but only $availMB MB is available right now. " +
            "Close other apps and restart Corpán, then try the switch again."
    }

    @Command
    fun unload(invoke: Invoke) {
        scope.launch {
            nativeMutex.withLock {
                if (ctx != null) {
                    Log.i(TAG, "unload — dropping in-memory ctx: $loadedModel")
                    ctx?.release(); ctx = null; loadedModel = null
                }
            }
            val ret = JSObject(); ret.put("unloaded", true)
            invoke.resolve(ret)
        }
    }

    // ---------------------------------------------------------------
    // Sessions — Phase 1
    // ---------------------------------------------------------------

    @Command
    fun startSession(invoke: Invoke) {
        val args = invoke.parseArgs(StartSessionArgs::class.java)
        Log.i(TAG, "startSession id: ${args.sessionId} lang: ${args.language} expected: ${args.expectedText.take(60)}")

        if (hasMicPermission()) {
            // Already granted. Fast path: no OS prompt, no extra tap.
            beginSession(invoke, args)
            return
        }

        // First time / previously-denied: ask the OS. Tauri's
        // permission helper shows the system prompt asynchronously and
        // resolves into `onMicPermissionResult` below — the JS-facing
        // `invoke` is held until then, so the pack just sees a single
        // "started" or "rejected" response, no double-tap dance.
        Log.i(TAG, "startSession: requesting RECORD_AUDIO via OS prompt")
        requestPermissionForAlias("microphone", invoke, "onMicPermissionResult")
    }

    @PermissionCallback
    fun onMicPermissionResult(invoke: Invoke) {
        if (!hasMicPermission()) {
            Log.w(TAG, "onMicPermissionResult: user denied RECORD_AUDIO")
            invoke.reject(
                "Microphone access is needed to score your pronunciation. Open Settings → Apps → Corpán → Permissions to allow it.",
                "MIC_PERMISSION_DENIED",
                ex = null,
            )
            return
        }
        Log.i(TAG, "onMicPermissionResult: granted; starting session")
        val args = invoke.parseArgs(StartSessionArgs::class.java)
        beginSession(invoke, args)
    }

    private fun beginSession(invoke: Invoke, args: StartSessionArgs) {
        if (ctx?.isAlive != true) {
            invoke.reject("Whisper not prepared", "NOT_PREPARED", ex = null)
            return
        }

        // Lazy-start the recorder; keep it warm between sessions to
        // dodge the ~hundreds-of-ms AudioRecord startup that would
        // clip the first word.
        if (recorder == null) {
            try {
                val r = AudioRecorder()
                r.start()
                // Forward per-buffer RMS to the WebView for client-side
                // silence detection. The closure captures `this`
                // (SttPlugin) — `recorder` is owned by the plugin so
                // the ref cycle is fine (released when the plugin is
                // torn down). Fires ~8 Hz only while recording.
                r.onLevel = { rms, samples ->
                    val payload = JSObject()
                    payload.put("rms", rms.toDouble())
                    payload.put("t", (samples * 1000L / AudioRecorder.TARGET_SAMPLE_RATE).toInt())
                    try {
                        trigger("audio_level", payload)
                    } catch (e: Throwable) {
                        Log.e(TAG, "trigger audio_level failed: ${e.message}", e)
                    }
                }
                recorder = r
            } catch (e: Throwable) {
                Log.e(TAG, "audio engine start failed: ${e.message}", e)
                invoke.reject("Mic init failed: ${e.message}", "MIC_INIT_FAILED", ex = null)
                return
            }
        }
        recorder?.startRecording()

        activeSessionId = args.sessionId
        activeLanguage = args.language
        activeExpected = args.expectedText
        activeWhisperParams = args.whisperParams
        activeScoringParams = args.scoringParams
        sessionStartedAt = System.currentTimeMillis()

        Log.i(TAG, "session started ok: ${args.sessionId}")
        val ret = JSObject()
        ret.put("started", true); ret.put("sessionId", args.sessionId)
        invoke.resolve(ret)
    }

    @Command
    fun stopSession(invoke: Invoke) {
        val args = invoke.parseArgs(StopSessionArgs::class.java)
        val sid = args.sessionId
        Log.i(TAG, "stopSession id: $sid")

        val rec = recorder
        if (rec == null || activeSessionId == null) {
            invoke.reject("No active session", "NO_SESSION", ex = null)
            return
        }

        val captured = rec.stopRecording()
        val language = activeLanguage
        val expected = activeExpected
        val overrides = activeWhisperParams
        val scoringOverrides = activeScoringParams
        val startedAt = sessionStartedAt
        activeSessionId = null
        activeWhisperParams = null
        activeScoringParams = null
        // Release the AudioRecord between sessions. Symmetric with
        // iOS — we used to keep it warm to skip the ~hundreds-of-ms
        // AudioRecord startup, but holding it open kept Android's
        // mic indicator on and the foreground-service mic notification
        // visible. The captured samples are already snapshotted into
        // `captured` above, so inference is unaffected by tearing
        // down the recorder now.
        rec.release()
        recorder = null

        val baseLang = Scoring.toBaseLang(language)
        if (!Scoring.supportedLanguages.contains(baseLang)) {
            invoke.reject(
                "Whisper doesn't support language '$baseLang' — pronunciation scoring isn't available for this language.",
                "UNSUPPORTED_LANGUAGE",
                ex = null,
            )
            return
        }

        val whisperCtx = ctx ?: run {
            invoke.reject("Whisper not prepared", "NOT_PREPARED", ex = null)
            return
        }

        scope.launch {
            val durationMs = (System.currentTimeMillis() - startedAt).toInt()
            Log.i(TAG, "transcribing samples: ${captured.size} duration_ms: $durationMs")

            // Prepend ~300 ms of silence to give whisper's mel
            // spectrogram a head start — same as iOS.
            val padded = FloatArray(LEADING_PAD_SAMPLES + captured.size)
            System.arraycopy(captured, 0, padded, LEADING_PAD_SAMPLES, captured.size)

            val nThreadsOverride = overrides?.n_threads?.takeIf { it > 0 }
            val nThreads = nThreadsOverride ?: WhisperCpuConfig.preferredThreadCount
            Log.i(TAG, "transcribe nThreads=$nThreads samples=${padded.size}" +
                (if (overrides != null) " overrides=yes" else " overrides=(none)"))
            // transcribe + collectResult must be one atomic region under
            // the native mutex: a release()/swap on another coroutine
            // between them would free the ctx we're reading results from.
            // (transcribe() itself no-ops to rc=-1 if the ctx was freed
            // before we acquired the lock — see WhisperContext.) Scoring
            // and JSON below run on pure data, so they stay outside.
            var rc: Int
            var mergedOrNull: Merged? = null
            nativeMutex.withLock {
                rc = withContext(Dispatchers.Default) {
                    whisperCtx.transcribe(padded, baseLang, nThreads, overrides)
                }
                if (rc == 0) mergedOrNull = collectResult(whisperCtx)
            }
            if (rc != 0) {
                invoke.reject("Whisper transcribe failed (rc=$rc)", "TRANSCRIBE_FAILED", ex = null)
                return@launch
            }
            val merged = mergedOrNull ?: run {
                invoke.reject("Whisper transcribe produced no result", "TRANSCRIBE_FAILED", ex = null)
                return@launch
            }
            val normHeard = Scoring.normalize(merged.text, baseLang)
            val normExp = Scoring.normalize(expected, baseLang)

            // Filter pure-digit / number-word entries out of the
            // acoustic-score input. Their per-word probabilities are
            // unreliable under the constrained decode (digit-vs-spelled
            // ambiguity — see `Scoring.isUncertainNumeralWord`).
            // Transcript scoring still catches them via normalize's
            // diez ↔ 10 mapping.
            val acousticWordProbs = merged.words
                .filter { !Scoring.isUncertainNumeralWord(it.word, baseLang) }
                .map { it.probability }

            val overlay = scoringOverrides?.let {
                Scoring.ScoringOverlay(
                    avgZero = it.avgZero,
                    avgOne = it.avgOne,
                    minZero = it.minZero,
                    minOne = it.minOne,
                    textFloor = it.textFloor,
                    compressionThreshold = it.compressionThreshold,
                )
            }
            val scores = Scoring.computeScores(
                wordProbs = acousticWordProbs,
                avgLogprob = merged.avgLogprob,
                normalizedTranscript = normHeard,
                normalizedExpected = normExp,
                modelName = loadedModel,
                baseLang = baseLang,
                tokenLogprobStdev = merged.tokenLogprobStdev,
                noSpeechProb = merged.noSpeechProb,
                compressionRatio = 0f, // whisper.cpp doesn't expose this; safe default
                temperature = 0f,
                scoringOverrides = overlay,
            )

            Log.i(TAG, "[stt-cal] lang(pack): $language | lang(whisper): $baseLang | heard: ${merged.text.take(80)} | expected: ${expected.take(80)}")
            Log.i(TAG, "[stt-cal] normHeard: ${normHeard.take(80)} | normExp: ${normExp.take(80)}")
            Log.i(TAG, "[stt-cal] wordCount: ${merged.words.size} | transcript: ${"%.2f".format(scores.transcript)} | acoustic: ${"%.2f".format(scores.acoustic)} | likelihood: ${"%.2f".format(scores.likelihood)} | overall: ${"%.2f".format(scores.overall)}")

            val ret = JSObject()
            ret.put("sessionId", sid)
            ret.put("text", merged.text)
            ret.put("expectedText", expected)
            ret.put("language", language)
            ret.put("whisperLanguage", baseLang)
            ret.put("durationMs", durationMs)
            ret.put("overallScore", scores.overall)
            ret.put("transcriptScore", scores.transcript)
            ret.put("likelihoodScore", scores.likelihood)
            ret.put("acousticScore", scores.acoustic)
            ret.put("avgLogprob", merged.avgLogprob)
            ret.put("noSpeechProb", merged.noSpeechProb)
            ret.put("compressionRatio", 0.0)
            ret.put("temperature", 0.0)
            ret.put("minTokenLogprob", merged.minTokenLogprob)
            ret.put("tokenLogprobStdev", merged.tokenLogprobStdev)
            ret.put("freeVsConstrainedSimilarity", 1.0)
            ret.put("freeText", merged.text)
            val wordsArr = JSONArray()
            for (w in merged.words) {
                val wo = JSObject()
                wo.put("word", w.word)
                wo.put("startMs", w.startMs)
                wo.put("endMs", w.endMs)
                wo.put("probability", w.probability)
                wordsArr.put(wo)
            }
            ret.put("words", wordsArr)
            invoke.resolve(ret)
        }
    }

    @Command
    fun cancelSession(invoke: Invoke) {
        Log.i(TAG, "cancelSession")
        // Same teardown as stopSession — release the recorder so the
        // mic indicator disappears immediately.
        recorder?.cancelRecording()
        recorder?.release()
        recorder = null
        activeSessionId = null
        activeWhisperParams = null
        activeScoringParams = null
        invoke.resolve()
    }

    /**
     * Release the AudioRecord entirely. Called when the pack closes
     * so Android stops showing the in-use mic indicator and frees
     * the system audio resource. Symmetric with iOS `releaseAudio`,
     * which tears down AVAudioEngine + AVAudioSession.
     */
    @Command
    fun releaseAudio(invoke: Invoke) {
        Log.i(TAG, "releaseAudio (pack closing — tearing down recorder)")
        recorder?.cancelRecording()
        recorder?.release()
        recorder = null
        activeSessionId = null
        activeWhisperParams = null
        activeScoringParams = null
        invoke.resolve()
    }

    // ---------------------------------------------------------------
    // Result extraction (mirrors iOS MergedResult builder)
    // ---------------------------------------------------------------

    private data class Word(
        val word: String,
        val startMs: Int,
        val endMs: Int,
        val probability: Float,
    )

    private data class Merged(
        val text: String,
        val avgLogprob: Float,
        val words: List<Word>,
        val noSpeechProb: Float,
        val minTokenLogprob: Float,
        val tokenLogprobStdev: Float,
    )

    private fun collectResult(ctx: WhisperContext): Merged {
        val n = ctx.numSegments()
        val sb = StringBuilder()
        var maxNoSpeech = 0f
        val words = ArrayList<Word>()
        val allLogprobs = ArrayList<Float>()

        // Word grouping: tokens with leading-space text start a new
        // word. Special tokens (`<|...|>`, `[_*_]`) are filtered
        // BEFORE adding to logprobs — including them poisons the
        // per-token stdev calc.
        var curWordText = StringBuilder()
        var curWordProbs = ArrayList<Float>()
        var curStartMs = -1
        var curEndMs = -1

        fun flushWord() {
            if (curWordText.isEmpty() || curWordProbs.isEmpty()) {
                curWordText.clear(); curWordProbs.clear()
                curStartMs = -1; curEndMs = -1
                return
            }
            val w = curWordText.toString().trim()
            // Skip pure-punctuation chunks (no letters/digits).
            val hasLetter = w.any { it.isLetterOrDigit() }
            if (hasLetter) {
                val avg = curWordProbs.sum() / curWordProbs.size
                Log.i(TAG, "word: [$w] probs=${curWordProbs.joinToString(",") { "%.2f".format(it) }} avg=${"%.2f".format(avg)}")
                words.add(Word(w, curStartMs.coerceAtLeast(0), curEndMs.coerceAtLeast(0), avg))
            }
            curWordText.clear(); curWordProbs.clear()
            curStartMs = -1; curEndMs = -1
        }

        for (s in 0 until n) {
            sb.append(ctx.segmentText(s))
            val nsp = ctx.segmentNoSpeechProb(s)
            if (nsp > maxNoSpeech) maxNoSpeech = nsp

            val tn = ctx.numTokens(s)
            for (t in 0 until tn) {
                val rawTxt = ctx.tokenText(s, t)
                if (rawTxt.isEmpty()) continue
                if (rawTxt.startsWith("<|") && rawTxt.endsWith("|>")) continue
                // Whisper.cpp's BPE will sometimes pack a control
                // marker into the same token as adjacent text — e.g.
                // "4.[_TT_200]". A strict prefix-and-suffix check
                // misses these. Strip any [_..._] runs and re-check
                // for empty.
                val txt = SPECIAL_TOKEN_RE.replace(rawTxt, "")
                if (txt.isEmpty() || txt.isBlank()) continue
                val data = ctx.tokenData(s, t) ?: continue
                val p = data[0]
                val plog = data[1]
                val t0_10ms = data[2].toInt()
                val t1_10ms = data[3].toInt()
                // Only count tokens with at least one letter/digit toward
                // the per-token logprob stats. Pure-punctuation tokens
                // (".", ",", "!", "?") have widely-varying logprobs that
                // inflate `tokenLogprobStdev` and falsely trigger the
                // `acoustic *= 0.5` penalty in `Scoring.computeScores`.
                // We already skip pure-punctuation chunks at the per-word
                // level in `flushWord()`; this brings the stdev calc in
                // line with that.
                if (txt.any { it.isLetterOrDigit() }) {
                    allLogprobs.add(plog)
                }

                // Whisper marks word boundaries with a leading ASCII
                // space on the new word's first token. The very first
                // word also flushes (curWordText empty).
                val isWordStart = txt.startsWith(" ") || curWordText.isEmpty()
                if (isWordStart) {
                    flushWord()
                    curStartMs = t0_10ms * 10
                }
                curWordText.append(txt)
                // Only count letter/digit tokens toward the per-word
                // probability average. Whisper often appends a
                // punctuation token (".", "!", "?") onto the previous
                // word with widely-varying prob (e.g. "gusto!" =
                // ["gusto" 0.97, "!" 0.38] gave avg 0.68); the
                // punctuation prob has no pronunciation meaning and
                // was dragging the per-word avg down on clean speech.
                // The text still gets appended so the displayed word
                // keeps its punctuation; only the score input changes.
                if (txt.any { it.isLetterOrDigit() }) {
                    curWordProbs.add(p)
                }
                curEndMs = t1_10ms * 10
            }
        }
        flushWord()

        val avgLogprob = if (allLogprobs.isEmpty()) 0f
        else allLogprobs.sum() / allLogprobs.size
        val minLogprob = allLogprobs.minOrNull() ?: 0f
        val stdev = Scoring.stdev(allLogprobs)

        return Merged(
            text = sb.toString(),
            avgLogprob = avgLogprob,
            words = words,
            noSpeechProb = maxNoSpeech,
            minTokenLogprob = minLogprob,
            tokenLogprobStdev = stdev,
        )
    }

    // ---------------------------------------------------------------
    // Download helper
    // ---------------------------------------------------------------

    private suspend fun downloadFile(
        url: String, dest: File,
        onProgress: (completed: Long, total: Long, fraction: Double) -> Unit,
    ) = withContext(Dispatchers.IO) {
        val req = Request.Builder().url(url).build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) throw IOException("HTTP ${resp.code} from $url")
            val body = resp.body ?: throw IOException("empty body from $url")
            val total = body.contentLength()
            val tmp = File(dest.parentFile, "${dest.name}.part")
            tmp.delete()
            var completed = 0L
            FileOutputStream(tmp).use { out ->
                body.byteStream().use { input ->
                    val buf = ByteArray(64 * 1024)
                    var lastReport = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        completed += n
                        val now = System.currentTimeMillis()
                        if (now - lastReport > 250 || completed == total) {
                            val frac = if (total > 0) completed.toDouble() / total else 0.0
                            onProgress(completed, total, frac)
                            lastReport = now
                        }
                    }
                }
                out.fd.sync()
            }
            // Completeness gate. When the server advertised a Content-Length
            // (total > 0), a clean end-of-stream before we've read that many
            // bytes is a TRUNCATED download — a dropped connection, or a CDN
            // closing the socket early. OkHttp surfaces this as a normal EOF
            // (input.read() == -1), NOT an exception, so without this check
            // the short .part would be renamed into place, sail through the
            // 4-byte ggml magic test, and then SIGSEGV deep inside
            // whisper_init_state when native code reads tensor data past the
            // real end of file. Fail loudly here instead; installModel's catch
            // surfaces a clean, retryable DOWNLOAD_FAILED. (total <= 0 means
            // the server sent no Content-Length — nothing to compare against,
            // so we fall through and let the post-download ggml probe catch a
            // bad file before native init sees it.)
            if (total > 0 && completed != total) {
                tmp.delete()
                throw IOException("truncated download from $url: got $completed of $total bytes")
            }
            if (dest.exists() && !dest.delete()) {
                tmp.delete()
                throw IOException("failed to replace existing ${dest.absolutePath}")
            }
            if (!tmp.renameTo(dest)) {
                tmp.delete()
                throw IOException("failed to move temp file to ${dest.absolutePath}")
            }
            val problems = validateGgmlModelFile(dest, expectedBytes = total.takeIf { it > 0 })
            if (problems.isNotEmpty()) {
                dest.delete()
                throw IOException("downloaded model failed file verification: ${problems.joinToString(", ")}")
            }
        }
    }

    // ---------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------

    override fun onPause() {
        super.onPause()
    }

    override fun onDestroy() {
        scope.cancel()
        recorder?.release(); recorder = null
        // Free the model only if no native op is in flight. A transcribe
        // running on a Dispatchers.Default thread can't be interrupted by
        // scope.cancel() (cancellation is cooperative; a blocking JNI call
        // ignores it) and still holds nativeMutex — releasing the ctx
        // underneath it would be a use-after-free, and blocking the main
        // thread here to wait would ANR. If we can't grab the lock, skip
        // the release: the process is tearing down and the OS reclaims it.
        if (nativeMutex.tryLock()) {
            try { ctx?.release() } finally { nativeMutex.unlock() }
        } else {
            Log.w(TAG, "onDestroy: native whisper op in flight — skipping ctx.release(); OS reclaims on teardown")
        }
        ctx = null
        super.onDestroy()
    }
}
