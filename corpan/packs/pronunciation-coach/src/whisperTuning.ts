// Whisper parameter tuning — per-language overrides for whisper.cpp's
// `whisper_full_params`. Three layers, computed at `startSession`:
//
//   library default  ←  built-in profile (this file)  ←  user override (localStorage)
//
// The pack sends the merged `WhisperParams` object as
// `startSession({ whisperParams: ... })`. The Swift plugin applies each
// non-undefined field on top of `whisper_full_default_params(GREEDY)`
// inside `WhisperCppContext.transcribe()`. nil fields fall through to
// the whisper.cpp library default.
//
// Why this exists: large-v3-turbo has a 4-layer text decoder (vs 32
// on full Large v3) and trips its own quality gates on low-resource
// languages like Telugu, triggering whisper.cpp's internal
// temperature-fallback loop, which then samples at T ≥ 0.6 and
// produces mixed-script salad output. This file is where we tune
// per-language gates to keep decoding on the deterministic greedy
// path for those languages.
//
// Discoverability: the tuner UI is reachable via long-press on the
// language badge inside the card (`.pc-lang-badge` in game.ts). Not
// surfaced to normal users.

export type WhisperParams = {
  /** Initial decoding temperature. 0.0 = greedy (deterministic). */
  temperature?: number
  /**
   * Step size for the temperature-fallback ladder. Library default
   * 0.2 means whisper.cpp retries at 0.0 → 0.2 → 0.4 → … → 1.0 if
   * the quality gates trip. **0.0 disables the loop entirely** —
   * you get exactly one greedy decode and live with the result.
   */
  temperature_inc?: number
  /**
   * Output-quality gate. whisper.cpp's comment in whisper.h:547
   * calls this "similar to OpenAI's compression_ratio_threshold."
   * Higher = more permissive. Indic scripts naturally compress
   * past the 2.4 default because BPE tokenizes one glyph into
   * 3–4 sub-tokens; raise to 3.5 or beyond for those langs.
   */
  entropy_thold?: number
  /** Average per-token log-probability below which the decode is
   *  considered "unconfident" and triggers the fallback. */
  logprob_thold?: number
  /** Probability above which whisper.cpp decides the segment has
   *  no speech and emits nothing. */
  no_speech_thold?: number
  /** Suppress blank tokens at the start of a segment. */
  suppress_blank?: boolean
  /** Suppress "non-speech tokens" (music, noise, etc.). */
  suppress_nst?: boolean
  /** Override CPU thread count. Leave undefined to use plugin's
   *  computed default (processor count minus two). */
  n_threads?: number
  /**
   * Initial-prompt primer for the decoder. Whisper prepends up to
   * ~224 tokens of this before generating, biasing toward the
   * prompt's script and vocabulary. Most effective lever for
   * low-resource non-Latin-script languages where the greedy decode
   * otherwise collapses to a wrong-script attractor (e.g. Telugu
   * greedy-decoding into a Bengali ৃ-letter loop on Medium).
   *
   * Keep this content-free (don't leak the expected phrase) — a
   * one-sentence note in the target language about the language
   * itself is usually enough to fix the script picker, without
   * teaching the model to parrot the expected words back.
   */
  initial_prompt?: string
}

/** Mirror of whisper.cpp's actual library defaults — see
 *  `whisper.cpp/src/whisper.cpp:5955-5965`. We display these in the
 *  tuner UI as the "library default" column. Kept in sync manually;
 *  if whisper.cpp changes a default, update here. */
export const LIBRARY_DEFAULTS: Required<WhisperParams> = {
  temperature: 0.0,
  temperature_inc: 0.2,
  entropy_thold: 2.4,
  logprob_thold: -1.0,
  no_speech_thold: 0.6,
  suppress_blank: true,
  suppress_nst: false,
  n_threads: 0, // plugin computes its own; 0 = "use plugin default"
  initial_prompt: "", // empty = no priming
}

