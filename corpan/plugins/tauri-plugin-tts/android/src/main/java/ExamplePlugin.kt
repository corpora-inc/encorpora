package space.httpjames.tauri_plugin_tts

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs
import kotlin.math.ln

private const val TAG = "CorpanTts"
private const val INIT_TIMEOUT_MS = 5_000L

/** Common third-party TTS engine packages we want visibility into for diagnosis. */
private val WELL_KNOWN_TTS_PACKAGES = listOf(
    "com.google.android.tts",
    "com.samsung.SMT",
    "com.iflytek.speechcloud",
    "com.acapelagroup.android.tts",
)

internal enum class InitState { PENDING, READY, FAILED }

/* -------------------------------------------------------------------------- */
/*                           Rate mapping (web → Android)                     */
/* -------------------------------------------------------------------------- */

private fun mapWebRateToAndroid(
  webRate: Float,
  targetMax: Float = 1.45f // default: keeps fast side compressed unless you override
): Float {
  val W_MIN = 0.10f
  val W_DEF = 1.00f
  val W_MAX = 1.50f

  val A_MIN = 0.10f
  val A_DEF = 1.00f
  val A_MAX = targetMax

  val pad = 0.02f * (A_MAX - A_MIN)
  val lo = A_MIN + pad
  val hi = A_MAX - pad

  val w = webRate.coerceIn(W_MIN, W_MAX)
  if (abs(w - W_DEF) < 1e-6f) return A_DEF

  return if (w < W_DEF) {
    // keep the "slow" curve gentle
    val t = (ln((w / W_MIN).toDouble()) / ln((W_DEF / W_MIN).toDouble())).toFloat()
    lo + t * (A_DEF - lo)
  } else {
    // compress fast side harder
    var t = (ln((w / W_DEF).toDouble()) / ln((W_MAX / W_DEF).toDouble())).toFloat()
    t *= t * t // cubic
    A_DEF + t * (hi - A_DEF)
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Args                                     */
/* -------------------------------------------------------------------------- */

private const val GOOGLE_TTS_PACKAGE = "com.google.android.tts"

@InvokeArg
internal class SpeakArgs {
  lateinit var text: String
  var language: String? = null    // BCP-47, e.g. "fa-IR"
  var rate: Float? = null         // 0.1–1.5
  var voiceId: String? = null     // Voice.name (camel)
  var voice_id: String? = null    // Voice.name (snake)
}

@InvokeArg
internal class EngineStoreArgs {
  var packageName: String? = null
  var package_name: String? = null
}

@InvokeArg
internal class BindEngineArgs {
  var packageName: String? = null
  var package_name: String? = null
}

@InvokeArg
internal class AppDetailsArgs {
  var packageName: String? = null
  var package_name: String? = null
}

@InvokeArg
internal class InstallVoiceDataArgs {
  var language: String? = null
}

@InvokeArg
internal class SpeakConcurrentArgs {
  lateinit var text: String
  var language: String? = null    // BCP-47, e.g. "fa-IR"
  var rate: Float? = null         // 0.1–1.5
  var voiceId: String? = null     // Voice.name (camel)
  var voice_id: String? = null    // Voice.name (snake)
}

/* -------------------------------------------------------------------------- */
/*                                   Plugin                                   */
/* -------------------------------------------------------------------------- */

@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {

  private var tts: TextToSpeech? = null
  private var initState: InitState = InitState.PENDING
  private var currentEngineKey: String? = null
  private val pendingActions = mutableListOf<() -> Unit>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private var initTimeoutPosted = false
  private val initTimeoutRunnable = Runnable {
    if (initState == InitState.PENDING) {
      Log.w(TAG, "init timed out after ${INIT_TIMEOUT_MS}ms")
      initState = InitState.FAILED
      val event = JSObject().apply {
        put("error", "init_timeout")
        put("reason", "init_timeout")
      }
      trigger("ttsError", event)
      drainPendingFailed("INIT_TIMEOUT: TTS engine did not initialize")
    }
    initTimeoutPosted = false
  }

  // Voice caching for performance (avoid repeated expensive voice enumeration)
  private var voiceCache: List<Voice>? = null
  private var voiceCacheTime: Long = 0
  private val VOICE_CACHE_TTL = 30_000L // 30 seconds like iOS

  // Counter for generating utterance IDs
  private val utteranceIdCounter = AtomicLong(0)

  override fun load(webView: WebView) {
    Log.i(TAG, "plugin load() — kicking off TTS init")
    initializeTTS(null)
  }

  /**
   * Construct the underlying TextToSpeech instance.
   * Optionally targets a specific engine package — useful for fallback/recovery.
   */
  private fun initializeTTS(engineKey: String?) {
    // If already pending and same target, no-op (avoid duplicate inits).
    if (tts != null && initState == InitState.PENDING && currentEngineKey == engineKey) return

    // Tear down any existing instance before re-initing.
    if (tts != null) {
      try { tts?.shutdown() } catch (_: Throwable) {}
      tts = null
    }
    voiceCache = null
    voiceCacheTime = 0
    initState = InitState.PENDING
    currentEngineKey = engineKey

    Log.i(TAG, "initializeTTS engine=${engineKey ?: "<default>"}")

    val listener = TextToSpeech.OnInitListener { status ->
      // Cancel timeout regardless of result.
      cancelInitTimeout()
      if (status == TextToSpeech.SUCCESS) {
        initState = InitState.READY
        val realEngine = try { tts?.defaultEngine } catch (_: Throwable) { null }
        // Track whichever engine actually ended up bound (when no override given).
        if (currentEngineKey == null) currentEngineKey = realEngine
        Log.i(TAG, "init success: bound engine=${currentEngineKey ?: realEngine ?: "<unknown>"}")
        val event = JSObject().apply {
          put("initialized", true)
          put("engine", currentEngineKey ?: JSONObject.NULL)
        }
        trigger("ttsInitialized", event)
        drainPending()
      } else {
        initState = InitState.FAILED
        Log.w(TAG, "init failed with status=$status engine=${engineKey ?: "<default>"}")
        val event = JSObject().apply {
          put("error", "init_failed")
          put("reason", "status_$status")
          put("engine", engineKey ?: JSONObject.NULL)
        }
        trigger("ttsError", event)
        drainPendingFailed("INIT_FAILED: status $status")
      }
    }

    tts = if (engineKey != null) {
      TextToSpeech(activity, listener, engineKey)
    } else {
      TextToSpeech(activity, listener)
    }
    postInitTimeout()
  }

  private fun postInitTimeout() {
    if (initTimeoutPosted) return
    initTimeoutPosted = true
    mainHandler.postDelayed(initTimeoutRunnable, INIT_TIMEOUT_MS)
  }

  private fun cancelInitTimeout() {
    if (!initTimeoutPosted) return
    mainHandler.removeCallbacks(initTimeoutRunnable)
    initTimeoutPosted = false
  }

  /**
   * Run [action] now if init succeeded. If still pending, queue.
   * If init has failed, attempt one re-init transparently and queue.
   */
  private fun ensureReady(action: () -> Unit) {
    when (initState) {
      InitState.READY -> {
        if (tts != null) action() else {
          // Defensive: instance went away somehow — re-init
          pendingActions.add(action)
          initializeTTS(currentEngineKey)
        }
      }
      InitState.PENDING -> pendingActions.add(action)
      InitState.FAILED -> {
        Log.i(TAG, "ensureReady: prior init failed, attempting re-init")
        pendingActions.add(action)
        initializeTTS(currentEngineKey)
      }
    }
  }

  private fun drainPending() {
    val actions = ArrayList(pendingActions)
    pendingActions.clear()
    actions.forEach { it.invoke() }
  }

  private fun drainPendingFailed(reason: String) {
    val actions = ArrayList(pendingActions)
    pendingActions.clear()
    if (actions.isNotEmpty()) {
      Log.w(TAG, "draining ${actions.size} pending actions with failure: $reason")
    }
    // We can't directly access the original Invoke from here, so just drop.
    // The `ensureReady` callers all check `tts == null` and reject themselves.
    // For new commands (probe / bindEngine) we surface failure via their own paths.
    // Keeping this method as a hook for future expansion.
  }

  /* ------------------------------- Helpers -------------------------------- */

  private fun baseLang(tag: String?): String? {
    if (tag.isNullOrBlank()) return null
    val t = tag.lowercase(Locale.ROOT)
    val i = t.indexOf('-')
    return if (i == -1) t else t.substring(0, i)
  }

  private fun localeMatches(voice: Voice, langTag: String?): Int {
    if (langTag.isNullOrBlank()) return 0
    val wantLc = langTag.lowercase(Locale.ROOT)
    val base = baseLang(wantLc)
    val vTag = voice.locale?.toLanguageTag()?.lowercase(Locale.ROOT) ?: return 0
    return when {
      vTag == wantLc -> 3
      base != null && (vTag == base || vTag.startsWith("$base-")) -> 2
      else -> 0
    }
  }

  // Get cached voices or fetch fresh if cache expired (performance optimization)
  private fun getCachedVoices(tts: TextToSpeech): List<Voice> {
    val now = System.currentTimeMillis()
    if (voiceCache == null || now - voiceCacheTime > VOICE_CACHE_TTL) {
      voiceCache = tts.voices?.toList()?.filter { voice ->
        // Filter out low-quality voices
        voice.quality >= Voice.QUALITY_NORMAL
      }?.sortedWith(
        compareByDescending<Voice> { it.quality }
          .thenBy { it.latency }
          .thenBy { it.name }
      ) ?: emptyList()
      voiceCacheTime = now
    }
    return voiceCache ?: emptyList()
  }

  private fun chooseBestVoiceForLanguage(tts: TextToSpeech, langTag: String): Voice? {
    // Use cached voices for performance
    val voices = getCachedVoices(tts)
    return voices
      .sortedWith(
        compareByDescending<Voice> { localeMatches(it, langTag) }
          .thenBy { it.isNetworkConnectionRequired }   // offline-first, but don't reject network
          .thenByDescending { it.quality }
          .thenBy { it.latency }
          .thenBy { it.name }
      )
      .firstOrNull()
  }

  private fun findVoiceById(tts: TextToSpeech, voiceId: String): Voice? {
    // Use cached voices for performance
    val voices = getCachedVoices(tts)
    return voices.firstOrNull { it.name == voiceId }
  }

  private fun currentEngine(tts: TextToSpeech?): String? =
    try { tts?.defaultEngine } catch (_: Throwable) { null }

  /* ------------------------------- Commands -------------------------------- */

  @Command
  fun speak(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(SpeakArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }

    ensureReady {
      val t = tts
      if (t == null) {
        invoke.reject("TTS not initialized")
        return@ensureReady
      }

      try {
        val resolvedVoiceId = args.voiceId ?: args.voice_id
        val chosenVoice: Voice? = when {
          !resolvedVoiceId.isNullOrBlank() -> findVoiceById(t, resolvedVoiceId)
          !args.language.isNullOrBlank() -> chooseBestVoiceForLanguage(t, args.language!!)
          else -> null
        }

        if (chosenVoice != null) {
          val setOk = t.setVoice(chosenVoice)
          if (setOk != TextToSpeech.SUCCESS) {
            invoke.reject("Failed to set voice: ${chosenVoice.name}")
            return@ensureReady
          }
        } else if (!args.language.isNullOrBlank()) {
          val res = t.setLanguage(Locale.forLanguageTag(args.language))
          if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
            invoke.reject("Language not supported or missing data: ${args.language}")
            return@ensureReady
          }
        }

        // You can override targetMax to 3.0f at call site if you want
        val androidRate = mapWebRateToAndroid(args.rate ?: 1.0f, targetMax = 3.0f)
        t.setSpeechRate(androidRate)

        val utteranceId = UUID.randomUUID().toString()
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(utteranceId: String?) {
            val event = JSObject().apply {
              put("status", "started")
              put("utteranceId", utteranceId ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          override fun onDone(utteranceId: String?) {
            val event = JSObject().apply {
              put("status", "ended")
              put("utteranceId", utteranceId ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          @Suppress("DEPRECATION")
          override fun onError(utteranceId: String?) {
            val event = JSObject().apply {
              put("status", "error")
              put("utteranceId", utteranceId ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          override fun onError(utteranceId: String?, errorCode: Int) {
            val event = JSObject().apply {
              put("status", "error")
              put("utteranceId", utteranceId ?: JSONObject.NULL)
              put("errorCode", errorCode)
            }
            trigger("ttsStatus", event)
          }
        })

        val res = t.speak(args.text, TextToSpeech.QUEUE_ADD, null, utteranceId)
        if (res == TextToSpeech.ERROR) {
          invoke.reject("Failed to queue speech")
        } else {
          invoke.resolve()
        }
      } catch (e: Exception) {
        invoke.reject(e.message ?: "Unknown error")
      }
    }
  }

  /**
   * speakConcurrent on Android: Due to platform limitations, Android's TTS service
   * serializes all utterances regardless of client instances. This implementation
   * uses QUEUE_ADD (same as speak) but returns an utterance ID for API compatibility
   * with platforms that support true concurrency (macOS/iOS).
   */
  @Command
  fun speakConcurrent(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(SpeakConcurrentArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }

    ensureReady {
      val t = tts
      if (t == null) {
        invoke.reject("TTS not initialized")
        return@ensureReady
      }

      try {
        val resolvedVoiceId = args.voiceId ?: args.voice_id
        val chosenVoice: Voice? = when {
          !resolvedVoiceId.isNullOrBlank() -> findVoiceById(t, resolvedVoiceId)
          !args.language.isNullOrBlank() -> chooseBestVoiceForLanguage(t, args.language!!)
          else -> null
        }

        if (chosenVoice != null) {
          t.setVoice(chosenVoice)
        } else if (!args.language.isNullOrBlank()) {
          t.setLanguage(Locale.forLanguageTag(args.language))
        }

        val androidRate = mapWebRateToAndroid(args.rate ?: 1.0f, targetMax = 3.0f)
        t.setSpeechRate(androidRate)

        val utteranceId = "utt_${utteranceIdCounter.incrementAndGet()}"

        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) {
            val event = JSObject().apply {
              put("status", "started")
              put("utteranceId", id ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          override fun onDone(id: String?) {
            val event = JSObject().apply {
              put("status", "ended")
              put("utteranceId", id ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          @Suppress("DEPRECATION")
          override fun onError(id: String?) {
            val event = JSObject().apply {
              put("status", "error")
              put("utteranceId", id ?: JSONObject.NULL)
            }
            trigger("ttsStatus", event)
          }

          override fun onError(id: String?, errorCode: Int) {
            val event = JSObject().apply {
              put("status", "error")
              put("utteranceId", id ?: JSONObject.NULL)
              put("errorCode", errorCode)
            }
            trigger("ttsStatus", event)
          }
        })

        // Use QUEUE_ADD - Android doesn't support true concurrent TTS
        val res = t.speak(args.text, TextToSpeech.QUEUE_ADD, null, utteranceId)
        if (res == TextToSpeech.ERROR) {
          invoke.reject("Failed to queue speech")
        } else {
          val result = JSObject().apply {
            put("utteranceId", utteranceId)
          }
          invoke.resolve(result)
        }
      } catch (e: Exception) {
        invoke.reject(e.message ?: "Unknown error in speakConcurrent")
      }
    }
  }

  @Command
  fun stop(invoke: Invoke) {
    ensureReady {
      tts?.stop()
      invoke.resolve()
    }
  }

  @Command
  fun openTtsSettings(invoke: Invoke) {
    try {
      val intent = Intent("android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      activity.startActivity(intent)
      invoke.resolve()
    } catch (_: ActivityNotFoundException) {
      try {
        val fallback = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(fallback)
        invoke.resolve()
      } catch (_: Exception) {
        invoke.reject("Unable to open TTS or Accessibility settings")
      }
    } catch (e: Exception) {
      invoke.reject("Failed to open TTS settings: ${e.message}")
    }
  }

  @Command
  fun installTtsDataIfSupported(invoke: Invoke) {
    try {
      val intent = Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)
      currentEngine(tts)?.let { pkg -> intent.`package` = pkg }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      activity.startActivity(intent)
      invoke.resolveObject(true)
    } catch (_: ActivityNotFoundException) {
      invoke.resolveObject(false)
    } catch (_: Exception) {
      invoke.resolveObject(false)
    }
  }

  @Command
  fun getTtsEngineStatus(invoke: Invoke) {
    ensureReady {
      val t = tts
      if (t == null) {
        invoke.reject("TTS not initialized")
        return@ensureReady
      }

      val engines = t.engines ?: emptyList()
      val arr = JSONArray()
      for (engine in engines) {
        val o = JSObject()
        o.put("packageName", engine.name)
        o.put("label", engine.label?.toString() ?: JSONObject.NULL)
        o.put("isSystem", false)
        arr.put(o)
      }

      val defaultEngine = currentEngine(t)
      val googleInstalled = engines.any { it.name == GOOGLE_TTS_PACKAGE }
      val googleDefault = defaultEngine == GOOGLE_TTS_PACKAGE

      val result = JSObject().apply {
        put("supported", true)
        put("defaultEngine", defaultEngine ?: JSONObject.NULL)
        put("engines", arr)
        put("googleInstalled", googleInstalled)
        put("googleDefault", googleDefault)
      }

      invoke.resolve(result)
    }
  }

  @Command
  fun openTtsEngineStore(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(EngineStoreArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }

    val pkg = args.packageName ?: args.package_name
    if (pkg.isNullOrBlank()) {
      invoke.reject("packageName is required")
      return
    }

    val marketUri = Uri.parse("market://details?id=$pkg")
    val webUri = Uri.parse("https://play.google.com/store/apps/details?id=$pkg")

    try {
      val intent = Intent(Intent.ACTION_VIEW, marketUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      activity.startActivity(intent)
      invoke.resolveObject(true)
    } catch (_: ActivityNotFoundException) {
      try {
        val intent = Intent(Intent.ACTION_VIEW, webUri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
        invoke.resolveObject(true)
      } catch (_: Exception) {
        invoke.resolveObject(false)
      }
    } catch (_: Exception) {
      invoke.resolveObject(false)
    }
  }

  @Command
  fun listVoices(invoke: Invoke) {
    ensureReady {
      val t = tts
      if (t == null) {
        invoke.reject("TTS not initialized")
        return@ensureReady
      }

      val arr = JSONArray()
      val engine = currentEngine(t)

      val voices = t.voices ?: emptySet()

      val items = voices
        .sortedWith(
          compareBy<Voice> { it.locale?.toLanguageTag() ?: "" }
            .thenByDescending { it.quality }
            .thenBy { it.latency }
            .thenBy { it.name }
        )

      for (v in items) {
        val o = JSObject()
        o.put("id", v.name)
        o.put("name", JSONObject.NULL) // Android exposes no friendly label
        o.put("language", v.locale?.toLanguageTag() ?: Locale.getDefault().toLanguageTag())
        if (engine == null) o.put("engine", JSONObject.NULL) else o.put("engine", engine)
        o.put("gender", JSONObject.NULL) // not exposed
        o.put(
          "quality",
          when (v.quality) {
            Voice.QUALITY_VERY_HIGH -> "very_high"
            Voice.QUALITY_HIGH -> "high"
            Voice.QUALITY_NORMAL -> "normal"
            Voice.QUALITY_LOW -> "low"
            Voice.QUALITY_VERY_LOW -> "very_low"
            else -> "normal"
          }
        )

        val feats = v.features ?: emptySet()
        val nameLc = v.name.lowercase(Locale.ROOT)

        val networkByApi = v.isNetworkConnectionRequired || feats.contains("networkTts")
        val networkByName = nameLc.endsWith("-network") || nameLc.contains("network")
        val networkRequired = networkByApi || networkByName

        o.put("networkRequired", networkRequired)

        arr.put(o)
      }

      val result = JSObject().apply { put("voices", arr) }
      invoke.resolve(result)
    }
  }

  /* --------- Diagnose & rescue commands (added in 0.11.8) --------- */

  /**
   * Map a PackageManager.COMPONENT_ENABLED_STATE_* int to a stable string.
   * "default" means "use manifest default" (which may itself be enabled or disabled).
   */
  private fun enabledStateName(state: Int): String = when (state) {
    PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> "default"
    PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> "enabled"
    PackageManager.COMPONENT_ENABLED_STATE_DISABLED -> "disabled"
    PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER -> "disabled_user"
    PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED -> "disabled_until_used"
    else -> "unknown_$state"
  }

  /**
   * Set of packages exposing the TTS_SERVICE intent (and thus bindable from a
   * 3rd-party app). Computed lazily per probe — Samsung's "private" TTS engine
   * doesn't appear here, which prevents wasted bind attempts.
   */
  private fun bindableTtsPackages(): Set<String> {
    return try {
      val pm = activity.packageManager
      val intent = Intent("android.intent.action.TTS_SERVICE")
      val resolved = pm.queryIntentServices(intent, 0)
      resolved.mapNotNull { it.serviceInfo?.packageName }.toSet()
    } catch (e: Throwable) {
      Log.w(TAG, "bindableTtsPackages query failed: ${e.message}")
      emptySet()
    }
  }

  /** Returns engine info for a single package, or null if not installed/visible. */
  private fun describePackage(
    pkg: String,
    label: String?,
    bindablePkgs: Set<String>,
  ): JSObject? {
    val pm = activity.packageManager
    return try {
      val info = pm.getApplicationInfo(pkg, 0)
      val state = pm.getApplicationEnabledSetting(pkg)
      val stateName = enabledStateName(state)
      val isInstalled = true
      // Effective package-enabled (must be true regardless of TTS_SERVICE export).
      val packageEnabled = when (state) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> info.enabled
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED -> true
        else -> false
      }
      val isBindable = bindablePkgs.contains(pkg)
      // "Usable" requires BOTH the package to be enabled AND TTS_SERVICE to be
      // exported (samsung.SMT is "private" — package-enabled but not bindable).
      val isUsable = packageEnabled && isBindable
      JSObject().apply {
        put("packageName", pkg)
        put("label", label ?: JSONObject.NULL)
        put("enabledState", stateName)
        put("manifestEnabled", info.enabled)
        put("isInstalled", isInstalled)
        put("isBindable", isBindable)
        put("isUsable", isUsable)
      }
    } catch (_: PackageManager.NameNotFoundException) {
      JSObject().apply {
        put("packageName", pkg)
        put("label", label ?: JSONObject.NULL)
        put("enabledState", "not_installed")
        put("manifestEnabled", false)
        put("isInstalled", false)
        put("isBindable", false)
        put("isUsable", false)
      }
    } catch (e: Exception) {
      Log.w(TAG, "describePackage($pkg) failed: ${e.message}")
      null
    }
  }

  /**
   * Decide a single high-level diagnosis from the current state + engine list.
   *
   * Anchored on Google TTS because it's the only engine 3rd-party apps can
   * reliably bind to in practice. Samsung's SMT advertises TTS_SERVICE but
   * blocks 3rd-party binding ("private engine") — which is why we never trust
   * "anyOtherUsable" as a positive signal here. If Google is broken we
   * surface that directly; if Google works we report ready (or no_voice_data
   * if voices haven't downloaded yet).
   */
  private fun deriveDiagnosis(
    initOk: Boolean,
    voicesEmpty: Boolean,
    googleInstalled: Boolean,
    googleUsable: Boolean,
  ): String = when {
    initOk && !voicesEmpty -> "ready"
    googleInstalled && !googleUsable -> "engine_disabled_user"
    !googleInstalled -> "engine_not_installed"
    initOk && voicesEmpty -> "no_voice_data"
    else -> "engine_hung"
  }

  /**
   * Comprehensive engine + voice + state probe. JS uses this to decide whether to
   * auto-recover, show a rescue card, or proceed normally.
   */
  @Command
  fun probeTtsHealth(invoke: Invoke) {
    val t = tts
    val pm = activity.packageManager

    // 1. Determine voice presence (best-effort — only meaningful if init succeeded).
    val voiceCount = if (initState == InitState.READY && t != null) {
      try { t.voices?.size ?: 0 } catch (_: Throwable) { 0 }
    } else 0
    val voicesEmpty = voiceCount == 0

    // 2. Engines reachable via the framework (post-init only).
    val frameworkEngines: List<TextToSpeech.EngineInfo> =
      if (initState == InitState.READY && t != null) {
        try { t.engines ?: emptyList() } catch (_: Throwable) { emptyList() }
      } else emptyList()

    // 3. Build the union of well-known + framework-discovered package names.
    val knownPkgs = LinkedHashSet<String>().apply {
      addAll(WELL_KNOWN_TTS_PACKAGES)
      frameworkEngines.forEach { add(it.name) }
    }

    val labelByPkg = frameworkEngines.associate { it.name to it.label?.toString() }

    val bindablePkgs = bindableTtsPackages()

    val enginesArr = JSONArray()
    var googleInstalled = false
    var googleUsable = false
    var anyOtherUsable = false
    for (pkg in knownPkgs) {
      val desc = describePackage(pkg, labelByPkg[pkg], bindablePkgs) ?: continue
      enginesArr.put(desc)
      val isUsable = desc.optBoolean("isUsable", false)
      if (pkg == "com.google.android.tts") {
        googleInstalled = desc.optBoolean("isInstalled", false)
        googleUsable = isUsable
      } else if (isUsable) {
        anyOtherUsable = true
      }
    }

    val defaultEngine = try { t?.defaultEngine } catch (_: Throwable) { null }
    val initOk = initState == InitState.READY && voiceCount > 0
    val diagnosis = deriveDiagnosis(
      initOk = initState == InitState.READY,
      voicesEmpty = voicesEmpty,
      googleInstalled = googleInstalled,
      googleUsable = googleUsable,
    )

    Log.i(
      TAG,
      "probeTtsHealth init=$initState voices=$voiceCount default=$defaultEngine " +
        "googleInstalled=$googleInstalled googleUsable=$googleUsable other=$anyOtherUsable " +
        "diagnosis=$diagnosis"
    )

    val result = JSObject().apply {
      put("supported", true)
      put("initState", initState.name.lowercase(Locale.ROOT))
      put("currentEngine", currentEngineKey ?: JSONObject.NULL)
      put("voiceCount", voiceCount)
      put("voicesEmpty", voicesEmpty)
      put("defaultEngine", defaultEngine ?: JSONObject.NULL)
      put("engines", enginesArr)
      put("googleInstalled", googleInstalled)
      put("googleEnabled", googleUsable)
      put("googleDefault", defaultEngine == "com.google.android.tts")
      put("diagnosis", diagnosis)
      // for compatibility with older JS callers
      put("ready", initOk)
    }
    invoke.resolve(result)
  }

  /**
   * Try, in order, to bind to: current engine (no-op if usable), Google TTS,
   * any other usable engine. Returns `{recovered, engine, diagnosis}`.
   * Always emits `ttsInitialized` or `ttsError` events along the way.
   */
  @Command
  fun tryAutoRecover(invoke: Invoke) {
    val pm = activity.packageManager
    Log.i(TAG, "tryAutoRecover invoked")

    // Quick path: if init already ready and voices populated, we're done.
    val t = tts
    if (initState == InitState.READY && t != null) {
      val count = try { t.voices?.size ?: 0 } catch (_: Throwable) { 0 }
      if (count > 0) {
        val r = JSObject().apply {
          put("recovered", true)
          put("engine", currentEngineKey ?: t.defaultEngine ?: JSONObject.NULL)
          put("alreadyHealthy", true)
        }
        invoke.resolve(r)
        return
      }
    }

    // Build a candidate list, preferring Google TTS first.
    val frameworkEngines: List<String> = try { tts?.engines?.map { it.name } ?: emptyList() } catch (_: Throwable) { emptyList() }
    val candidates = LinkedHashSet<String>().apply {
      add("com.google.android.tts")
      frameworkEngines.forEach { add(it) }
      addAll(WELL_KNOWN_TTS_PACKAGES)
    }

    // Filter to only usable packages: must be enabled AND expose TTS_SERVICE
    // (Samsung's SMT, for instance, is "private" — enabled but not bindable
    // from 3rd-party apps; including it leads to wasted bind attempts).
    val bindablePkgs = bindableTtsPackages()
    val usable = candidates.filter { pkg ->
      try {
        val info = pm.getApplicationInfo(pkg, 0)
        val state = pm.getApplicationEnabledSetting(pkg)
        val pkgEnabled = info.enabled && (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
          state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT ||
          state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED)
        pkgEnabled && bindablePkgs.contains(pkg)
      } catch (_: Throwable) { false }
    }
    Log.i(TAG, "tryAutoRecover: usable=$usable bindable=$bindablePkgs")

    if (usable.isEmpty()) {
      // Determine a more specific diagnosis: if Google is installed but
      // unbindable (disabled-by-user), recommend re-enable. Otherwise install.
      val googleInstalled = try {
        pm.getApplicationInfo("com.google.android.tts", 0); true
      } catch (_: Throwable) { false }
      val diag = if (googleInstalled) "engine_disabled_user" else "engine_not_installed"
      Log.w(TAG, "tryAutoRecover: no usable engines found; diagnosis=$diag")
      val r = JSObject().apply {
        put("recovered", false)
        put("diagnosis", diag)
      }
      invoke.resolve(r)
      return
    }

    // Try the first usable candidate by re-initializing with it explicitly.
    val target = usable.first()
    Log.i(TAG, "tryAutoRecover: attempting bind to $target")
    initializeTTS(target)

    // We can't synchronously know success — wait via a one-shot polling loop with timeout.
    val deadline = System.currentTimeMillis() + (INIT_TIMEOUT_MS + 500L)
    val poll = object : Runnable {
      override fun run() {
        when {
          initState == InitState.READY -> {
            val voiceN = try { tts?.voices?.size ?: 0 } catch (_: Throwable) { 0 }
            Log.i(TAG, "tryAutoRecover: bind to $target succeeded (voices=$voiceN)")
            val r = JSObject().apply {
              put("recovered", voiceN > 0)
              put("engine", target)
              put("voiceCount", voiceN)
              if (voiceN == 0) put("diagnosis", "no_voice_data")
            }
            invoke.resolve(r)
          }
          initState == InitState.FAILED || System.currentTimeMillis() > deadline -> {
            Log.w(TAG, "tryAutoRecover: bind to $target failed/timed out")
            val r = JSObject().apply {
              put("recovered", false)
              put("engine", target)
              put("diagnosis", if (initState == InitState.FAILED) "engine_hung" else "engine_hung")
            }
            invoke.resolve(r)
          }
          else -> mainHandler.postDelayed(this, 150L)
        }
      }
    }
    mainHandler.postDelayed(poll, 150L)
  }

  /**
   * Bind to a specific engine package. Returns `{ok, reason?}`.
   */
  @Command
  fun bindEngine(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(BindEngineArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }
    val pkg = args.packageName ?: args.package_name
    if (pkg.isNullOrBlank()) {
      invoke.reject("packageName is required")
      return
    }

    Log.i(TAG, "bindEngine($pkg)")
    val pm = activity.packageManager

    // Pre-check installation/enabled state to give a typed reason.
    val info = try { pm.getApplicationInfo(pkg, 0) } catch (_: PackageManager.NameNotFoundException) { null }
    if (info == null) {
      invoke.resolve(JSObject().apply { put("ok", false); put("reason", "not_installed") })
      return
    }
    val state = try { pm.getApplicationEnabledSetting(pkg) } catch (_: Throwable) { PackageManager.COMPONENT_ENABLED_STATE_DEFAULT }
    val usable = info.enabled && (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
      state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT ||
      state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED)
    if (!usable) {
      val reason = when (state) {
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER -> "disabled_user"
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED -> "disabled"
        else -> "disabled"
      }
      invoke.resolve(JSObject().apply { put("ok", false); put("reason", reason) })
      return
    }

    initializeTTS(pkg)

    val deadline = System.currentTimeMillis() + (INIT_TIMEOUT_MS + 500L)
    val poll = object : Runnable {
      override fun run() {
        when {
          initState == InitState.READY -> {
            val voiceN = try { tts?.voices?.size ?: 0 } catch (_: Throwable) { 0 }
            invoke.resolve(JSObject().apply {
              put("ok", true)
              put("engine", pkg)
              put("voiceCount", voiceN)
            })
          }
          initState == InitState.FAILED || System.currentTimeMillis() > deadline -> {
            invoke.resolve(JSObject().apply {
              put("ok", false)
              put("reason", "bind_timeout")
              put("engine", pkg)
            })
          }
          else -> mainHandler.postDelayed(this, 150L)
        }
      }
    }
    mainHandler.postDelayed(poll, 150L)
  }

  /**
   * Open the system "App info" page for a package. The user lands one tap away
   * from the Enable/Disable button — this is our recovery for `engine_disabled_user`.
   */
  @Command
  fun openAppDetails(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(AppDetailsArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }
    val pkg = args.packageName ?: args.package_name
    if (pkg.isNullOrBlank()) {
      invoke.reject("packageName is required")
      return
    }
    try {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      activity.startActivity(intent)
      Log.i(TAG, "openAppDetails: launched for $pkg")
      invoke.resolveObject(true)
    } catch (e: Exception) {
      Log.w(TAG, "openAppDetails($pkg) failed: ${e.message}")
      invoke.resolveObject(false)
    }
  }

  /**
   * Per-language voice data installation. Calls setLanguage on the bound engine and,
   * if the language data is missing, fires the engine's own install-data activity.
   *
   * Returns `{status: "already_installed" | "launched_install_flow" | "not_supported" | "engine_not_ready"}`.
   */
  @Command
  fun installVoiceDataForLanguage(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(InstallVoiceDataArgs::class.java)
    } catch (e: Exception) {
      invoke.reject("Invalid args: ${e.message}")
      return
    }
    val tag = args.language
    if (tag.isNullOrBlank()) {
      invoke.reject("language is required")
      return
    }
    ensureReady {
      val t = tts
      if (t == null || initState != InitState.READY) {
        invoke.resolve(JSObject().apply { put("status", "engine_not_ready") })
        return@ensureReady
      }
      val locale = try { Locale.forLanguageTag(tag) } catch (_: Throwable) { null }
      if (locale == null) {
        invoke.resolve(JSObject().apply { put("status", "not_supported") })
        return@ensureReady
      }
      val avail = try { t.isLanguageAvailable(locale) } catch (_: Throwable) { TextToSpeech.LANG_NOT_SUPPORTED }
      Log.i(TAG, "installVoiceDataForLanguage($tag) -> isLanguageAvailable=$avail")
      when (avail) {
        TextToSpeech.LANG_AVAILABLE,
        TextToSpeech.LANG_COUNTRY_AVAILABLE,
        TextToSpeech.LANG_COUNTRY_VAR_AVAILABLE -> {
          invoke.resolve(JSObject().apply { put("status", "already_installed") })
        }
        TextToSpeech.LANG_MISSING_DATA -> {
          try {
            val intent = Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA)
            currentEngineKey?.let { intent.`package` = it }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
            invoke.resolve(JSObject().apply { put("status", "launched_install_flow") })
          } catch (e: Exception) {
            Log.w(TAG, "INSTALL_TTS_DATA intent failed: ${e.message}")
            invoke.resolve(JSObject().apply { put("status", "not_supported") })
          }
        }
        else -> {
          invoke.resolve(JSObject().apply { put("status", "not_supported") })
        }
      }
    }
  }
}
