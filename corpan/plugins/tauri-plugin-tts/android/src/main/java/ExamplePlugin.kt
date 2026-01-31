package space.httpjames.tauri_plugin_tts

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
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
  private var isInitialized = false
  private val pendingActions = mutableListOf<() -> Unit>()

  // Voice caching for performance (avoid repeated expensive voice enumeration)
  private var voiceCache: List<Voice>? = null
  private var voiceCacheTime: Long = 0
  private val VOICE_CACHE_TTL = 30_000L // 30 seconds like iOS

  // Counter for generating utterance IDs
  private val utteranceIdCounter = AtomicLong(0)

  override fun load(webView: WebView) {
    initializeTTS()
  }

  private fun initializeTTS() {
    if (tts != null) return
    tts = TextToSpeech(activity) { status ->
      isInitialized = (status == TextToSpeech.SUCCESS)
      val event = JSObject()
      if (isInitialized) {
        event.put("initialized", true)
        trigger("ttsInitialized", event)
        drainPending()
      } else {
        event.put("error", "Failed to initialize TTS")
        trigger("ttsError", event)
      }
    }
  }

  private fun ensureReady(action: () -> Unit) {
    if (isInitialized && tts != null) {
      action()
    } else {
      pendingActions.add(action)
      initializeTTS()
    }
  }

  private fun drainPending() {
    val actions = ArrayList(pendingActions)
    pendingActions.clear()
    actions.forEach { it.invoke() }
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
}