/**
 * Built-in per-language overrides we ship with the pack. Indic /
 * low-resource langs default to "disable the fallback loop" so the
 * model returns its imperfect greedy output rather than wandering
 * into Amharic-Hiragana-Latin salad via high-temperature sampling.
 *
 * These are starter values we expect to refine empirically through
 * the tuner UI. Once a value proves itself we promote it here.
 *
 * Keys are base 2-letter ISO codes (the result of
 * `whisperLang(targetLang)` in game.ts:559). Languages not listed
 * use the library defaults — i.e. high-resource langs (es, it, fr,
 * de, en, pt, …) stay on the full fallback loop because it works
 * for them.
 */
/**
 * Built-in per-language overrides we ship with the pack.
 *
 * **What's set and why:**
 *
 * 1. `temperature_inc: 0` — kills whisper.cpp's internal fallback
 *    loop. Indic BPE compression ratios routinely exceed the 2.4
 *    default, which trips the gate and triggers retries at higher
 *    temperatures (0.2 → 1.0). High-T sampling on Telugu/Tamil/etc.
 *    produces the Ge'ez / Hiragana / Bengali script salad we
 *    observed live. With `temperature_inc=0` the model runs a
 *    single deterministic greedy decode and returns whatever that
 *    produces — wrong, sometimes, but never random-script.
 *
 * 2. `initial_prompt` — a one-sentence content-free primer in the
 *    target language and native script. Biases the decoder away
 *    from the wrong-script greedy attractor (e.g. Medium decoding
 *    Telugu audio into a Bengali ৃ-letter loop). Deliberately does
 *    NOT contain the expected phrase or anything resembling it —
 *    leaking the expected text into the prompt makes the model
 *    parrot it back regardless of what the user actually said,
 *    breaking honest scoring.
 *
 * The prompt strings are intentionally generic ("This is X.") so
 * they prime the script and language ID without seeding any words
 * the user might be tested on.
 */
/**
 * Each Indic-language prompt is a context-setting sentence in the
 * native script that says, in the target language:
 *
 *   "I'm learning {language}. I'm going to try a phrase — tell me
 *   honestly what you hear."
 *
 * Three signals to the decoder packed into one prompt:
 *
 *   1. Native script — biases output script away from the wrong-
 *      script greedy attractor (e.g. Telugu audio decoded as Bengali).
 *   2. "I'm going to say a phrase" — primes speech-recognition mode
 *      rather than completion / dictation modes.
 *   3. "Tell me honestly what you hear" — soft cue against parroting
 *      back any context the model already has; helps the model
 *      decode what was actually said rather than autocompleting.
 *
 * The prompts are machine-translated from the English template and
 * have NOT been reviewed by native speakers. They are starter
 * values — power users should refine them per-language via the
 * tuner UI ([[whisperTunerUI]]). Any improvement found there can
 * be promoted back here as the shipping default.
 */
export const BUILT_IN_PROFILES: Record<string, WhisperParams> = {
  // Telugu
  te: {
    temperature_inc: 0.0,
    initial_prompt:
      "నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి.",
  },
  // Tamil
  ta: {
    temperature_inc: 0.0,
    initial_prompt:
      "நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்.",
  },
  // Malayalam
  ml: {
    temperature_inc: 0.0,
    initial_prompt:
      "ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ.",
  },
  // Bengali
  bn: {
    temperature_inc: 0.0,
    initial_prompt:
      "আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।",
  },
  // Marathi
  mr: {
    temperature_inc: 0.0,
    initial_prompt:
      "मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा.",
  },
  // Gujarati
  gu: {
    temperature_inc: 0.0,
    initial_prompt:
      "હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો.",
  },
  // Punjabi (Gurmukhi)
  pa: {
    temperature_inc: 0.0,
    initial_prompt:
      "ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।",
  },
  // Odia
  or: {
    temperature_inc: 0.0,
    initial_prompt:
      "ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।",
  },
  // Assamese
  as: {
    temperature_inc: 0.0,
    initial_prompt:
      "মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।",
  },
  // Nepali
  ne: {
    temperature_inc: 0.0,
    initial_prompt:
      "म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।",
  },
  // Sinhala
  si: {
    temperature_inc: 0.0,
    initial_prompt:
      "මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න.",
  },
  // Persian
  fa: {
    temperature_inc: 0.0,
    initial_prompt:
      "من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید.",
  },
  // Urdu
  ur: {
    temperature_inc: 0.0,
    initial_prompt:
      "میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔",
  },
}

