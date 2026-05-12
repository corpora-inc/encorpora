package com.corpora.stt

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
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
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

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

// Matches the `[_BEG_]`, `[_END_]`, `[_TT_50]`, `[_PT_*]` markers
// whisper.cpp emits when token_timestamps is on. Stripped from token
// text before word-grouping so they don't end up concatenated into the
// user's transcript ("4.[_TT_200]") or poison the per-token logprob
// stats.
private val SPECIAL_TOKEN_RE = Regex("\\[_[^]]*]")

@InvokeArg
class PrepareArgs {
    var model: String? = null
}

@InvokeArg
class InstallArgs {
    var model: String? = null
    var onEvent: Channel? = null
}

@InvokeArg
class ValidateArgs {
    var model: String? = null
}

@InvokeArg
class WipeArgs {
    var model: String? = null
}

@InvokeArg
class StartSessionArgs {
    var sessionId: String = ""
    var language: String = ""
    var expectedText: String = ""
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

    @Volatile private var ctx: WhisperContext? = null
    @Volatile private var loadedModel: String? = null

    @Volatile private var recorder: AudioRecorder? = null
    @Volatile private var activeSessionId: String? = null
    @Volatile private var activeLanguage: String = ""
    @Volatile private var activeExpected: String = ""
    @Volatile private var sessionStartedAt: Long = 0L

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
                """{"installed":true,"model":"$name","writtenAt":"${System.currentTimeMillis()}"}"""
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
        val f = modelFile(name)
        if (!f.exists()) {
            if (installMarkerExists(name)) removeInstallMarker(name)
            return listOf("<model file missing>")
        }
        val size = f.length()
        if (size < 1_000_000) {
            if (installMarkerExists(name)) removeInstallMarker(name)
            return listOf("<model file too small: $size bytes>")
        }
        if (!installMarkerExists(name)) writeInstallMarker(name)
        return emptyList()
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
        invoke.resolveObject(true)
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
        ret.put("available", true)
        ret.put("prepared", ctx?.isAlive == true)
        loadedModel?.let { ret.put("model", it) }
        ret.put("recording", activeSessionId != null)
        ret.put("availableMemoryMB", systemFreeMB)
        ret.put("physicalMemoryMB", totalMB)
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
        if (loadedModel == name) {
            ctx?.release()
            ctx = null
            loadedModel = null
        }
        modelFile(name).delete()
        removeInstallMarker(name)
        Log.i(TAG, "wiped model + marker: $name")
        val ret = JSObject()
        ret.put("wiped", true)
        invoke.resolve(ret)
    }

    @Command
    fun installModel(invoke: Invoke) {
        val args = invoke.parseArgs(InstallArgs::class.java)
        val name = args.model ?: DEFAULT_MODEL
        val channel = args.onEvent
        Log.i(TAG, "install requested: $name")

        if (validateModelInternal(name).isEmpty()) {
            channel?.send(installEvent(name, "verified", 1.0, null, null, null, null))
            val ret = JSObject()
            ret.put("installed", true); ret.put("model", name); ret.put("alreadyInstalled", true)
            invoke.resolve(ret)
            return
        }

        if (ctx != null) {
            Log.i(TAG, "dropping previous ctx before install: $loadedModel")
            ctx?.release(); ctx = null; loadedModel = null
        }

        scope.launch {
            channel?.send(installEvent(name, "downloading", 0.0, null, null, null, null))
            val dest = modelFile(name)
            try {
                downloadFile(HF_BASE + name, dest) { completed, total, fraction ->
                    channel?.send(installEvent(name, "downloading", fraction, completed, total, null, null))
                    Log.i(TAG, "install progress $name bytes: $completed / $total fraction: ${"%.3f".format(fraction)}")
                }
                Log.i(TAG, "download finished: ${dest.absolutePath}")
                channel?.send(installEvent(name, "verifying", 1.0, null, null, null, null))
                Log.i(TAG, "running whisper.cpp load test: $name")
                val loaded = WhisperContext.load(dest.absolutePath)
                if (loaded != null) {
                    ctx = loaded; loadedModel = name
                    writeInstallMarker(name)
                    Log.i(TAG, "install + load test ok: $name")
                    channel?.send(installEvent(name, "verified", 1.0, null, null, null, null))
                    val ret = JSObject()
                    ret.put("installed", true); ret.put("model", name); ret.put("alreadyInstalled", false)
                    invoke.resolve(ret)
                } else {
                    val msg = "Model file downloaded but failed to load. The download was probably truncated."
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

        if (ctx?.isAlive == true && loadedModel == name) {
            val ret = JSObject(); ret.put("ready", true); ret.put("model", name)
            invoke.resolve(ret); return
        }

        scope.launch {
            if (ctx != null && loadedModel != name) {
                Log.i(TAG, "unloading previous model before swap: $loadedModel")
                ctx?.release(); ctx = null; loadedModel = null
            }
            val dest = modelFile(name)
            if (!dest.exists()) {
                val ret = JSObject()
                ret.put("ready", false); ret.put("model", name)
                ret.put("message", "Model not installed")
                ret.put("code", "MODEL_NOT_INSTALLED")
                invoke.resolve(ret); return@launch
            }
            Log.i(TAG, "loading model from disk: $name")
            val loaded = WhisperContext.load(dest.absolutePath)
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

    @Command
    fun unload(invoke: Invoke) {
        if (ctx != null) {
            Log.i(TAG, "unload — dropping in-memory ctx: $loadedModel")
            ctx?.release(); ctx = null; loadedModel = null
        }
        val ret = JSObject(); ret.put("unloaded", true)
        invoke.resolve(ret)
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
        val startedAt = sessionStartedAt
        activeSessionId = null

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

            val nThreads = WhisperCpuConfig.preferredThreadCount
            Log.i(TAG, "transcribe nThreads=$nThreads samples=${padded.size}")
            val rc = withContext(Dispatchers.Default) {
                whisperCtx.transcribe(padded, baseLang, nThreads)
            }
            if (rc != 0) {
                invoke.reject("Whisper transcribe failed (rc=$rc)", "TRANSCRIBE_FAILED", ex = null)
                return@launch
            }

            val merged = collectResult(whisperCtx)
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
        recorder?.cancelRecording()
        activeSessionId = null
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
            tmp.outputStream().use { out ->
                body.byteStream().use { input ->
                    val buf = ByteArray(64 * 1024)
                    var completed = 0L
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
            }
            if (!tmp.renameTo(dest)) {
                tmp.delete()
                throw IOException("failed to move temp file to ${dest.absolutePath}")
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
        ctx?.release(); ctx = null
        super.onDestroy()
    }
}