const STORAGE_KEY = "pc:whisper-tuning"

type UserOverridesShape = Record<string, WhisperParams>

/** Load user overrides from localStorage. Returns an empty object
 *  on any parse / storage failure — we never throw out of here, so
 *  the recording path can't be blocked by tuning state. */
export const loadUserOverrides = (): UserOverridesShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    return parsed as UserOverridesShape
  } catch (err) {
    console.error("[whisperTuning] loadUserOverrides failed:", err)
    return {}
  }
}

export const saveUserOverrides = (overrides: UserOverridesShape): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch (err) {
    console.error("[whisperTuning] saveUserOverrides failed:", err)
  }
}

/** Update one language's overrides in localStorage, merging with what's
 *  there. Pass `undefined` to clear a field (returns to lower layer). */
export const setLangOverride = (lang: string, patch: WhisperParams): void => {
  const all = loadUserOverrides()
  const base = lang.split("-")[0].toLowerCase()
  const cur = all[base] ?? {}
  const next = { ...cur, ...patch }
  // Drop undefined fields so the JSON stays clean.
  for (const k of Object.keys(next) as (keyof WhisperParams)[]) {
    if (next[k] === undefined) delete next[k]
  }
  if (Object.keys(next).length === 0) {
    delete all[base]
  } else {
    all[base] = next
  }
  saveUserOverrides(all)
}

/** Wipe overrides for one language (returns to built-in / library). */
export const resetLang = (lang: string): void => {
  const all = loadUserOverrides()
  const base = lang.split("-")[0].toLowerCase()
  delete all[base]
  saveUserOverrides(all)
}

/** Wipe ALL user overrides — back to built-in defaults everywhere. */
export const resetAll = (): void => {
  saveUserOverrides({})
}

/**
 * Resolve effective whisper params for a language. Returns the merged
 * object the pack sends on `startSession`. Layers (later wins):
 *
 *   1. `BUILT_IN_PROFILES[base]`  (if present)
 *   2. `loadUserOverrides()[base]`  (if present)
 *
 * Returns an empty object if both layers are empty — Swift treats
 * that identically to "no overrides," so callers can always send it.
 */
export const mergeForLang = (lang: string): WhisperParams => {
  const base = lang.split("-")[0].toLowerCase()
  const builtIn = BUILT_IN_PROFILES[base] ?? {}
  const user = loadUserOverrides()[base] ?? {}
  return { ...builtIn, ...user }
}

// =====================================================================
// Silence-detection policy (pack-side, fed by native `audio_level`
// events from `tauri-plugin-stt`). Lives here next to the whisper-param
// tuning so all per-language knobs surface from one place.
// =====================================================================

import type { SilencePolicy } from "./silenceWatcher"

/** Per-language overrides on top of `DEFAULT_SILENCE_POLICY`. Empty
 *  for v1 — defaults work across the board so far. Add entries as we
 *  observe language-specific patterns (e.g. languages with longer
 *  trailing fricatives, or aspirated consonants that linger). */
export const SILENCE_POLICY_BY_LANG: Record<string, SilencePolicy> = {
  // Example placeholder for future tuning:
  // ko: { silenceMs: 1700 }, // Korean trailing /ㅎ/ aspiration
}

export const mergeSilencePolicy = (lang: string): SilencePolicy => {
  const base = lang.split("-")[0].toLowerCase()
  return SILENCE_POLICY_BY_LANG[base] ?? {}
}
