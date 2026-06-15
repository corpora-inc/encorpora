import type { EntryOut, HostApi, TranslationOut } from "./sdk/types"
import {
  MODELS,
  modelById,
  defaultModel,
  visibleModels,
  visibleDefaultModel,
  setDeviceMemoryBudget,
  variantExceedsBudget,
} from "./modelRegistry"
import { mergeForLang } from "./whisperTuning"
import { mergeScoringForLangModel } from "./scoringTuning"
import { openTuner } from "./whisperTunerUI"
import { paywallGate } from "./paywall"
import { t as i18n, type I18nKey } from "./i18n"
// Direct file import (not the @shared/ui barrel) so we don't pull in
// commandDrawer/drawerStore and their zustand dep. The offline notice is
// pure DOM + CSS — perfect for packs that don't otherwise need shared/ui.
import {
  createOfflineNotice,
  isOnline,
  onNetworkChange,
} from "../../shared/ui/offlineNotice"
// Silence auto-stop is wired in `silenceWatcher.ts` but currently
// not invoked from the recording flow — RMS-thresholding-with-fixed-
// numbers is too unreliable across mic gain / noise floor / accent
// variance to ship as an always-on feature. The native `audio_level`
// event stream and the watcher state machine are kept intact for
// future re-wiring (e.g., behind a real VAD model). See pack
// CHANGELOG 0.6.1 for the removal rationale.

// Local STT API contract — host owns the canonical type, we only declare
// what we need to call. Codes mirror the host's SttErrorCode union.
type SttErrorCode =
  | "MODEL_NOT_INSTALLED"
  | "MODEL_NOT_LOADED"
  | "NETWORK"
  | "LOAD_FAILED"
  | "IO_FAILED"
  | "BUSY"
  | "CANCELLED"
  | "MIC_PERMISSION_DENIED"
  | "NO_ACTIVE_SESSION"
  | "AUDIO_FAILED"
  | "INSUFFICIENT_MEMORY"
  // Plugin reports this when the underlying native lib failed to load
  // on this device — e.g. x86_64 Chromebook running Android via ARC
  // where libhoudini can't translate the armv8.2-a SIMD intrinsics
  // whisper.cpp is compiled with. Different from MODEL_NOT_INSTALLED
  // (which means "download the model and you're good"): here, no
  // model would ever load. Route to a "Speech recognition not
  // supported on this device" screen instead of offering download.
  | "STT_UNAVAILABLE"
  | "UNKNOWN"
type SttPrepareResult = {
  ready: boolean
  model: string
  message?: string
  code?: SttErrorCode
}
type SttStartResult = { started: boolean; sessionId: string }
type SttInstalledModel = {
  model: string
  valid: boolean
  problems: string[]
  sizeBytes: number
  isLoaded: boolean
}
type SttListInstalledResult = { models: SttInstalledModel[] }
type SttStatus = {
  available: boolean
  prepared: boolean
  model: string | null
  recording: boolean
  message: string | null
  /** Per-app jetsam budget in MB. iOS 13+; null on older. */
  availableMemoryMB?: number | null
  /** Total physical RAM on the device in MB. */
  physicalMemoryMB?: number | null
  /** One-shot native-init crash breadcrumb from the previous process. */
  priorInitCrash?: string | null
}
export type SttWordTiming = {
  word: string
  startMs: number
  endMs: number
  probability: number
}
type SttTranscriptionResult = {
  sessionId: string
  text: string
  expectedText: string
  language: string
  whisperLanguage: string
  durationMs: number
  overallScore: number
  transcriptScore: number
  likelihoodScore: number
  acousticScore: number
  avgLogprob: number
  noSpeechProb: number
  compressionRatio: number
  temperature: number
  minTokenLogprob: number
  tokenLogprobStdev: number
  freeVsConstrainedSimilarity: number
  freeText: string
  words: SttWordTiming[]
}

type SttApi = {
  isAvailable(): Promise<boolean>
  getStatus(): Promise<SttStatus>
  prepare(opts?: { model?: string }): Promise<SttPrepareResult>
  startSession(opts: {
    sessionId: string
    language: string
    expectedText: string
    /** Per-call overrides applied on top of `whisper_full_default_params`
     *  in the iOS plugin. Built from `mergeForLang(lang)`; see
     *  `whisperTuning.ts`. Optional — empty/missing = library defaults. */
    whisperParams?: import("./whisperTuning").WhisperParams
    /** Per-call scoring overrides applied on top of the native plugin's
     *  acoustic ramp + textFloor + compression threshold. Built from
     *  `mergeScoringForLangModel(lang, modelFolder)`; see
     *  `scoringTuning.ts`. Optional — empty/missing = native defaults. */
    scoringParams?: import("./scoringTuning").ScoringParams
  }): Promise<SttStartResult>
  stopSession(opts: { sessionId: string }): Promise<SttTranscriptionResult>
  cancelSession(opts: { sessionId: string }): Promise<void>
  wipeModel?(opts?: { model?: string }): Promise<{ wiped: boolean; message?: string }>
  validateModel?(opts?: { model?: string }): Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  installModel?(
    opts: {
      model: string
      /** Optional override of the source URL. Used for models we
       *  host ourselves on our own CDN (e.g. self-quantized
       *  variants ggerganov doesn't publish). When omitted the
       *  native plugin defaults to its hardcoded HuggingFace base. */
      downloadUrl?: string
    },
    onProgress?: (event: SttInstallProgress) => void
  ): Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  listInstalled?(opts: { models: string[] }): Promise<SttListInstalledResult>
  unload?(): Promise<{ unloaded: boolean }>
  /** Tear down the audio engine + audio session. Call this from the
   *  pack's unmount path — without it, the iOS mic indicator stays
   *  on and audio is `.duckOthers`-ed until the next process kill. */
  releaseAudio?(): Promise<void>
  /** Subscribe to per-buffer RMS events while a session is recording.
   *  Fires at the platform's natural buffer cadence (~11 Hz iOS,
   *  ~8 Hz Android). Used by `silenceWatcher.ts` for auto-stop.
   *  Optional — older host builds don't ship it. */
  subscribeAudioLevel?(
    callback: (event: SttAudioLevelEvent) => void,
  ): Promise<() => void>
}

export type SttAudioLevelEvent = {
  /** RMS amplitude of the latest captured buffer, 0..1. */
  rms: number
  /** Milliseconds since the current session started. */
  t: number
}

type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
  code?: SttErrorCode
}

// Read a code attached by hostApi.ts (`sttRejectionToError`) onto thrown
// errors. Plain string/Error fallback returns undefined so callers can
// route only when the code is genuinely available.
const errCode = (err: unknown): SttErrorCode | undefined => {
  if (err && typeof err === "object") {
    const c = (err as { code?: unknown }).code
    if (typeof c === "string") return c as SttErrorCode
  }
  return undefined
}

type UiState = "idle" | "recording" | "scoring"

// Robust error → string. Tauri plugin errors come across the JS bridge
// as plain objects (e.g. `{ message: "...", code: ..., domain: "STT" }`),
// not `Error` instances, so the common `err instanceof Error ? msg :
// String(err)` pattern collapses them to `"[object Object]"` — useless
// for diagnosis. Walk the common shapes (Error, plugin shape, string,
// object with description fields) and only fall back to JSON.stringify
// + final `[object Object]` if everything else failed.
const formatErr = (err: unknown): string => {
  if (err == null) return "(unknown error)"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message || err.name || String(err)
  if (typeof err === "object") {
    const o = err as Record<string, unknown>
    const candidates = [
      o.message,
      o.localizedDescription,
      o.error,
      o.description,
      o.detail,
    ]
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c
    }
    try {
      const json = JSON.stringify(err)
      if (json && json !== "{}") return json
    } catch {
      // fall through
    }
  }
  return String(err)
}

type LoadedPhrase = {
  entry: EntryOut
  target: TranslationOut
  native: TranslationOut | null
  targetLang: string
}

const SWIPE_THRESHOLD_PX = 70
const SWIPE_VELOCITY_PX_PER_MS = 0.4
const STORAGE_KEY = "corpan-pronunciation-coach:v2"
const STORAGE_KEY_LEGACY = "corpan-pronunciation-coach:v1"
const HISTORY_CAP = 50

// NOTE: there is no localStorage cache for "is X installed". We
// deliberately avoid a hint cache because it caused a class of bugs
// where stale hints across iOS app-container UUID changes (every
// sideload can rotate the container, orphaning Documents) made the
// setup overlay show "Use this" on a model that wasn't actually
// installed in the new container. The user then tapped Use this,
// `prepare()` failed, and it looked like models were corrupting each
// other. The plugin (disk via marker + heuristic) is the single
// source of truth. The UI shows "Checking…" briefly while
// `validateModel` returns instead of guessing from cached data.

// `ModelMode` is the registry id (canonical identifier persisted in
// localStorage). The current set is in `modelRegistry.ts` (Small,
// Medium, Large Mobile, Large Turbo Mobile, Advanced as of 0.3.2).
// Adding a tier = one entry there. Removed ids ("standard" from the
// pre-0.3.2 lineup) become unrecognized; the boot path's
// `modelById(savedMode)` check filters them out and falls back to
// `defaultModel().id` so existing users who saved a now-removed id
// land at the new default.
type ModelMode = string

const folderForMode = (mode: ModelMode): string => {
  return modelById(mode)?.folder ?? mode
}
const labelForMode = (mode: ModelMode): string => {
  return modelById(mode)?.label ?? mode
}
// prepare() is local-only — never downloads. Bigger whisper.cpp ggml
// models can take a long time to map and initialize on-device, so they
// get a longer deadline; default 60 s for smaller variants.
const prepareTimeoutMs = (mode: ModelMode): number => {
  const m = modelById(mode)
  if (m && m.approxSizeMB >= 1000) return 180_000
  return 60_000
}
const TRANSCRIBE_TIMEOUT_MS = 90_000
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

const postInstallSettleMs = (mode: ModelMode): number => {
  const size = modelById(mode)?.approxSizeMB ?? 0
  if (size >= 1200) return 5000
  if (size >= 800) return 4000
  if (size >= 500) return 2500
  if (size >= 250) return 1250
  return 400
}

const withTimeout = async <T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

type SavedPhrase = {
  entryId: number
  level: string
  domains: string[]
  targetLang: string
  targetText: string
  targetRoman: string
  nativeLang: string | null
  nativeText: string
  nativeRoman: string
}

type SavedState = {
  streak: number
  phrases: SavedPhrase[]
  idx: number
  mode?: ModelMode
}

const phraseToSaved = (p: LoadedPhrase): SavedPhrase => ({
  entryId: p.entry.entry_id,
  level: p.entry.level,
  domains: p.entry.domains ?? [],
  targetLang: p.targetLang,
  targetText: p.target.text,
  targetRoman: p.target.romanization ?? "",
  nativeLang: p.native?.language_code ?? null,
  nativeText: p.native?.text ?? "",
  nativeRoman: p.native?.romanization ?? "",
})

const savedToPhrase = (s: SavedPhrase): LoadedPhrase => ({
  entry: {
    entry_id: s.entryId,
    level: s.level,
    domains: s.domains,
    translations: [],
  },
  target: {
    language_code: s.targetLang,
    text: s.targetText,
    romanization: s.targetRoman,
  },
  native: s.nativeLang
    ? {
        language_code: s.nativeLang,
        text: s.nativeText,
        romanization: s.nativeRoman,
      }
    : null,
  targetLang: s.targetLang,
})

// Whisper's word output is split on its tokenizer, which often breaks
// elided contractions like "j'ai", "qu'il", "don't", "I'll", "l'eau"
// into two separate "words". Merge those back together so the pills
// match how the language actually reads.
const APOSTROPHES_RE = /[''']/

// Per-language number-word → digit map. Mirrors the Swift table in
// the STT plugin so per-pill similarity in the pack agrees with the
// transcript-score similarity computed in the plugin: Whisper
// transcribes spoken numbers as digits ("90") regardless of how the
// speaker said them, so we map the EXPECTED word ("novanta") to its
// digit form before comparing.
const NUMBER_WORD_TO_DIGIT: Record<string, Record<string, string>> = {
  en: {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11",
    twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
    sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
    twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60",
    seventy: "70", eighty: "80", ninety: "90", hundred: "100",
    thousand: "1000",
  },
  es: {
    cero: "0", uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4",
    cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10",
    once: "11", doce: "12", trece: "13", catorce: "14", quince: "15",
    dieciséis: "16", dieciseis: "16", diecisiete: "17", dieciocho: "18",
    diecinueve: "19", veinte: "20", treinta: "30", cuarenta: "40",
    cincuenta: "50", sesenta: "60", setenta: "70", ochenta: "80",
    noventa: "90", cien: "100", ciento: "100", mil: "1000",
  },
  fr: {
    zéro: "0", zero: "0", un: "1", une: "1", deux: "2", trois: "3",
    quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9",
    dix: "10", onze: "11", douze: "12", treize: "13", quatorze: "14",
    quinze: "15", seize: "16", vingt: "20", trente: "30", quarante: "40",
    cinquante: "50", soixante: "60", cent: "100", mille: "1000",
  },
  it: {
    zero: "0", uno: "1", una: "1", due: "2", tre: "3", quattro: "4",
    cinque: "5", sei: "6", sette: "7", otto: "8", nove: "9", dieci: "10",
    undici: "11", dodici: "12", tredici: "13", quattordici: "14",
    quindici: "15", sedici: "16", diciassette: "17", diciotto: "18",
    diciannove: "19", venti: "20", trenta: "30", quaranta: "40",
    cinquanta: "50", sessanta: "60", settanta: "70", ottanta: "80",
    novanta: "90", cento: "100", mille: "1000",
  },
  de: {
    null: "0", eins: "1", ein: "1", eine: "1", zwei: "2", drei: "3",
    vier: "4", fünf: "5", funf: "5", sechs: "6", sieben: "7", acht: "8",
    neun: "9", zehn: "10", elf: "11", zwölf: "12", zwolf: "12",
    dreizehn: "13", vierzehn: "14", fünfzehn: "15", funfzehn: "15",
    sechzehn: "16", siebzehn: "17", achtzehn: "18", neunzehn: "19",
    zwanzig: "20", dreißig: "30", dreissig: "30", vierzig: "40",
    fünfzig: "50", funfzig: "50", sechzig: "60", siebzig: "70",
    achtzig: "80", neunzig: "90", hundert: "100", tausend: "1000",
  },
  pt: {
    zero: "0", um: "1", uma: "1", dois: "2", duas: "2", três: "3",
    tres: "3", quatro: "4", cinco: "5", seis: "6", sete: "7", oito: "8",
    nove: "9", dez: "10", onze: "11", doze: "12", treze: "13",
    catorze: "14", quatorze: "14", quinze: "15", dezesseis: "16",
    dezasseis: "16", dezessete: "17", dezassete: "17", dezoito: "18",
    dezenove: "19", dezanove: "19", vinte: "20", trinta: "30",
    quarenta: "40", cinquenta: "50", sessenta: "60", setenta: "70",
    oitenta: "80", noventa: "90", cem: "100", cento: "100", mil: "1000",
  },
}

// Indic / Persian / Urdu BPE tokenizes phonemes into 2–4 sub-tokens, so
// even clean speech in these languages can legitimately push Whisper's
// `compressionRatio` past 2.4 — the default gibberish threshold. Mirrors
// the Swift `lowResourceLangs` set; used to suppress the "Sounded a bit
// garbled" chip on those langs.
const LOW_RESOURCE_LANGS = new Set([
  "te", "ta", "bn", "ml", "mr", "gu", "pa", "ur", "fa", "si", "ne", "or", "as",
])

// RTL detection. Mirrors `RTL_LANGUAGES` in `corpan-app/src/store/constants.ts`
// — kept local so the pack doesn't reach into the host. Full code wins
// (so `pa-Arab` is RTL but `pa-Guru` / `pa` are LTR); otherwise we fall
// back to the base language.
const RTL_BASE_LANGS = new Set(["ar", "he", "fa", "ur"])
const RTL_FULL_LANGS = new Set(["pa-arab"])
export const isRTL = (langCode: string): boolean => {
  if (!langCode) return false
  const c = langCode.toLowerCase()
  if (RTL_FULL_LANGS.has(c)) return true
  return RTL_BASE_LANGS.has(c.split("-")[0])
}

// Normalize for character-level word comparison: NFC, lowercase,
// strip punctuation / symbols / control / format characters, then
// (when a base language is known) map number-words to their digit
// form. Keeps every letter and combining mark (essential for Indic
// scripts).
export const normalizeForCompare = (s: string, lang?: string): string => {
  const base = s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{C}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!base) return base
  const baseLang = (lang ?? "")
    .toLowerCase()
    .split("-")[0]
  const dict = NUMBER_WORD_TO_DIGIT[baseLang]
  if (!dict) return base
  return base
    .split(" ")
    .map((w) => dict[w] ?? w)
    .join(" ")
}

// Per-grapheme splitting for scripts that don't use whitespace word
// boundaries. CJK (Chinese, Japanese kana / kanji, Korean Hangul
// syllable blocks) — every grapheme is a meaningful unit (a hanzi
// character, a kana, a Hangul block) so we render one pill per
// grapheme instead of one pill for the whole phrase. Tap-to-speak
// then works at the character level, which is what users want for
// drilling Mandarin / Cantonese.
//
// We deliberately don't extend this to Thai / Lao / Tibetan / Burmese:
// those use complex grapheme clusters where individual codepoints
// aren't independently meaningful, and a per-cluster split would need
// language-aware segmentation we don't have.
const CJK_RE =
  /[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/
export const tokenizeForPills = (text: string): string[] => {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (/\s/.test(trimmed)) return trimmed.split(/\s+/).filter(Boolean)
  if (CJK_RE.test(trimmed)) {
    // Intl.Segmenter handles Hangul syllable composition and surrogate
    // pairs correctly; Array.from is a tolerable fallback if it's not
    // available (it isn't pre-iOS 16 / older WebViews — but iOS 17+
    // has it).
    type SegLike = { segment: string }
    const Seg = (
      Intl as unknown as {
        Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => {
          segment: (s: string) => Iterable<SegLike>
        }
      }
    ).Segmenter
    if (typeof Seg === "function") {
      const seg = new Seg(undefined, { granularity: "grapheme" })
      return Array.from(seg.segment(trimmed), (s) => s.segment).filter(
        (g) => g.trim().length > 0
      )
    }
    return Array.from(trimmed).filter((c) => c.trim().length > 0)
  }
  // Non-CJK without whitespace (single Latin word, etc.) — keep whole.
  return [trimmed]
}

// Codepoint-aware Levenshtein similarity in [0, 1].
export const charSimilarity = (a: string, b: string): number => {
  const an = Array.from(a)
  const bn = Array.from(b)
  const m = an.length
  const n = bn.length
  if (m === 0 && n === 0) return 1
  if (m === 0 || n === 0) return 0
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        an[i - 1] === bn[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return 1 - prev[n] / Math.max(m, n)
}

export const mergeApostropheWords = (
  words: SttWordTiming[]
): SttWordTiming[] => {
  if (!words || words.length === 0) return []
  const out: SttWordTiming[] = []
  for (const w of words) {
    const last = out[out.length - 1]
    if (last) {
      const lastChar = last.word.replace(/\s+$/, "").slice(-1)
      const firstChar = w.word.replace(/^\s+/, "").charAt(0)
      const prevEndsApos = APOSTROPHES_RE.test(lastChar)
      const curStartsApos = APOSTROPHES_RE.test(firstChar)
      if (prevEndsApos || curStartsApos) {
        last.word = last.word + w.word.replace(/^\s+/, "")
        last.endMs = Math.max(last.endMs, w.endMs)
        // Worst-token-wins: a contraction is only as confident as its
        // weakest tokenized fragment.
        last.probability = Math.min(last.probability, w.probability)
        continue
      }
    }
    out.push({ ...w })
  }
  return out
}

const safeStorage = (): Storage | null => {
  try {
    const s = window.localStorage
    const probe = "__pc_probe__"
    s.setItem(probe, "1")
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

const parseSavedState = (raw: string | null): SavedState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedState
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray(parsed.phrases) ||
      typeof parsed.idx !== "number" ||
      typeof parsed.streak !== "number"
    ) {
      return null
    }
    return parsed
  } catch (err) {
    console.error("[pronunciation-coach] localStorage parse failed:", err)
    return null
  }
}

/**
 * One-shot migration from the v1 schema. v1 → v2 drops `mode: "advanced"`
 * because pre-v2 builds shipped the older `openai_whisper-large-v3_turbo`
 * variant that hits a CoreML ANE compile bug (error -14) on M-series iPad.
 * v2 ships the smaller `openai_whisper-large-v3-v20240930_turbo` variant
 * with explicit CPU+GPU compute units. Users with `mode: "advanced"` in
 * v1 storage land on the setup overlay so they reinstall the working
 * variant. Standard mode is preserved.
 */
const loadSavedState = (storage: Storage | null): SavedState | null => {
  if (!storage) return null
  const v2 = parseSavedState(storage.getItem(STORAGE_KEY))
  if (v2) return v2

  const legacy = parseSavedState(storage.getItem(STORAGE_KEY_LEGACY))
  if (!legacy) return null

  const migrated: SavedState = {
    ...legacy,
    mode: legacy.mode === "standard" ? "standard" : undefined,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    storage.removeItem(STORAGE_KEY_LEGACY)
    console.log(
      "[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",
      migrated.mode ?? "(cleared)"
    )
  } catch (err) {
    console.error("[pronunciation-coach] storage migration failed:", err)
  }
  return migrated
}

const newSessionId = (): string => {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto
    if (c && typeof c.randomUUID === "function") {
      return c.randomUUID()
    }
  } catch (err) {
    console.error("[pronunciation-coach] randomUUID failed:", err)
  }
  return `pc-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}

const whisperLang = (lang: string): string => {
  if (!lang) return "en"
  return lang.split("-")[0].toLowerCase()
}

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const pickTranslations = (
  entry: EntryOut,
  languages: string[]
): { target: TranslationOut | null; native: TranslationOut | null } => {
  // Single-language stack (immersion / native practice): practice the one
  // language directly, with no native gloss. Every pack must work with a
  // one-language stack — there is no requirement to add a target language.
  if (languages.length <= 1) {
    const only = languages[0]
    const target = only
      ? entry.translations.find((t) => t.language_code === only) ?? null
      : null
    return { target, native: null }
  }

  // Convention: languages[0] is the native (king) language; the rest are
  // target slots the learner is studying.
  const native =
    languages.length > 0
      ? entry.translations.find((t) => t.language_code === languages[0]) ?? null
      : null

  // Randomly mix across target slots, so a stack of FR/ES/DE/EN (with EN
  // as king) cycles through FR, ES, DE on every phrase. Falls through to
  // the next shuffled slot if a given language has no translation for
  // this entry.
  let target: TranslationOut | null = null
  const targetSlots = shuffle(languages.slice(1))
  for (const lang of targetSlots) {
    const t = entry.translations.find((tr) => tr.language_code === lang)
    if (t) {
      target = t
      break
    }
  }

  // Last-resort fallback: any non-native translation present on the entry.
  if (!target) {
    target =
      entry.translations.find(
        (t) => !native || t.language_code !== native.language_code
      ) ?? null
  }
  return { target, native }
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const dispatchExit = () => {
  try {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  } catch (err) {
    console.error("[pronunciation-coach] dispatch exit failed:", err)
  }
}

const launchConfetti = (root: HTMLElement) => {
  const layer = document.createElement("div")
  layer.className = "pc-confetti"
  const colors = ["#7c3aed", "#16a34a", "#facc15", "#ec4899", "#06b6d4"]
  const count = 32
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span")
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = colors[i % colors.length]
    piece.style.animationDelay = `${Math.random() * 200}ms`
    piece.style.animationDuration = `${900 + Math.random() * 600}ms`
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    layer.appendChild(piece)
  }
  root.appendChild(layer)
  window.setTimeout(() => layer.remove(), 1800)
}

export type GameHandle = {
  unmount: () => void
}

/** Optional mount-time configuration for the practice mode. */
export type MountGameOpts = {
  /** Override the back/close button behavior. By default the
   *  header's `‹` button fires `corpan:exit` and exits the pack.
   *  Parlometron passes a function that returns to the mode picker
   *  instead (so practice → ‹ → picker → × → fully exits). */
  onClose?: () => void
}

/**
 * Practice mode mount — the original single-player flow. Exported
 * under two names: `mountGame` keeps existing callers (e.g.
 * `main.ts`-era imports) working; `mountPractice` is the
 * Parlometron-era name used by `parlometron.ts`'s mode router.
 * Same function, same return contract.
 */
export const mountGame = (
  container: HTMLElement,
  hostApi: HostApi,
  opts?: MountGameOpts
): GameHandle => {
  const stt = (hostApi as unknown as { stt?: SttApi }).stt

  // Chrome is localized into the user's NATIVE language (stack languages[0]),
  // falling back to the device locale, then English. `tt()` localizes a key.
  const uiLang =
    hostApi.getStackConfig().languages[0] ||
    (navigator.language || "en").split("-")[0]
  const tt = (key: I18nKey, params?: Record<string, string>) =>
    i18n(key, uiLang, params)

  let disposed = false
  let activeSessionId: string | null = null

  // ---- Zoom block — disable pinch-zoom for the duration of the
  // pack's mount via viewport-meta override. The host's viewport
  // meta allows user-scalable, which lets a pinch gesture on the
  // models page leave the WebView zoomed-in. We override on mount
  // and restore on unmount. iOS WebKit honors `maximum-scale=1,
  // user-scalable=no` natively — no JS event listeners required.
  // (An earlier draft also installed `gesturestart`/`gesturechange`/
  // `gestureend` non-passive document-level listeners as belt-and-
  // suspenders. Removed: non-passive document-level gesture
  // listeners can make iOS WebKit pessimistic about touch
  // optimization globally and degrade swipe/scroll perf even when
  // the listeners are dormant.)
  const viewportMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]'
  )
  const priorViewportContent = viewportMeta?.getAttribute("content") ?? null
  if (viewportMeta) {
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    )
  }
  const teardownZoomBlock = () => {
    if (viewportMeta && priorViewportContent !== null) {
      viewportMeta.setAttribute("content", priorViewportContent)
    }
  }

  const renderUnavailable = (
    title = "Speech recognition isn't available on this device",
    body = "Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet."
  ) => {
    container.innerHTML = `
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="${escapeHtml(tt("ariaClose"))}">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
        </div>
      </div>
    `
    container
      .querySelector<HTMLButtonElement>("#pc-close")
      ?.addEventListener("click", dispatchExit)
  }

  if (!stt) {
    renderUnavailable()
    return {
      unmount: () => {
        teardownZoomBlock()
        container.innerHTML = ""
      },
    }
  }

  // ---- Build base layout. The first <div> is a viewport-filling backdrop
  // that lives INSIDE the host's pack container, so it shares the host
  // overlay's z=1100 stacking context. It covers the full visual viewport
  // even when iOS leaves a strip below the host's outer wrapper. ----
  container.innerHTML = `
    <div class="pc-backdrop" id="pc-backdrop"></div>

    <div class="pc-root" id="pc-root">
      <div class="pc-header">
        <div class="pc-header-left">
          <button class="pc-back" id="pc-close" type="button"
                  aria-label="Back to Parlometron picker">‹</button>
        </div>
        <button class="pc-lang-badge" id="pc-lang-badge"
                type="button"
                data-pc-lang-badge
                data-pc-lang=""
                aria-label="Target language (long-press to tune Whisper)"
                hidden>—</button>
        <div class="pc-header-right">
          <span class="pc-streak" id="pc-streak" hidden>🔥 <span id="pc-streak-n">0</span></span>
          <button class="pc-mode" id="pc-mode" type="button"
                  aria-pressed="false"
                  aria-label="Switch speech model"
                  title="Speech model">
            <span class="pc-mode-glyph" aria-hidden="true">✦</span>
          </button>
        </div>
      </div>

      <div class="pc-swipe-area" id="pc-swipe-area">
        <div class="pc-deck" id="pc-deck">
          <div class="pc-card" id="pc-card">
            <div class="pc-card-above">
              <div class="pc-result-banner" data-pc-result-banner hidden></div>
              <div class="pc-result-transcript-up" data-pc-result-transcript-up hidden></div>
              <div class="pc-result-bars-up" data-pc-result-bars-up hidden></div>
            </div>
            <div class="pc-card-center">
              <h1 class="pc-target" id="pc-target">${escapeHtml(tt("bootLoading"))}</h1>
              <p class="pc-romanization" id="pc-romanization" hidden></p>
              <p class="pc-native" id="pc-native"></p>
            </div>
            <div class="pc-card-below">
              <div class="pc-result-detail" data-pc-result-detail hidden></div>
            </div>
          </div>
        </div>
      </div>

      <div class="pc-stage">
        <div class="pc-mic-wrap">
          <button class="pc-mic" id="pc-mic" type="button" disabled>
            <span id="pc-mic-icon">●</span>
          </button>
          <div class="pc-mic-label" id="pc-mic-label">Loading model…</div>
          <div class="pc-swipe-hint">${escapeHtml(tt("swipeHint"))}</div>
        </div>
        <div class="pc-error" id="pc-error" hidden></div>
      </div>

      <div class="pc-footer">
        Powered by whisper.cpp · <span id="pc-footer-model">Standard</span> · on-device
      </div>
    </div>
  `

  const closeBtn = container.querySelector<HTMLButtonElement>("#pc-close")!
  const streakEl = container.querySelector<HTMLSpanElement>("#pc-streak")!
  const streakN = container.querySelector<HTMLSpanElement>("#pc-streak-n")!
  const modeBtn = container.querySelector<HTMLButtonElement>("#pc-mode")!
  const swipeAreaEl = container.querySelector<HTMLDivElement>("#pc-swipe-area")!
  const deckEl = container.querySelector<HTMLDivElement>("#pc-deck")!
  let cardEl = container.querySelector<HTMLDivElement>("#pc-card")!
  const micBtn = container.querySelector<HTMLButtonElement>("#pc-mic")!
  const micIcon = container.querySelector<HTMLSpanElement>("#pc-mic-icon")!
  const micLabel = container.querySelector<HTMLDivElement>("#pc-mic-label")!
  // Result decorations live INSIDE the card (selector via the
  // current `cardEl` so a card-swap mid-result targets the live
  // card, never a stale one). Selectors via `data-` attribute
  // because the same id can't repeat across multiple cards in the
  // deck during a slide animation transition.
  const resultBannerOf = (card: HTMLElement) =>
    card.querySelector<HTMLDivElement>("[data-pc-result-banner]")
  const resultTranscriptUpOf = (card: HTMLElement) =>
    card.querySelector<HTMLDivElement>("[data-pc-result-transcript-up]")
  const resultBarsUpOf = (card: HTMLElement) =>
    card.querySelector<HTMLDivElement>("[data-pc-result-bars-up]")
  const resultDetailOf = (card: HTMLElement) =>
    card.querySelector<HTMLDivElement>("[data-pc-result-detail]")
  const errorEl = container.querySelector<HTMLDivElement>("#pc-error")!

  // ---- Loading overlay ----
  let overlay: HTMLDivElement | null = null
  type OverlayOpts = {
    /** When present, render a Cancel button under the message with
     *  this label. Tapping invokes `onCancel`. Use for waits where
     *  the user should retain an escape hatch — e.g., the
     *  INSUFFICIENT_MEMORY retry loop, where we want to absorb the
     *  error and wait for the kernel to reclaim freelist pages
     *  without trapping the user. */
    cancelLabel?: string
    onCancel?: () => void
  }
  const showOverlay = (message: string, opts?: OverlayOpts) => {
    if (!overlay) {
      overlay = document.createElement("div")
      overlay.className = "pc-overlay"
      overlay.innerHTML = `
        <div class="pc-spinner"></div>
        <div id="pc-overlay-msg"></div>
        <button id="pc-overlay-cancel" type="button" hidden></button>`
      document.body.appendChild(overlay)
    }
    const msg = overlay.querySelector("#pc-overlay-msg")
    if (msg) msg.textContent = message
    const cancelBtn = overlay.querySelector<HTMLButtonElement>(
      "#pc-overlay-cancel"
    )
    if (cancelBtn) {
      if (opts?.cancelLabel && opts.onCancel) {
        cancelBtn.textContent = opts.cancelLabel
        cancelBtn.hidden = false
        // Replace any prior handler — every showOverlay call binds
        // a fresh closure.
        cancelBtn.onclick = opts.onCancel
      } else {
        cancelBtn.hidden = true
        cancelBtn.onclick = null
      }
    }
  }
  const hideOverlay = () => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
    overlay = null
  }

  const showError = (message: string) => {
    errorEl.textContent = message
    errorEl.hidden = false
    console.error("[pronunciation-coach]", message)
  }
  const clearError = () => {
    errorEl.textContent = ""
    errorEl.hidden = true
  }

  // ---- State ----
  let uiState: UiState = "idle"
  let modelReady = false
  let currentPhrase: LoadedPhrase | null = null
  const history: LoadedPhrase[] = []
  let historyIdx = -1 // index of currentPhrase inside history
  let prefetched: LoadedPhrase | null = null
  let streak = 0
  let modelMode: ModelMode = defaultModel().id
  let modelSwitching = false

  const storage = safeStorage()
  const persist = () => {
    if (!storage) return
    try {
      // Trim history to a moving window centered on the current index so
      // it stays bounded even on long sessions.
      const start = Math.max(0, history.length - HISTORY_CAP)
      const trimmedPhrases = history.slice(start).map(phraseToSaved)
      const trimmedIdx = historyIdx - start
      const state: SavedState = {
        streak,
        phrases: trimmedPhrases,
        idx: trimmedIdx,
        mode: modelMode,
      }
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.error("[pronunciation-coach] persist failed:", err)
    }
  }

  const renderModeButton = () => {
    const m = modelById(modelMode)
    // Icon-only mode chip. Standard = outlined / neutral; Advanced
    // = filled-accent with the ✦ glyph. The label is communicated
    // entirely through visual state — no text, just a sexy little
    // pill. Tooltip + aria-label still expose the readable name
    // for accessibility / power users.
    modeBtn.setAttribute(
      "aria-pressed",
      modelMode === "advanced" ? "true" : "false"
    )
    modeBtn.classList.toggle("advanced", modelMode === "advanced")
    modeBtn.disabled = modelSwitching
    const tip = m
      ? `${m.label} model (~${m.approxSizeMB} MB) · tap to switch`
      : `${labelForMode(modelMode)} model · tap to switch`
    modeBtn.title = tip
    modeBtn.setAttribute("aria-label", `Speech model: ${labelForMode(modelMode)}`)
    const footerModel = container.querySelector<HTMLSpanElement>("#pc-footer-model")
    if (footerModel) footerModel.textContent = labelForMode(modelMode)
  }

  const updateStreak = () => {
    if (streak <= 0) {
      streakEl.hidden = true
    } else {
      streakN.textContent = String(streak)
      streakEl.hidden = false
    }
  }

  const setUiState = (next: UiState) => {
    uiState = next
    micBtn.classList.remove("recording", "scoring")
    micBtn.disabled = false
    if (next === "idle") {
      micIcon.innerHTML = "●"
      // Reflect the hard daily cap in the idle control (mirrors tutomaton's
      // disabled composer): when blocked, the mic is disabled — tapping it
      // re-shows the lock via startRecording's guard. Subscribers never block.
      const capped = paywallGate.isBlocked()
      micLabel.textContent = capped
        ? tt("dailyDone")
        : modelReady
          ? tt("holdToSpeak")
          : tt("loadingModel")
      micBtn.disabled = !modelReady || !currentPhrase || capped
    } else if (next === "recording") {
      micBtn.classList.add("recording")
      micIcon.innerHTML = "■"
      micLabel.textContent = tt("listeningReleaseToStop")
    } else if (next === "scoring") {
      micBtn.classList.add("scoring")
      micIcon.innerHTML = `<div class="pc-spinner"></div>`
      micLabel.textContent = tt("scoring")
      micBtn.disabled = true
    }
  }

  // ---- Phrase rendering ----
  // Each card uses a 3-row grid so the phrase sits at a fixed
  // vertical slot. The banner above and detail below are added by
  // renderResult INTO the same card (rather than into a separate
  // overlay), so the slide animation takes the card and its
  // decorations off as one unit on swipe.
  const cardSkeleton = (
    targetHtml: string,
    romanHtml: string,
    nativeHtml: string
  ): string => `
    <div class="pc-card-above">
      <div class="pc-result-banner" data-pc-result-banner hidden></div>
      <div class="pc-result-transcript-up" data-pc-result-transcript-up hidden></div>
      <div class="pc-result-bars-up" data-pc-result-bars-up hidden></div>
    </div>
    <div class="pc-card-center">
      ${targetHtml}
      ${romanHtml}
      ${nativeHtml}
    </div>
    <div class="pc-card-below">
      <div class="pc-result-detail" data-pc-result-detail hidden></div>
    </div>
  `

  // The target-language badge lives in the header (`#pc-lang-badge`),
  // not inside the card. One persistent element across phrase swaps,
  // updated by `updateLangBadge` whenever currentPhrase changes.
  // Long-press is wired via delegation on the container (see below).
  const langBadgeEl = container.querySelector<HTMLButtonElement>("#pc-lang-badge")!
  const updateLangBadge = (lang: string | null) => {
    if (!lang) {
      langBadgeEl.hidden = true
      langBadgeEl.textContent = "—"
      langBadgeEl.setAttribute("data-pc-lang", "")
      return
    }
    const base = whisperLang(lang)
    langBadgeEl.hidden = false
    langBadgeEl.textContent = base.toUpperCase()
    langBadgeEl.setAttribute("data-pc-lang", base)
    langBadgeEl.setAttribute(
      "aria-label",
      `Target language ${base.toUpperCase()} — long-press to tune Whisper`
    )
  }

  const fillCard = (card: HTMLDivElement, phrase: LoadedPhrase) => {
    const cfg = hostApi.getStackConfig()
    const showRoman = !!cfg.showRomanization
    const roman = phrase.target.romanization || ""
    const romanHtml =
      showRoman && roman
        ? `<p class="pc-romanization">${escapeHtml(roman)}</p>`
        : ""
    const nativeHtml = phrase.native?.text
      ? `<p class="pc-native">${escapeHtml(phrase.native.text)}</p>`
      : ""
    card.innerHTML = cardSkeleton(
      `<h1 class="pc-target">${escapeHtml(phrase.target.text || "—")}</h1>`,
      romanHtml,
      nativeHtml
    )
    updateLangBadge(phrase.targetLang)
  }

  const renderEmptyCard = (
    card: HTMLDivElement,
    headline: string,
    sub?: string
  ) => {
    card.innerHTML = cardSkeleton(
      `<h1 class="pc-target">${escapeHtml(headline)}</h1>`,
      "",
      sub ? `<p class="pc-native">${escapeHtml(sub)}</p>` : ""
    )
    updateLangBadge(null)
  }

  const renderCurrentPhrase = () => {
    if (!currentPhrase) return
    fillCard(cardEl, currentPhrase)
  }

  // Slide animation: move out, then swap, then slide in.
  const slideTo = async (
    direction: "left" | "right",
    populate: (newCard: HTMLDivElement) => void
  ): Promise<void> => {
    const width = deckEl.clientWidth || window.innerWidth
    const dir = direction === "left" ? -1 : 1
    // Animate current card off-screen.
    cardEl.style.transition =
      "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease"
    cardEl.style.transform = `translateX(${dir * width}px)`
    cardEl.style.opacity = "0"
    await new Promise((r) => window.setTimeout(r, 220))

    const newCard = document.createElement("div")
    newCard.className = "pc-card entering"
    newCard.id = "pc-card"
    newCard.style.transition = "none"
    newCard.style.transform = `translateX(${-dir * width}px)`
    newCard.style.opacity = "0"
    populate(newCard)
    deckEl.replaceChild(newCard, cardEl)
    cardEl = newCard

    // Force reflow so the next transition runs.
    void cardEl.offsetWidth
    cardEl.style.transition =
      "transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease"
    cardEl.style.transform = "translateX(0)"
    cardEl.style.opacity = "1"
    cardEl.classList.remove("entering")
    cardEl.classList.add("entered")
  }

  const fetchOneEntry = async (): Promise<LoadedPhrase | null> => {
    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) return null
    if (!hostApi.getRandomEntry) return null
    const entry = await hostApi.getRandomEntry()
    const { target, native } = pickTranslations(entry, cfg.languages)
    if (!target) return null
    return { entry, target, native, targetLang: target.language_code }
  }

  const prefetchInBackground = () => {
    if (prefetched || disposed) return
    fetchOneEntry()
      .then((p) => {
        if (!disposed && p) prefetched = p
      })
      .catch((err) => {
        console.error("[pronunciation-coach] prefetch failed:", err)
      })
  }

  // ---- Navigation ----
  const goNext = async () => {
    if (uiState === "scoring") return
    cancelActiveSession()
    clearError()
    // Do NOT clearResult() here. The result decorations live inside
    // the card; the slide animation takes them off-screen as one
    // unit with the phrase. Calling clearResult before the slide
    // would visually snap the decorations off, briefly show the
    // bare phrase, THEN run the slide — three motions where the
    // user should observe one. The new card is rendered fresh by
    // fillCard via cardSkeleton, with empty (hidden) result slots.

    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) {
      currentPhrase = null
      renderEmptyCard(
        cardEl,
        tt("noLanguageSelected"),
        tt("chooseLanguageToStudy")
      )
      micBtn.disabled = true
      micLabel.textContent = "—"
      return
    }

    // Forward through history if we previously went back; otherwise fetch.
    if (historyIdx >= 0 && historyIdx < history.length - 1) {
      const next = history[historyIdx + 1]
      historyIdx += 1
      await slideTo("left", (c) => fillCard(c, next))
      currentPhrase = next
      setUiState("idle")
      persist()
      return
    }

    let next: LoadedPhrase | null = prefetched
    prefetched = null
    if (!next) {
      try {
        next = await fetchOneEntry()
      } catch (err) {
        console.error("[pronunciation-coach] fetch next failed:", err)
        showError(
          tt("errLoadPhrase", { error: formatErr(err) })
        )
        return
      }
    }
    if (!next) {
      showError(tt("noPhrasesAvailable"))
      return
    }

    history.push(next)
    historyIdx = history.length - 1
    await slideTo("left", (c) => fillCard(c, next!))
    currentPhrase = next
    setUiState("idle")
    persist()
    prefetchInBackground()
  }

  const goPrev = async () => {
    if (uiState === "scoring") return
    if (historyIdx <= 0) return // nothing before
    cancelActiveSession()
    clearError()
    // See goNext: do not clearResult before the slide.

    const prev = history[historyIdx - 1]
    historyIdx -= 1
    await slideTo("right", (c) => fillCard(c, prev))
    currentPhrase = prev
    setUiState("idle")
    persist()
  }

  // ---- Result rendering ----
  // Clear result decorations from a specific card. We pass the card
  // explicitly so callers can clear the LIVE card during a same-card
  // retry (mic tap) without accidentally clearing a sibling card
  // mid-slide. Navigation paths (swipe / skip / mode change) don't
  // call this — they slide the whole card off, which carries the
  // decorations with it as one motion.
  //
  // Decorations animate out (leaving class triggers a 220ms fade)
  // before the DOM nodes are emptied. Without the leaving class,
  // re-recording on the same card would snap the colored word
  // pills off instantly, which felt abrupt — gentle fade-out
  // matches the gentle fade-in.
  const clearResultOnCard = (card: HTMLDivElement) => {
    const banner = resultBannerOf(card)
    const transUp = resultTranscriptUpOf(card)
    const barsUp = resultBarsUpOf(card)
    const detail = resultDetailOf(card)
    const finalize = () => {
      if (banner) {
        banner.innerHTML = ""
        banner.hidden = true
        banner.className = "pc-result-banner"
      }
      if (transUp) {
        transUp.innerHTML = ""
        transUp.hidden = true
        transUp.className = "pc-result-transcript-up"
      }
      if (barsUp) {
        barsUp.innerHTML = ""
        barsUp.hidden = true
        barsUp.className = "pc-result-bars-up"
      }
      if (detail) {
        detail.innerHTML = ""
        detail.hidden = true
        detail.className = "pc-result-detail"
      }
    }
    const wasShowing =
      (banner && !banner.hidden) ||
      (transUp && !transUp.hidden) ||
      (barsUp && !barsUp.hidden) ||
      (detail && !detail.hidden)
    if (!wasShowing) {
      finalize()
      return
    }
    if (banner && !banner.hidden) banner.classList.add("leaving")
    if (transUp && !transUp.hidden) transUp.classList.add("leaving")
    if (barsUp && !barsUp.hidden) barsUp.classList.add("leaving")
    if (detail && !detail.hidden) detail.classList.add("leaving")
    // Match the 220ms `pc-banner-out` / `pc-detail-out` keyframes.
    window.setTimeout(finalize, 220)
  }
  const clearResult = () => clearResultOnCard(cardEl)

  const renderResult = (result: SttTranscriptionResult) => {
    const overall = Math.max(0, Math.min(1, result.overallScore))
    const noSpeech = Math.max(0, Math.min(1, result.noSpeechProb ?? 0))
    const compression = result.compressionRatio ?? 0

    // Phase 2 calibration telemetry. One concise line per attempt to
    // /tmp/pc-console.log via the dev console-server forwarder. Pair
    // with Swift's `Whisper |` os_log lines in /tmp/whisper-trace-live.txt
    // to read the full picture of how each attempt scored.
    console.info("[PRON:score]", {
      lang: result.whisperLanguage || result.language,
      model: folderForMode(modelMode),
      expected: currentPhrase?.target.text ?? "",
      heard: result.text,
      free: result.freeText,
      overall: result.overallScore,
      transcript: result.transcriptScore,
      acoustic: result.acousticScore,
      likelihood: result.likelihoodScore,
      noSpeechProb: result.noSpeechProb,
      compressionRatio: result.compressionRatio,
      avgLogprob: result.avgLogprob,
      minTokenLogprob: result.minTokenLogprob,
      tokenLogprobStdev: result.tokenLogprobStdev,
      temperature: result.temperature,
    })

    const freeVsConstrained = Math.max(
      0,
      Math.min(1, result.freeVsConstrainedSimilarity ?? 1)
    )
    const pct = (n: number) => `${Math.round(n * 100)}%`

    // Hard-gate UI: if Whisper's noSpeechProb says the audio was
    // effectively silent, render a specific message rather than a
    // numeric score breakdown.
    const silent = noSpeech > 0.5
    // Verdict tiers — wider spectrum so the headline tracks the score.
    // 75% used to read "Nailed it"; that's reserved for genuinely
    // strong attempts now. Confetti and streak only count above 0.85
    // (real "nailed it"), the upper tiers below are for nuance.
    let headlineClass = "bad"
    let headlineText = tt("resultTryAgain")
    if (silent) {
      headlineClass = "bad"
      headlineText = tt("resultCouldntHear")
    } else if (overall >= 0.95) {
      headlineClass = "good"
      headlineText = tt("resultPerfect")
    } else if (overall >= 0.85) {
      headlineClass = "good"
      headlineText = tt("resultNailedIt")
    } else if (overall >= 0.75) {
      headlineClass = "good"
      headlineText = tt("resultGreat")
    } else if (overall >= 0.60) {
      headlineClass = "okay"
      headlineText = tt("resultPrettyGood")
    } else if (overall >= 0.45) {
      headlineClass = "okay"
      headlineText = tt("resultCloseKeepGoing")
    } else if (overall >= 0.25) {
      headlineClass = "bad"
      headlineText = tt("resultKeepPracticing")
    }

    if (silent) {
      // Mic-was-silent failure shouldn't break the user's streak —
      // they didn't actually attempt the phrase.
    } else if (overall >= 0.85) {
      streak += 1
      launchConfetti(document.body)
    } else if (overall >= 0.60) {
      // "Pretty good / Great" — keeps the streak alive (no reset)
      // but no confetti reward.
    } else {
      streak = 0
    }
    updateStreak()
    persist()

    // Word pills represent the EXPECTED phrase (not what was heard).
    // Tapping speaks that word in the target language so the user can
    // study individual words.
    //
    // Pill color combines two signals:
    //   - heardProb: the constrained-decode per-word probability.
    //     Inflated by `prefixTokens` (the model is just confirming
    //     forced tokens), so on its own it gives green pills even
    //     when pronunciation was poor.
    //   - freeSim: character-level similarity between the expected
    //     word and the free-decode word at that position (or to the
    //     full free transcript when positional alignment isn't
    //     possible). The free decode is uncoerced, so this is the
    //     honest signal. Low freeSim = the model heard something
    //     different at that spot — a real pronunciation problem.
    // The pill takes the *worst* tier of the two so we never show a
    // green pill when the free decode disagrees.
    const heardWords = mergeApostropheWords(result.words || [])
    const expectedText = (currentPhrase?.target.text || "").trim()
    // CJK phrases ("你好嗎") have no whitespace — tokenize per
    // grapheme so each character becomes its own tappable pill.
    // Latin / spaced scripts continue to split on whitespace.
    const expectedTokens = tokenizeForPills(expectedText)
    const freeText = (result.freeText || "").trim()
    const freeTokens = tokenizeForPills(freeText)
    const useHeardProbs =
      expectedTokens.length > 0 &&
      expectedTokens.length === heardWords.length
    const useFreePositional =
      expectedTokens.length > 0 &&
      expectedTokens.length === freeTokens.length
    // Fallback when free word count doesn't align: apply the global
    // free-vs-expected character similarity to every pill so the
    // honest signal still shows up.
    //
    // Free decode is supposed to run on every transcribe. Empty free
    // text with a real expected phrase = a genuine failure — the
    // plugin already drives the overall score to 0 in this case, but
    // we also need to color the pills honestly so we don't show
    // green pills on top of a 0% score (the contradiction the user
    // flagged). Treat empty-free as 0 similarity at the pill level
    // too.
    const freeDecodeFailed = expectedText.length > 0 && freeText.length === 0
    const compareLang = currentPhrase?.targetLang || result.language || ""
    const overallFreeSim =
      freeText.length && expectedText.length
        ? charSimilarity(
            normalizeForCompare(freeText, compareLang),
            normalizeForCompare(expectedText, compareLang)
          )
        : freeDecodeFailed
          ? 0
          : null
    type WordPill = {
      word: string
      heardProb: number | null
      freeSim: number | null
    }
    const pills: WordPill[] = expectedTokens.length
      ? expectedTokens.map((tok, i) => ({
          word: tok,
          heardProb: useHeardProbs ? heardWords[i].probability : null,
          freeSim: useFreePositional
            ? charSimilarity(
                normalizeForCompare(tok, compareLang),
                normalizeForCompare(freeTokens[i], compareLang)
              )
            : overallFreeSim,
        }))
      : expectedText
        ? [
            {
              word: expectedText,
              heardProb: null,
              freeSim: overallFreeSim,
            },
          ]
        : []
    const heardTier = (p: number | null): "good" | "okay" | "bad" | null => {
      if (p === null) return null
      if (p >= 0.9) return "good"
      if (p >= 0.6) return "okay"
      return "bad"
    }
    const freeTier = (s: number | null): "good" | "okay" | "bad" | null => {
      if (s === null) return null
      if (s >= 0.85) return "good"
      if (s >= 0.6) return "okay"
      return "bad"
    }
    const tierRank: Record<"bad" | "okay" | "good", number> = {
      bad: 0,
      okay: 1,
      good: 2,
    }
    const pillClass = (w: WordPill): string => {
      const h = heardTier(w.heardProb)
      const f = freeTier(w.freeSim)
      if (h === null && f === null) return ""
      if (h === null) return f as string
      if (f === null) return h
      return tierRank[h] <= tierRank[f] ? h : f
    }
    const wordsHtml = pills
      .map((w, idx) => {
        const cls = pillClass(w)
        return `<button class="pc-word ${cls}" type="button" data-pc-word-idx="${idx}" aria-label="${escapeHtml(
          tt("ariaSpeakWord", { word: w.word })
        )}">${escapeHtml(w.word)}</button>`
      })
      .join("")

    // "Heard you say" — the FREE decode (honest signal, no prefix
    // bias). Stacked, centered block: small muted label on its own
    // line, then ▶ + transcript inline below. The whole block is
    // the tap target (the ▶ is a visual affordance, not the hit
    // area). Empty branch keeps the same shape so the layout
    // doesn't shift between success and failure.
    //
    // RTL target langs: flip play affordance to the right side and
    // point the glyph leftward (◀), since reading flows right→left.
    const rtl = isRTL(compareLang)
    const lineCls = rtl ? "pc-transcript-line pc-transcript-line-rtl" : "pc-transcript-line"
    const playGlyph = rtl ? "◀" : "▶"
    const heardRow = freeText.length
      ? `<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="${escapeHtml(tt("ariaPlayHeard"))}">
           <span class="pc-transcript-label">${escapeHtml(tt("heardYouSay"))}</span>
           <span class="${lineCls}">
             <span class="pc-transcript-play" aria-hidden="true">${playGlyph}</span>
             <span class="pc-transcript-text">${escapeHtml(freeText)}</span>
           </span>
         </div>`
      : freeDecodeFailed
        ? `<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">${escapeHtml(tt("heardYouSay"))}</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">${escapeHtml(tt("couldntMakeOutWords"))}</span>
             </span>
           </div>`
        : ""
    const transcriptsHtml = heardRow
      ? `<div class="pc-transcripts">${heardRow}</div>`
      : ""

    // Friendly diagnostic chips — surface only when something
    // genuinely went off, in plain language a kid (or a parent on
    // their first try) can act on. Truly technical signals
    // (`temperature`, `whisperLanguage`, `compressionRatio` numeric
    // value) stay in OSLog but never reach the UI.
    //
    // Script-mismatch traps (Whisper outputs Gurmukhi for `pa`,
    // picks one CJK script for `zh`, etc.) get a neutral note since
    // the user can't fix it — it's a signal that the score may not
    // mean what they expect.
    const knownScriptMismatch: Record<string, string> = {
      "pa-arab": tt("chipDifferentScript"),
      "yue-hant-hk": tt("chipDifferentScript"),
      "zh-hans": tt("chipDifferentScript"),
      "zh-hant": tt("chipDifferentScript"),
    }
    const lcLang = (result.language ?? "").toLowerCase()
    const scriptMismatchNote = knownScriptMismatch[lcLang]
    const diagChips: string[] = []
    if (noSpeech > 0.2)
      diagChips.push(
        `<div class="pc-chip pc-chip-warn">${escapeHtml(tt("chipSoundedFaint"))}</div>`
      )
    // Compression ratio is calibrated for Latin-script languages.
    // Indic / Persian / Urdu BPE legitimately runs higher (2.5–3.5)
    // even on clean speech, so suppress the chip there to avoid
    // false-positive "garbled" warnings on perfect Tamil / Telugu
    // attempts. Mirrors the per-lang threshold in the plugin.
    const compareBaseLang = compareLang.toLowerCase().split("-")[0]
    const compressionThreshold = LOW_RESOURCE_LANGS.has(compareBaseLang)
      ? 3.5
      : 2.4
    if (compression > compressionThreshold)
      diagChips.push(
        `<div class="pc-chip pc-chip-warn">${escapeHtml(tt("chipSoundedGarbled"))}</div>`
      )
    if (freeDecodeFailed)
      diagChips.push(
        `<div class="pc-chip pc-chip-warn">${escapeHtml(tt("chipCouldntMakeOut"))}</div>`
      )
    else if (freeVsConstrained < 0.6)
      diagChips.push(
        `<div class="pc-chip pc-chip-warn">${escapeHtml(tt("chipWordsDidntMatch"))}</div>`
      )
    if (scriptMismatchNote)
      diagChips.push(
        `<div class="pc-chip">${escapeHtml(scriptMismatchNote)}</div>`
      )
    const diagHtml = diagChips.length
      ? `<div class="pc-chips pc-diagnostics">${diagChips.join("")}</div>`
      : ""

    // Render banner + detail INTO the live card's slots. The phrase
    // stays where it is (visual hero); the banner appears just above
    // it as a compact pill, the detail appears below.
    //
    // Per-word pills go FIRST in the detail (directly below the
    // phrase) because that's where the user's eye is anchored —
    // immediate visual connection between phrase and per-word
    // feedback. Transcripts, bars, diagnostics, and Hear-it follow.
    const bannerEl = resultBannerOf(cardEl)
    const transUpEl = resultTranscriptUpOf(cardEl)
    const barsUpEl = resultBarsUpOf(cardEl)
    const detailEl = resultDetailOf(cardEl)
    if (!bannerEl || !detailEl) {
      // The current card lacks the result slots (shouldn't happen
      // with the cardSkeleton template but guard so we don't throw).
      console.error(
        "[pronunciation-coach] renderResult: card missing result slots"
      )
      return
    }
    if (silent) {
      // Quiet failure path — score is "—", show a friendly chip and
      // a Hear-it. Banner uses the okay tint (warning, not failure).
      bannerEl.className = `pc-result-banner ${headlineClass}`
      bannerEl.innerHTML = `
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${headlineText}</span>
      `
      bannerEl.hidden = false
      detailEl.innerHTML = `
        <div class="pc-chips">
          <div class="pc-chip">${escapeHtml(tt("hintMoveCloser"))}</div>
        </div>
      `
      detailEl.hidden = false
    } else {
      bannerEl.className = `pc-result-banner ${headlineClass}`
      bannerEl.innerHTML = `
        <span class="pc-result-banner-score">${pct(overall)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${headlineText}</span>
      `
      bannerEl.hidden = false
      // Composition above the phrase: banner (% + headline) →
      // "Heard you say". Composition below: per-word pills →
      // diagnostics. The bars-up slot is intentionally left empty
      // — the headline number and per-word pills together carry
      // the score story without redundant 0–100% bars.
      if (transUpEl) {
        transUpEl.innerHTML = transcriptsHtml
        transUpEl.hidden = !transcriptsHtml
      }
      if (barsUpEl) {
        barsUpEl.innerHTML = ""
        barsUpEl.hidden = true
      }
      // No "Hear it" button — the per-word pills are already
      // tap-to-hear, which covers re-listening more usefully (you
      // can hear an individual word, not just the whole phrase).
      // The phrase header itself is also tap-to-hear (existing
      // .pc-target click binding).
      const wordsCls = rtl ? "pc-words pc-words-rtl" : "pc-words"
      detailEl.innerHTML = `
        ${wordsHtml ? `<div class="${wordsCls}">${wordsHtml}</div>` : ""}
        ${diagHtml}
      `
      detailEl.hidden = false
    }

    const speakInTarget = (text: string, label: string) => {
      const lang = currentPhrase?.targetLang || result.language || "en"
      try {
        const r = hostApi.speak(lang, text)
        if (r && typeof (r as Promise<void>).catch === "function") {
          ;(r as Promise<void>).catch((err) => {
            console.error(
              `[pronunciation-coach] ${label} speak failed:`,
              err
            )
          })
        }
      } catch (err) {
        console.error(`[pronunciation-coach] ${label} speak threw:`, err)
      }
    }

    // Per-word TTS: tap a pill to hear that word in the target
    // language. Scope all button queries to the live card so a
    // mid-render slide can never bind handlers to a stale card.
    const wordPills = detailEl.querySelectorAll<HTMLButtonElement>(
      "button.pc-word[data-pc-word-idx]"
    )
    wordPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const idxStr = pill.getAttribute("data-pc-word-idx")
        if (idxStr === null) return
        const idx = Number(idxStr)
        const word = pills[idx]
        if (!word) return
        speakInTarget(word.word.trim(), "word")
      })
    })

    // Tap anywhere on the "Heard you say" row → speak the free
    // transcript in the target-language voice. The whole row is
    // the tap target, not just the small ▶ icon (better hit area
    // for thumbs). Scope to the whole card because the row now
    // lives ABOVE the phrase (in the transcript-up slot), not
    // inside detailEl.
    const transcriptRows = cardEl.querySelectorAll<HTMLElement>(
      ".pc-transcript-row[data-pc-speak]"
    )
    transcriptRows.forEach((row) => {
      const speak = () => {
        if (!freeText) return
        speakInTarget(freeText, "heard")
      }
      row.addEventListener("click", speak)
      row.addEventListener("keydown", (e: Event) => {
        const k = (e as KeyboardEvent).key
        if (k === "Enter" || k === " ") {
          e.preventDefault()
          speak()
        }
      })
    })

    // (No #pc-hear button — per-word pills cover re-listen, and
    //  tapping the .pc-target header still speaks the whole phrase.)
  }

  // ---- Mic flow ----
  const cancelActiveSession = () => {
    const sessionId = activeSessionId
    activeSessionId = null
    if (sessionId) {
      stt.cancelSession({ sessionId }).catch((err) => {
        console.error("[pronunciation-coach] cancelSession failed:", err)
      })
    }
  }

  const startRecording = async () => {
    if (!currentPhrase || !modelReady) return
    // Hard daily cap: starting a new round is the metered action. Once the free
    // user has reached PARLO_DAILY_LIMIT scored rounds they get EXACTLY that
    // many — re-show the accomplishment-lock overlay and refuse to record
    // another. Subscribers never block (isBlocked reads the host-injected Plus).
    if (paywallGate.isBlocked()) {
      paywallGate.requestDailyLock()
      setUiState("idle")
      return
    }
    clearError()
    clearResult()
    const sessionId = newSessionId()
    activeSessionId = sessionId
    try {
      setUiState("recording")
      const lang = whisperLang(currentPhrase.targetLang)
      const res = await stt.startSession({
        sessionId,
        language: lang,
        expectedText: currentPhrase.target.text,
        whisperParams: mergeForLang(lang),
        scoringParams: mergeScoringForLangModel(lang, folderForMode(modelMode)),
      })
      if (disposed) return
      if (!res.started) {
        throw new Error("STT plugin reported started=false")
      }
    } catch (err) {
      console.error("[pronunciation-coach] startSession failed:", err)
      activeSessionId = null
      showError(
        tt("errStartRecording", { error: formatErr(err) })
      )
      setUiState("idle")
    }
  }

  const tryPrepareOnce = async (mode: ModelMode): Promise<SttPrepareResult> => {
    if (!stt) throw new Error("STT unavailable")
    const model = folderForMode(mode)
    const r = await withTimeout(
      stt.prepare({ model }),
      prepareTimeoutMs(mode),
      `Loading ${labelForMode(mode)} model`
    )
    if (!r.ready) {
      // Throw with `code` attached so callers can route on err.code
      // instead of substring-matching the message.
      const e = new Error(r.message || "Model not ready") as Error & {
        code?: SttErrorCode
      }
      e.code = r.code
      throw e
    }
    return r
  }

  // prepare() is local-only — never downloads. On failure we route on
  // the structured code; we NEVER auto-wipe model files. The "model on
  // disk is bad" case opens a banner with a Reinstall action; the user
  // — not a substring heuristic — decides whether to delete files.
  const prepareWithRecovery = tryPrepareOnce

  /// Sentinel thrown when the user taps Cancel on the
  /// INSUFFICIENT_MEMORY retry overlay. Distinct from a real error
  /// so the catch block can do "switch cancelled" instead of "load
  /// failed" messaging.
  class SwitchCancelledError extends Error {
    constructor() {
      super("Switch cancelled by user")
      this.name = "SwitchCancelledError"
    }
  }

  /// Wraps `prepareWithRecovery` with a memory-wait retry loop. The
  /// native plugin's headroom gate returns `INSUFFICIENT_MEMORY`
  /// when the OS still has the previous model parked on the C heap
  /// freelist and a new allocation would push peak resident past
  /// the jetsam ceiling. Empirically (May-17 device traces) waiting
  /// 5-10 seconds is enough for iOS to reclaim those pages, so
  /// rather than bouncing the user to a scary "restart Corpán"
  /// error we absorb the failure, show a "Freeing memory..." overlay
  /// with a Cancel button, and retry up to MEMORY_WAIT_MAX_ATTEMPTS.
  ///
  /// Returns the successful `SttPrepareResult` on the first attempt
  /// that lands. Throws `SwitchCancelledError` if the user cancels,
  /// or re-throws the underlying error if it's not
  /// INSUFFICIENT_MEMORY (or if we exhaust attempts — at which
  /// point the catch block can show the standard "couldn't load"
  /// fallback).
  const MEMORY_WAIT_INTERVAL_MS = 1500
  const MEMORY_WAIT_MAX_ATTEMPTS = 10
  const prepareWithMemoryRetry = async (
    mode: ModelMode
  ): Promise<SttPrepareResult> => {
    const targetLabel = labelForMode(mode)
    let lastError: unknown = null
    let cancelled = false
    const cancel = () => {
      cancelled = true
    }
    for (let attempt = 1; attempt <= MEMORY_WAIT_MAX_ATTEMPTS; attempt++) {
      if (cancelled) throw new SwitchCancelledError()
      try {
        return await prepareWithRecovery(mode)
      } catch (err) {
        const code = errCode(err)
        if (code !== "INSUFFICIENT_MEMORY") {
          // Different failure mode — bubble up to the regular catch
          // (MODEL_NOT_INSTALLED, NETWORK, LOAD_FAILED, etc.).
          throw err
        }
        lastError = err
        if (attempt === MEMORY_WAIT_MAX_ATTEMPTS) break
        // Show the retry overlay with cancel. Update the message
        // each attempt so the user has a sense of progress.
        const remaining = MEMORY_WAIT_MAX_ATTEMPTS - attempt
        showOverlay(
          `Freeing memory for ${targetLabel}…\nThis usually takes a few seconds.`,
          { cancelLabel: "Cancel", onCancel: cancel }
        )
        console.log(
          `[pronunciation-coach] INSUFFICIENT_MEMORY on attempt ${attempt}; ` +
            `waiting ${MEMORY_WAIT_INTERVAL_MS}ms, ${remaining} retries left`
        )
        await new Promise<void>((resolve) =>
          setTimeout(resolve, MEMORY_WAIT_INTERVAL_MS)
        )
      }
    }
    // Exhausted retries with INSUFFICIENT_MEMORY still firing — the
    // device really is out of headroom right now. Re-throw the last
    // error so the catch block routes to the "restart Corpán" path.
    throw lastError ?? new Error("INSUFFICIENT_MEMORY")
  }

  const stopRecording = async () => {
    const sessionId = activeSessionId
    if (!sessionId) {
      setUiState("idle")
      return
    }
    activeSessionId = null
    try {
      setUiState("scoring")
      const result = await withTimeout(
        stt.stopSession({ sessionId }),
        TRANSCRIBE_TIMEOUT_MS,
        "Scoring"
      )
      if (disposed) return
      renderResult(result)
      // One solo round completed — advance the daily gate (fires the soft nag /
      // accomplishment lock internally; no-op for subscribers).
      paywallGate.note()
      setUiState("idle")
    } catch (err) {
      const msg = formatErr(err)
      const code = errCode(err)
      console.error(
        `[pronunciation-coach] stopSession failed (code=${code ?? "—"}):`,
        msg
      )
      setUiState("idle")
      if (code === "LOAD_FAILED") {
        // The on-disk model bytes failed at runtime. We do NOT wipe —
        // the user decides via the setup overlay whether to reinstall.
        // No silent destructive action; that was the bug class we just
        // ripped out.
        modelReady = false
        micBtn.disabled = true
        micLabel.textContent = "Model needs reinstall"
        showError(
          `${labelForMode(modelMode)} model failed to load — opening setup so you can reinstall.`
        )
        openModelSetup().catch((err) => {
          console.error(
            "[pronunciation-coach] openModelSetup after LOAD_FAILED:",
            err
          )
        })
        return
      }
      if (code === "NETWORK") {
        showError(
          tt("errNetworkBlip")
        )
        return
      }
      showError(tt("errScoringFailed", { error: msg }))
    }
  }

  // Hold-to-speak: press and hold the mic to record, release to stop +
  // score. Pointer events (not click) so it works for touch and mouse;
  // setPointerCapture keeps pointerup landing here even if the finger
  // slides off the button, and pointercancel covers an interrupted
  // gesture (call, system gesture) so we can never get stuck recording.
  let micHoldActive = false
  const beginMicHold = (e: PointerEvent) => {
    if (uiState !== "idle" || !modelReady || !currentPhrase) return
    e.preventDefault()
    micHoldActive = true
    try {
      micBtn.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort; pointercancel still ends the hold */
    }
    startRecording().catch((err) => {
      console.error("[pronunciation-coach] hold-start threw:", err)
    })
  }
  const endMicHold = (e: PointerEvent) => {
    if (!micHoldActive) return
    micHoldActive = false
    try {
      micBtn.releasePointerCapture(e.pointerId)
    } catch {
      /* no-op if capture was never granted */
    }
    if (uiState === "recording") {
      stopRecording().catch((err) => {
        console.error("[pronunciation-coach] hold-stop threw:", err)
      })
    }
  }
  micBtn.addEventListener("pointerdown", beginMicHold)
  micBtn.addEventListener("pointerup", endMicHold)
  micBtn.addEventListener("pointercancel", endMicHold)

  // Skip button removed from the header — swipe ←/→ already covers
  // skip-to-next, and removing the redundant button cleans up the
  // top of the screen significantly (especially on phones where
  // every chiclet competes for the safe-area-top strip).

  closeBtn.addEventListener("click", () => {
    cancelActiveSession()
    // Caller (parlometron.ts) overrides the default exit so the
    // header's `‹` returns to the mode picker instead of leaving
    // the pack entirely. When mounted standalone (no opts), still
    // fires the legacy `corpan:exit` event the host expects.
    if (opts?.onClose) opts.onClose()
    else dispatchExit()
  })

  // Re-prepare the saved-mode native context if it isn't currently
  // loaded. Idempotent: if prepare hits its in-memory cache, returns
  // immediately. Install and unload paths can drop the previous native
  // context while leaving its files and marker on disk; calling this
  // after setup restores the working state without a JS-side guess
  // about what the plugin did internally.
  const ensureLoaded = async (mode: ModelMode): Promise<boolean> => {
    if (!stt?.prepare) return false
    try {
      const r = await stt.prepare({ model: folderForMode(mode) })
      if (r.ready) return true
      console.error(
        `[pronunciation-coach] ensureLoaded(${mode}) failed: code=${r.code ?? "—"} msg=${r.message ?? ""}`
      )
      return false
    } catch (err) {
      console.error(`[pronunciation-coach] ensureLoaded(${mode}) threw:`, err)
      return false
    }
  }

  // Mode button reopens the setup screen so the user explicitly picks a
  // model and watches the install — no more silent inline downloads.
  const openModelSetup = async () => {
    if (modelSwitching) return
    modelSwitching = true
    cancelActiveSession()
    setUiState("idle")
    const previous: ModelMode = modelMode
    // Treat modelMode as active if either (a) it's currently loaded,
    // OR (b) its install hint says it's installed. The latter
    // guards the failed-switch case where a load attempt for the
    // currentActive only counts the in-memory kit (true session
    // state, not a cache). If modelReady is false the overlay will
    // render every card as "Checking…" until validateModel returns,
    // and only then will buttons appear. No risk of stale buttons
    // on a model that isn't actually installed in this container.
    const activeForOverlay: ModelMode | null = modelReady ? modelMode : null
    console.log(
      `[pronunciation-coach] openModelSetup: modelMode=${modelMode} modelReady=${modelReady} activeForOverlay=${activeForOverlay ?? "null"}`
    )
    let outcome: SetupOutcome
    try {
      outcome = await runSetup({
        currentActive: activeForOverlay,
        headline: "Parlometron · Models",
        sub: "These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷",
      })
    } finally {
      modelSwitching = false
      renderModeButton()
    }
    if (disposed) return
    if (outcome.kind === "exit") {
      // The plugin's install path may have dropped our previously
      // loaded kit before failing or being cancelled. Re-prepare the
      // saved mode so we don't leave the user with a nil kit.
      if (!modelReady && previous && (await ensureLoaded(previous))) {
        modelReady = true
      }
      return
    }
    if (outcome.kind === "cancelled") {
      setUiState("idle")
      // Same as above: install may have dropped the previous kit
      // before being cancelled. Restore.
      if (!modelReady && previous && (await ensureLoaded(previous))) {
        modelReady = true
      }
      return
    }
    if (outcome.mode === previous && modelReady) {
      setUiState("idle")
      return
    }
    // Capture target locally; do NOT mutate modelMode or persist yet.
    // Persisting before a successful prepare() poisons localStorage:
    // if install reported success but prepare then fails (e.g.,
    // partial download where MelSpectrogram never landed), the saved
    // mode points at a broken install and every subsequent boot
    // re-enters this failure loop. Only persist after prepare wins.
    const targetMode: ModelMode = outcome.mode
    const targetLabel = labelForMode(targetMode)

    // Pre-flight memory check. Native has the authoritative gate
    // inside prepare() (after the previous model is actually
    // unloaded and pages reclaimed), but doing a fast JS-side check
    // FIRST lets us refuse obviously-impossible switches without
    // unloading the currently-working model. If we unloaded then
    // discovered insufficient memory, the user would be stuck with
    // no working model until restart — bad UX. By checking BEFORE
    // unload, the worst case is "we kept your working model and
    // showed a clear message."
    //
    // Heuristic: current available memory (with old model still
    // loaded) should be ≥ targetSize × 0.5. The 0.5× anticipates
    // the old model's bytes being reclaimed when we unload, plus
    // some working memory. The native gate uses 1.3× measured
    // AFTER unload — that's the precise check; this is the fast
    // refuse-the-obvious-no-go path.
    const targetVariant = modelById(targetMode)
    const targetSizeMB = targetVariant?.approxSizeMB ?? 0
    if (targetSizeMB > 0 && stt?.getStatus) {
      try {
        const status = await stt.getStatus()
        const availMB = status.availableMemoryMB ?? null
        if (availMB !== null && availMB < targetSizeMB * 0.5) {
          console.warn(
            `[pronunciation-coach] pre-flight refused switch to ${targetMode}: avail=${availMB}MB target=${targetSizeMB}MB`
          )
          setUiState("idle")
          showError(
            `Not enough memory to switch to ${targetLabel} right now (${availMB} MB free, need ~${Math.round(targetSizeMB * 1.3)} MB). ` +
              `Close other apps and restart Corpán, then try again. Your current model is still loaded.`
          )
          return
        }
      } catch (err) {
        console.warn(
          "[pronunciation-coach] pre-flight status check failed; deferring to native gate:",
          err
        )
      }
    }

    modelReady = false
    micBtn.disabled = true
    // Defense in depth: explicitly unload the previously-loaded model
    // before asking for the new one. The Swift plugin already chains
    // prepare() calls so two loads can't run concurrently, but
    // dropping the previous kit on the JS side first means the user
    // sees a clear "Unloading… → Loading…" progression instead of an
    // opaque pause, AND if any future Swift change reintroduces a
    // race, the old model is already evicted before the request.
    if (
      stt?.unload &&
      previous &&
      previous !== targetMode
    ) {
      micLabel.textContent = `Unloading ${labelForMode(previous)}…`
      showOverlay(
        `Unloading ${labelForMode(previous)} model to free memory…`
      )
      try {
        await stt.unload()
      } catch (err) {
        // Non-fatal: the Swift side will drop the previous kit
        // anyway when prepare() runs. Log and continue.
        console.warn(
          "[pronunciation-coach] explicit unload before switch failed:",
          err
        )
      }
    }
    micLabel.textContent = `Loading ${targetLabel} model…`
    showOverlay(
      `Loading ${targetLabel} model…\nThis can take 10–30s on first launch.`
    )
    try {
      // Use the memory-aware retry wrapper so an INSUFFICIENT_MEMORY
      // from the native gate gets absorbed into a wait+retry loop
      // with cancel, instead of immediately surfacing as a scary
      // "restart Corpán" error. iOS empirically takes ~5-10 s to
      // reclaim freelist pages after a Large-model unload; waiting
      // for that is almost always faster (and lower-friction) than
      // forcing a process relaunch.
      const r = await prepareWithMemoryRetry(targetMode)
      modelReady = true
      // Prepare succeeded — NOW commit the choice to persistent state.
      modelMode = targetMode
      persist()
      renderModeButton()
      console.log(
        `[pronunciation-coach] Whisper prepared: ${r.model} (${targetLabel})`
      )
      hideOverlay()
      micBtn.disabled = false
      setUiState("idle")
    } catch (err) {
      const msg = formatErr(err)
      const code = errCode(err)
      const isCancel = err instanceof SwitchCancelledError
      console.error(
        `[pronunciation-coach] post-setup load ${isCancel ? "cancelled" : "failed"} (code=${code ?? "—"}):`,
        isCancel ? "user cancel" : msg
      )
      // Don't persist targetMode (we already gated persist behind
      // success). Plugin's validateModel will clear its own stale
      // marker on next call; no JS-side cache to invalidate.
      // Try to restore the previous model rather than leaving the
      // user with a broken "Model unavailable" state. Standard was
      // working fine before the user attempted to switch; we should
      // get them back to that working state automatically rather
      // than dumping them into setup with destructive buttons next
      // to a model they didn't ask to remove.
      if (previous && previous !== targetMode) {
        try {
          const r = await prepareWithRecovery(previous)
          modelReady = true
          modelMode = previous
          renderModeButton()
          hideOverlay()
          micBtn.disabled = false
          setUiState("idle")
          if (isCancel) {
            showError(
              `Switch to ${targetLabel} cancelled. Staying on ${labelForMode(previous)}.`
            )
          } else if (code === "MODEL_NOT_INSTALLED") {
            showError(
              `${targetLabel} isn't installed yet. Staying on ${labelForMode(previous)}.`
            )
          } else if (code === "NETWORK") {
            showError(
              `${targetLabel} needs internet to finish setting up. Reconnect and try again — staying on ${labelForMode(previous)} for now.`
            )
          } else if (code === "INSUFFICIENT_MEMORY") {
            // Retry loop exhausted — device really is out of headroom.
            showError(
              `Not enough memory to load ${targetLabel}. Close other apps and restart Corpán, then try the switch again. ` +
                `Reverted to ${labelForMode(previous)}.`
            )
          } else {
            showError(
              `Couldn't switch to ${targetLabel}: ${msg}. Staying on ${labelForMode(previous)}.`
            )
          }
          console.log(
            `[pronunciation-coach] reverted to ${r.model} (${labelForMode(previous)}) after switch failure`
          )
          return
        } catch (revertErr) {
          console.error(
            "[pronunciation-coach] revert to previous model also failed:",
            revertErr
          )
          // fall through to the unavailable state below
        }
      }
      hideOverlay()
      if (isCancel) {
        showError(`Switch to ${targetLabel} cancelled.`)
      } else if (code === "STT_UNAVAILABLE") {
        // Native speech-recognition lib didn't load on this device
        // (commonly x86_64 Chromebook via ARC where libhoudini can't
        // translate whisper.cpp's armv8.2-a SIMD intrinsics). No
        // model would ever load here — surface the device-class
        // limitation honestly and stop offering downloads.
        showError(
          `Parlometron needs on-device speech recognition that isn't available on this device. ` +
            `It works on iPhone, iPad, and most Android phones — Chromebooks running Android in ARC ` +
            `aren't supported yet.`
        )
      } else if (code === "MODEL_NOT_INSTALLED") {
        showError(
          `${targetLabel} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`
        )
      } else if (code === "NETWORK") {
        showError(
          `${targetLabel} needs internet to finish setting up. Reconnect and try again.`
        )
      } else if (code === "INSUFFICIENT_MEMORY") {
        showError(
          `Not enough memory to load ${targetLabel}. Close other apps and restart Corpán, then try again.`
        )
      } else {
        showError(`Could not load ${targetLabel} model: ${msg}`)
      }
      micLabel.textContent = "Model unavailable"
    }
  }

  modeBtn.addEventListener("click", () => {
    openModelSetup().catch((err) => {
      console.error("[pronunciation-coach] openModelSetup threw:", err)
    })
  })

  // ---- Swipe gestures (bound once to the swipe area, follows the live
  // cardEl reference so it survives card-replacement during slideTo). ----
  let pointerActive = false
  let pointerStartX = 0
  let pointerStartY = 0
  let pointerStartT = 0
  let pointerCurX = 0
  let pointerCurY = 0
  let pointerLockedHorizontal = false
  let pointerLockedVertical = false
  let capturedPointerId: number | null = null
  // Set true when a swipe is committed so the synthesized click that
  // follows pointerup doesn't accidentally trigger "tap to hear".
  let suppressClick = false

  const speakCurrentPhrase = () => {
    if (!currentPhrase) return
    try {
      const r = hostApi.speak(
        currentPhrase.targetLang,
        currentPhrase.target.text
      )
      if (r && typeof (r as Promise<void>).catch === "function") {
        ;(r as Promise<void>).catch((err) => {
          console.error("[pronunciation-coach] speak phrase failed:", err)
        })
      }
    } catch (err) {
      console.error("[pronunciation-coach] speak phrase threw:", err)
    }
  }

  const isInteractiveTarget = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof Element)) return false
    return !!el.closest("button, input, textarea, select, a, [data-no-swipe]")
  }

  const swipeTarget = swipeAreaEl
  swipeTarget.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (uiState === "scoring") return
      if (isInteractiveTarget(e.target)) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      pointerActive = true
      pointerStartX = e.clientX
      pointerStartY = e.clientY
      pointerCurX = e.clientX
      pointerCurY = e.clientY
      pointerStartT = performance.now()
      pointerLockedHorizontal = false
      pointerLockedVertical = false
      capturedPointerId = null
      cardEl.classList.add("dragging")
    },
    { passive: true }
  )

  swipeTarget.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      if (!pointerActive) return
      pointerCurX = e.clientX
      pointerCurY = e.clientY
      const dx = pointerCurX - pointerStartX
      const dy = pointerCurY - pointerStartY
      if (!pointerLockedHorizontal && !pointerLockedVertical) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          pointerLockedHorizontal = true
          try {
            swipeTarget.setPointerCapture(e.pointerId)
            capturedPointerId = e.pointerId
          } catch {
            // ignore
          }
        } else if (Math.abs(dy) > 12) {
          pointerLockedVertical = true
        }
      }
      if (pointerLockedHorizontal) {
        const damped = dx * 0.9
        cardEl.style.transition = "none"
        cardEl.style.transform = `translateX(${damped}px) rotate(${
          damped * 0.01
        }deg)`
        cardEl.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 400))
      }
    },
    { passive: true }
  )

  const finishPointer = () => {
    if (!pointerActive) return
    pointerActive = false
    cardEl.classList.remove("dragging")

    if (capturedPointerId !== null) {
      try {
        swipeTarget.releasePointerCapture(capturedPointerId)
      } catch {
        // ignore
      }
      capturedPointerId = null
    }

    if (!pointerLockedHorizontal) {
      cardEl.style.transition = "transform 200ms ease, opacity 200ms ease"
      cardEl.style.transform = ""
      cardEl.style.opacity = ""
      return
    }

    const dx = pointerCurX - pointerStartX
    const dt = Math.max(1, performance.now() - pointerStartT)
    const v = Math.abs(dx) / dt
    const passDistance = Math.abs(dx) >= SWIPE_THRESHOLD_PX
    const passVelocity = v >= SWIPE_VELOCITY_PX_PER_MS
    if (passDistance || passVelocity) {
      suppressClick = true
      // Failsafe: clear after a delay in case no synthetic click fires.
      window.setTimeout(() => {
        suppressClick = false
      }, 500)
      if (dx < 0) {
        goNext().catch((err) =>
          console.error("[pronunciation-coach] swipe-next failed:", err)
        )
      } else if (historyIdx > 0) {
        goPrev().catch((err) =>
          console.error("[pronunciation-coach] swipe-prev failed:", err)
        )
      } else {
        cardEl.style.transition = "transform 220ms ease, opacity 220ms ease"
        cardEl.style.transform = ""
        cardEl.style.opacity = ""
      }
    } else {
      cardEl.style.transition = "transform 220ms ease, opacity 220ms ease"
      cardEl.style.transform = ""
      cardEl.style.opacity = ""
    }
  }

  swipeTarget.addEventListener("pointerup", finishPointer, { passive: true })
  swipeTarget.addEventListener("pointercancel", finishPointer, {
    passive: true,
  })

  // ---- Tap the target phrase (or its romanization) to hear it via TTS.
  // Uses event delegation on the deck so it survives card replacement
  // during slide animations. Suppressed for the click that browsers
  // synthesize after a real swipe gesture. ---- */
  deckEl.addEventListener("click", (e) => {
    if (suppressClick) {
      suppressClick = false
      return
    }
    const t = e.target as HTMLElement | null
    if (!t) return
    if (t.closest("button, input, a")) return
    if (!t.closest(".pc-target, .pc-romanization")) return
    speakCurrentPhrase()
  })

  // ---- Keyboard nav (arrow keys / Esc) for desktop & external keyboards ----
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      goPrev().catch((err) =>
        console.error("[pronunciation-coach] arrow-left failed:", err)
      )
    } else if (e.key === "ArrowRight") {
      goNext().catch((err) =>
        console.error("[pronunciation-coach] arrow-right failed:", err)
      )
    } else if (e.key === "Escape") {
      dispatchExit()
    } else if (e.key === " " || e.code === "Space") {
      // Hold-to-speak parity for desktop: spacebar DOWN starts, UP stops.
      // Ignore keydown auto-repeat so we only start once while held.
      e.preventDefault()
      if (e.repeat) return
      if (uiState === "idle" && modelReady && currentPhrase) {
        startRecording().catch((err) =>
          console.error("[pronunciation-coach] space-start failed:", err)
        )
      }
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault()
      if (uiState === "recording") {
        stopRecording().catch((err) =>
          console.error("[pronunciation-coach] space-stop failed:", err)
        )
      }
    }
  }
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  // ---- Long-press on the language badge → Whisper tuner ----
  // The badge is a small uppercase base-language code rendered inside
  // the card by `langBadgeHtmlFor()`. Long-press (700 ms, no drag)
  // opens the per-language whisper-param tuner. Delegated on the pack
  // container so it survives card swaps; cleaned up when unmount wipes
  // container.innerHTML.
  const LONG_PRESS_MS = 700
  const LONG_PRESS_MOVE_PX = 8
  let lpTimer: number | null = null
  let lpStart: { x: number; y: number } | null = null
  let lpTargetLang: string | null = null
  const cancelLongPress = () => {
    if (lpTimer !== null) {
      window.clearTimeout(lpTimer)
      lpTimer = null
    }
    lpStart = null
    lpTargetLang = null
  }
  // Named handlers (not inline) so unmount can remove them. Clearing
  // `container.innerHTML` strips children but not listeners on the
  // container itself; without explicit removal, remounting Practice
  // would accumulate duplicate handlers and fire openTuner twice for
  // one long-press.
  const onLpPointerDown = (e: PointerEvent) => {
    const t = (e.target as HTMLElement | null)?.closest?.(
      "[data-pc-lang-badge]"
    ) as HTMLElement | null
    if (!t) return
    const lang = t.getAttribute("data-pc-lang") || ""
    if (!lang) return
    lpStart = { x: e.clientX, y: e.clientY }
    lpTargetLang = lang
    lpTimer = window.setTimeout(() => {
      lpTimer = null
      if (lpTargetLang && !disposed) {
        openTuner(lpTargetLang)
      }
      lpTargetLang = null
      lpStart = null
    }, LONG_PRESS_MS)
  }
  const onLpPointerMove = (e: PointerEvent) => {
    if (!lpStart) return
    const dx = e.clientX - lpStart.x
    const dy = e.clientY - lpStart.y
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) cancelLongPress()
  }
  container.addEventListener("pointerdown", onLpPointerDown)
  container.addEventListener("pointermove", onLpPointerMove)
  container.addEventListener("pointerup", cancelLongPress)
  container.addEventListener("pointercancel", cancelLongPress)

  // ---- Restore from localStorage if available ----
  const restoreFromStorage = (): boolean => {
    const saved = loadSavedState(storage)
    if (!saved) return false
    // NOTE: do NOT mutate `modelMode` here. `boot()` already loaded the
    // saved mode via `savedEarly` at the top of the boot pipeline and
    // may have replaced it with the user's just-completed setup choice
    // (e.g. "advanced" → "standard" after the user installs a different
    // model in the setup overlay). Re-reading saved.mode here races with
    // the in-flight `prepareWithRecovery(modelMode)` from boot's
    // `Promise.all`, and clobbers the live mode with a stale persisted
    // value — which then makes the boot catch handler wipe the WRONG
    // model and re-prepare the WRONG model.
    if (!saved.phrases || saved.phrases.length === 0) return false
    streak = Math.max(0, Math.floor(saved.streak))
    history.length = 0
    for (const sp of saved.phrases) {
      history.push(savedToPhrase(sp))
    }
    const idx = Math.max(0, Math.min(history.length - 1, saved.idx))
    historyIdx = idx
    currentPhrase = history[idx]
    if (currentPhrase) renderCurrentPhrase()
    updateStreak()
    return true
  }

  // ---- Boot ----
  const loadFirstPhrase = async () => {
    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) {
      currentPhrase = null
      renderEmptyCard(
        cardEl,
        tt("noLanguageSelected"),
        tt("chooseLanguageToStudy")
      )
      micBtn.disabled = true
      micLabel.textContent = "—"
      return
    }

    // If we restored a session from storage, just kick off a prefetch and
    // skip fetching a fresh first phrase.
    if (restoreFromStorage()) {
      console.log(
        `[pronunciation-coach] restored ${history.length} phrase(s) from storage; idx=${historyIdx}, streak=${streak}`
      )
      prefetchInBackground()
      return
    }

    try {
      const phrase = await fetchOneEntry()
      if (disposed) return
      if (!phrase) {
        showError(tt("noPhrasesAvailable"))
        return
      }
      history.push(phrase)
      historyIdx = 0
      currentPhrase = phrase
      renderCurrentPhrase()
      persist()
      prefetchInBackground()
    } catch (err) {
      console.error("[pronunciation-coach] loadFirstPhrase failed:", err)
      currentPhrase = null
      showError(
        tt("errLoadPhrase", { error: formatErr(err) })
      )
      micBtn.disabled = true
      micLabel.textContent = "—"
    }
  }

  // ---------------------------------------------------------------------
  // Setup / onboarding flow
  //
  // The recording UI never downloads a model. If the chosen model isn't
  // installed-and-verified on disk, we replace the recording shell with
  // a setup screen where the user explicitly picks Standard or Advanced
  // and watches it install. Only after verification do we restore the
  // recording shell and call prepare() (load-only).
  // ---------------------------------------------------------------------
  type SetupOutcome =
    | { kind: "selected"; mode: ModelMode } // user picked or installed a model
    | { kind: "cancelled" } // user closed setup with no change (an active model still exists)
    | { kind: "exit" } // user closed setup with no model installed (kicks back to host)

  /**
   * Setup / settings overlay. Doubles as:
   *   - first-time onboarding (no `currentActive`) — close exits the pack.
   *   - ongoing settings (with `currentActive`) — close dismisses back.
   * Each model card shows live state: Active, Installed, Not installed.
   * Buttons differ per state: Install / Use this / Reinstall / Remove.
   */
  const runSetup = (opts: {
    currentActive: ModelMode | null
    headline: string
    sub: string
  }): Promise<SetupOutcome> =>
    new Promise((resolve) => {
      let { currentActive } = opts
      const setupRoot = document.createElement("div")
      setupRoot.className = "pc-setup-root"
      setupRoot.innerHTML = `
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${escapeHtml(opts.headline)}</h1>
            <p class="pc-setup-sub">${escapeHtml(opts.sub)}</p>

            ${visibleModels().map((m) => {
              // visibleModels() filters out variants flagged
              // `requiresLargeMemory: true` on devices that don't
              // pass `hasLargeMemoryBudget()` — iPhone-class iOS,
              // sub-flagship Android, etc. Hard data: 626 / 632 /
              // 1600 MB Whisper variants OOM-kill the app during
              // transcribe on iPhone Pro Max (~5 GB per-app jetsam
              // ceiling) even though each model loads cleanly.
              // Hiding the card means the user can't pick a model
              // that will crash their device. iPad Pro and ≥8 GB
              // Android phones see the full lineup.
              //
              // Format size label: under 1000 MB → "~NNN MB"; 1000+ →
              // "~N.N GB" so the lineup reads cleanly across two
              // orders of magnitude.
              const sizeLabel =
                m.approxSizeMB >= 1000
                  ? `~${(m.approxSizeMB / 1000).toFixed(1)} GB`
                  : `~${m.approxSizeMB} MB`
              return `
            <div class="pc-setup-card" data-mode="${m.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${escapeHtml(m.label)} <span class="pc-setup-card-status" data-status="${m.id}"></span></div>
                  <div class="pc-setup-card-meta">${sizeLabel}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${m.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${escapeHtml(m.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${m.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${m.cons.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${escapeHtml(m.folder)}</div>
              <div class="pc-setup-progress" data-progress="${m.id}" hidden>
                <div class="pc-setup-progress-bar"><div class="pc-setup-progress-fill"></div></div>
                <div class="pc-setup-progress-label">Preparing…</div>
              </div>
            </div>`
            }).join("")}

            <div class="pc-setup-error" id="pc-setup-error" hidden></div>
            <div class="pc-setup-note">
              Models live on your device under the app's data folder. They never leave your device. You can switch or remove them anytime from this screen.
            </div>
          </div>
        </div>
      `
      container.appendChild(setupRoot)

      // Model downloads need internet. Mount an inline offline notice
      // between the headline and the model cards so the user understands
      // why install buttons may not respond. The notice swaps in/out live
      // as airplane mode toggles.
      const setupBody = setupRoot.querySelector<HTMLDivElement>(".pc-setup-body")
      const firstCard = setupRoot.querySelector<HTMLElement>(".pc-setup-card")
      let offlineNoticeEl: HTMLElement | null = null
      const renderOfflineNotice = () => {
        if (isOnline()) {
          if (offlineNoticeEl) {
            offlineNoticeEl.remove()
            offlineNoticeEl = null
          }
          return
        }
        if (offlineNoticeEl || !setupBody) return
        const notice = createOfflineNotice({
          title: "Model downloads need internet",
          subtitle:
            "Already-installed models still work. Reconnect to install or reinstall a model.",
        })
        offlineNoticeEl = notice.element
        offlineNoticeEl.style.marginBottom = "12px"
        if (firstCard && firstCard.parentNode === setupBody) {
          setupBody.insertBefore(offlineNoticeEl, firstCard)
        } else {
          setupBody.appendChild(offlineNoticeEl)
        }
      }
      renderOfflineNotice()
      // The network listener that re-renders both the offline notice and
      // the action buttons gets registered below, after `renderActions`
      // is defined.
      let offNetworkChange: () => void = () => { }

      const errorEl = setupRoot.querySelector<HTMLDivElement>("#pc-setup-error")!
      // Two-tier install state. Source-of-truth precedence:
      //   1. Active model in this session: true (kit is in memory —
      //      live truth, not a cache).
      //   2. Otherwise null = unknown → "Checking…" skeleton until
      //      refreshInstallState() resolves it via plugin validateModel.
      // We deliberately do NOT seed from a localStorage hint cache.
      // A wrong hint led to phantom "Use this" buttons that bypassed
      // the install path entirely.
      const installed: Record<string, boolean | null> = Object.fromEntries(
        visibleModels().map((m) => [m.id, m.id === currentActive ? true : null])
      )
      let installing: ModelMode | null = null

      const setProgressVisible = (mode: ModelMode, visible: boolean) => {
        const wrap = setupRoot.querySelector<HTMLDivElement>(
          `[data-progress="${mode}"]`
        )
        if (wrap) wrap.hidden = !visible
      }
      const setProgress = (
        mode: ModelMode,
        fraction: number,
        label: string
      ) => {
        const wrap = setupRoot.querySelector<HTMLDivElement>(
          `[data-progress="${mode}"]`
        )
        if (!wrap) return
        const fill = wrap.querySelector<HTMLDivElement>(".pc-setup-progress-fill")
        if (fill) {
          fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`
        }
        const labelEl = wrap.querySelector<HTMLDivElement>(
          ".pc-setup-progress-label"
        )
        if (labelEl) labelEl.textContent = label
      }

      const cleanup = () => {
        offNetworkChange()
        if (setupRoot.parentNode) setupRoot.parentNode.removeChild(setupRoot)
      }

      const renderActions = () => {
        for (const m of MODELS) {
          const mode = m.id
          const status = setupRoot.querySelector<HTMLSpanElement>(
            `[data-status="${mode}"]`
          )
          const actions = setupRoot.querySelector<HTMLDivElement>(
            `[data-actions="${mode}"]`
          )
          if (!status || !actions) continue
          const isActive = currentActive === mode
          const isInstalling = installing === mode
          // Active model is installed by definition (WhisperKit has it
          // loaded). Trust that over any disk-probe answer, including
          // a `null` initial state — the active card never renders as
          // "Checking…" or "Install".
          const isInstalled = isActive ? true : installed[mode]
          const isUnknown = isInstalled === null && !isActive && !isInstalling

          status.textContent = isInstalling
            ? "Installing…"
            : isActive
              ? "Active"
              : isUnknown
                ? "Checking…"
                : isInstalled
                  ? "Installed"
                  : "Not installed"
          status.dataset.state = isInstalling
            ? "installing"
            : isActive
              ? "active"
              : isUnknown
                ? "checking"
                : isInstalled
                  ? "installed"
                  : "absent"

          actions.innerHTML = ""
          if (isInstalling) continue
          // Don't render any action buttons until validateModel has
          // returned — that's the source of the "flash of Install"
          // bug. Skeleton state shows "Checking…" with no buttons.
          if (isUnknown) continue

          const mkBtn = (
            label: string,
            kind: "primary" | "ghost" | "danger",
            onClick: () => void,
            opts: { disabled?: boolean } = {}
          ) => {
            const b = document.createElement("button")
            b.type = "button"
            b.className = `pc-setup-btn pc-setup-btn-${kind}`
            b.textContent = label
            if (opts.disabled) b.disabled = true
            b.addEventListener("click", onClick)
            actions.appendChild(b)
          }

          // Install / Reinstall need internet. Disable them offline so
          // taps don't kick off doomed downloads — the offline notice
          // already explains why. Remove/Use-this work fine offline.
          const networkBlocked = !isOnline()

          if (!isInstalled) {
            mkBtn(
              "Install",
              "primary",
              () => {
                console.log(`[pronunciation-coach] CLICK Install mode=${mode}`)
                startInstall(mode)
              },
              { disabled: networkBlocked }
            )
          } else if (isActive) {
            // Active and installed — no buttons. The model is loaded;
            // there's nothing for the user to do here.
          } else {
            mkBtn("Use this", "primary", () => {
              console.log(`[pronunciation-coach] CLICK Use-this mode=${mode}`)
              useInstalled(mode)
            })
            mkBtn(
              "Reinstall",
              "ghost",
              () => {
                console.log(`[pronunciation-coach] CLICK Reinstall mode=${mode}`)
                startInstall(mode, true)
              },
              { disabled: networkBlocked }
            )
            mkBtn("Remove", "danger", () => {
              console.log(`[pronunciation-coach] CLICK Remove mode=${mode}`)
              removeModel(mode)
            })
          }
        }
      }

      // Hook up the network listener now that renderActions exists.
      // Airplane-mode toggles swap the offline notice in/out and re-disable
      // the Install/Reinstall buttons in real time.
      offNetworkChange = onNetworkChange(() => {
        renderOfflineNotice()
        renderActions()
      })

      const refreshInstallState = async () => {
        // We deliberately do NOT use listInstalled here. validateModel
        // is reliable on every shipped host bridge; listInstalled may
        // not be wired and an older host binary can fail-open with
        // synthetic "all invalid" responses that hide working
        // installs (the bug that surfaced in 0.1.0 dev where Standard
        // was loaded and active but the overlay showed an "Install"
        // button). Two validateModel calls is cheap; truth wins over
        // round-trip count.
        if (!stt?.validateModel) return
        for (const m of MODELS) {
          // The currently-active model is installed by definition:
          // the native context has it loaded. Skip validateModel for it; the
          // heuristic has been observed reporting "<model dir missing>"
          // for models that prepare() then loads successfully (the
          // fundamental bug that motivated this whole rebuild). We trust
          // the in-session ground truth ("currentActive") over a disk
          // probe that may use a different path resolution than
          // WhisperKit itself does.
          if (currentActive === m.id) {
            installed[m.id] = true
            continue
          }
          try {
            const v = await stt.validateModel({ model: m.folder })
            installed[m.id] = v.valid
          } catch (err) {
            console.error(
              `[pronunciation-coach] validate ${m.id} failed:`,
              err
            )
            installed[m.id] = false
          }
        }
        renderActions()
      }

      const useInstalled = (mode: ModelMode) => {
        cleanup()
        resolve({ kind: "selected", mode })
      }

      const removeModel = async (mode: ModelMode) => {
        if (installing || !stt?.wipeModel) return
        console.log(
          `[pronunciation-coach] removeModel: mode=${mode} folder=${folderForMode(mode)} currentActive=${currentActive ?? "null"} installed[${mode}]=${installed[mode]}`
        )
        const before = installed[mode]
        installing = mode
        renderActions()
        errorEl.hidden = true
        try {
          await stt.wipeModel({ model: folderForMode(mode) })
          installed[mode] = false
          if (currentActive === mode) currentActive = null
        } catch (err) {
          installed[mode] = before
          const msg = formatErr(err)
          errorEl.textContent = `Remove failed: ${msg}`
          errorEl.hidden = false
        } finally {
          installing = null
          renderActions()
        }
      }

      const startInstall = async (mode: ModelMode, isReinstall = false) => {
        if (installing || disposed || !stt?.installModel) return
        installing = mode
        errorEl.hidden = true
        errorEl.textContent = ""
        renderActions()
        setProgressVisible(mode, true)

        // Reinstall = explicit wipe + fresh download. Without the
        // wipe, the plugin's `installModel` short-circuits at its
        // validateModel check ("already installed (validateModel
        // ok)") because validateModel only inspects file presence +
        // size > 1 KB, not actual on-disk integrity — so a corrupt
        // `.mlmodelc/weights/weight.bin` that mmap-fails at runtime
        // would still pass validation and Reinstall would do
        // nothing. Wiping first guarantees fresh bytes from the
        // network, which is what the user clicked Reinstall for.
        // First-time installs (`isReinstall` false) skip the wipe
        // since there's nothing to wipe.
        if (isReinstall && stt?.wipeModel) {
          setProgress(mode, 0, "Wiping previous install…")
          try {
            await stt.wipeModel({ model: folderForMode(mode) })
          } catch (err) {
            console.warn(
              `[pronunciation-coach] pre-reinstall wipe failed (continuing):`,
              err
            )
          }
        }
        setProgress(mode, 0, "Starting…")

        try {
          const installResult = await stt.installModel(
            {
              model: folderForMode(mode),
              downloadUrl: modelById(mode)?.downloadUrl,
            },
            (event) => {
              if (event.model !== folderForMode(mode)) return
              if (event.phase === "downloading") {
                const pct = Math.round((event.fraction ?? 0) * 100)
                let label = `Downloading ${pct}%`
                // whisper.cpp era: single-file ggml-*.bin downloads
                // via URLSession, so `completed` / `total` are bytes.
                // Show MB; raw byte counts are unreadable (a Medium
                // download is ~1.5 billion bytes).
                if (event.completed != null && event.total && event.total > 0) {
                  const mb = (n: number) => (n / (1024 * 1024)).toFixed(0)
                  label += ` · ${mb(event.completed)} / ${mb(event.total)} MB`
                }
                setProgress(mode, event.fraction ?? 0, label)
              } else if (event.phase === "verifying") {
                setProgress(mode, 1, "Verifying download…")
              } else if (event.phase === "verified") {
                setProgress(mode, 1, "Verified ✓")
              } else if (event.phase === "failed") {
                setProgress(mode, 0, `Failed: ${event.error ?? "unknown"}`)
              }
            }
          )
          if (disposed) return
          installed[mode] = true
          installing = null
          const settleMs =
            installResult.alreadyInstalled ? 0 : postInstallSettleMs(mode)
          if (settleMs > 0) {
            setProgress(mode, 1, "Finalizing…")
            await delay(settleMs)
            if (disposed) return
          }
          setProgress(mode, 1, "Verified")
          await delay(300)
          if (disposed) return
          cleanup()
          resolve({ kind: "selected", mode })
        } catch (err) {
          installing = null
          setProgressVisible(mode, false)
          const msg = formatErr(err)
          const code = errCode(err)
          console.error(
            `[pronunciation-coach] install ${mode} failed (code=${code ?? "—"}):`,
            msg
          )
          // STT_UNAVAILABLE means there's no .so for this device's
          // ABI — no model would ever load. Give the user the
          // device-class explanation directly rather than the raw
          // "DOWNLOAD_FAILED: …" string they'd otherwise see.
          if (code === "STT_UNAVAILABLE") {
            errorEl.textContent =
              "Parlometron needs on-device speech recognition that isn't available on this device. " +
              "Try Parlometron on iPhone, iPad, or an Android phone."
          } else {
            errorEl.textContent = `Install failed: ${msg}`
          }
          errorEl.hidden = false
          // Critical: install can drop the previously loaded native
          // context while replacing files. If install fails here, the
          // previously-active model may be nil'd in memory even though
          // its files and marker are intact on disk. Re-prepare it so
          // the user can keep using it.
          if (currentActive && currentActive !== mode && stt?.prepare) {
            try {
              const r = await stt.prepare({
                model: folderForMode(currentActive),
              })
              if (r.ready) {
                console.log(
                  `[pronunciation-coach] restored ${currentActive} model after ${mode} install failed`
                )
              }
            } catch (restoreErr) {
              console.error(
                `[pronunciation-coach] kit restore after ${mode} install failure threw:`,
                restoreErr
              )
            }
          }
          renderActions()
        }
      }

      const closeBtnLocal = setupRoot.querySelector<HTMLButtonElement>(
        "#pc-setup-close"
      )
      closeBtnLocal?.addEventListener("click", () => {
        if (installing) return // can't close mid-install
        cleanup()
        if (currentActive && installed[currentActive]) {
          resolve({ kind: "cancelled" })
        } else {
          // No usable model installed. Setup must complete; back out to host.
          dispatchExit()
          resolve({ kind: "exit" })
        }
      })

      // Pre-select visually + populate state.
      if (currentActive) {
        const card = setupRoot.querySelector(`[data-mode="${currentActive}"]`)
        card?.classList.add("pc-setup-card-suggested")
      }
      renderActions()
      refreshInstallState().catch((err) => {
        console.error(
          "[pronunciation-coach] refreshInstallState threw:",
          err
        )
      })
    })

  const boot = async () => {
    showOverlay("Checking models…")
    let available: boolean
    try {
      available = await stt.isAvailable()
    } catch (err) {
      // The bridge call itself failed — this is qualitatively different
      // from "the plugin says no". Show the user the real error so the
      // failure mode isn't a flat "unavailable" screen with no clue.
      console.error("[pronunciation-coach] stt.isAvailable bridge call threw:", err)
      if (disposed) return
      hideOverlay()
      renderUnavailable(
        "Speech recognition bridge failed",
        `The native speech-recognition plugin returned an error: ${String(err)}`
      )
      return
    }
    if (disposed) return
    if (!available) {
      hideOverlay()
      renderUnavailable()
      return
    }

    // Read this device's per-app memory budget BEFORE anything else
    // touches modelMode or the setup overlay. The budget gates which
    // model variants are safe to offer — Large / Advanced get hidden
    // on iPhone-class budgets (~5 GB) where their first-transcribe
    // spike OOM-kills the app. `navigator.userAgent` reports "iPad"
    // on devices that can't actually run those models (Stage Manager
    // iPads, older iPads), so we use the actual jetsam budget from
    // `os_proc_available_memory()` exposed via `stt.getStatus()`.
    try {
      const status = await stt.getStatus()
      setDeviceMemoryBudget(
        status.availableMemoryMB ?? null,
        status.physicalMemoryMB ?? null,
      )
      console.log(
        `[pronunciation-coach] device memory budget: available=${status.availableMemoryMB ?? "?"}MB physical=${status.physicalMemoryMB ?? "?"}MB raw=${JSON.stringify(status)}`
      )
    } catch (err) {
      console.warn(
        "[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",
        err
      )
    }

    // Pick the saved mode if any. localStorage holds preference; disk
    // truth is decided by whether prepare() can load the model. We do
    // NOT pre-check via validateModel — it's a heuristic on a
    // directory layout we don't fully control, and we've seen it
    // report "missing" on models that prepare() then loads
    // successfully. The only definition of "installed" that matters
    // is "the native runtime can load it right now".
    const savedEarly = loadSavedState(storage)
    if (savedEarly?.mode && modelById(savedEarly.mode)) {
      modelMode = savedEarly.mode
    }
    // Boot-time demotion: if the user's saved mode is a
    // large-memory-only variant (Large / Large Turbo / etc.) and
    // we're running on a device that doesn't pass the memory gate,
    // replace it with the visible default (Small) before anything
    // else touches modelMode. Without this, the boot path would
    // prepare a memory-gated model on a too-small device and
    // OOM-kill the app on first transcribe — exactly the failure
    // mode the requiresLargeMemory gate is designed to prevent.
    // The card was
    // already hidden from the setup overlay, but a stale
    // localStorage entry from a previous install (or a user who
    // upgraded from a build that allowed iPhone to pick those
    // models) would otherwise sneak through. Only triggers on
    // actual mismatch — iPad users keep their saved mode.
    const savedModelEntry = modelById(modelMode)
    if (savedModelEntry && variantExceedsBudget(savedModelEntry)) {
      const safe = visibleDefaultModel().id
      console.warn(
        `[pronunciation-coach] saved model "${modelMode}" exceeds this device's memory budget; demoting to "${safe}"`
      )
      modelMode = safe
    }

    renderModeButton()
    // Larger models can spend real time on first native initialization.
    // Surface the wait honestly so users don't think the app froze.
    // Threshold (~300 MB) chosen so Standard / Small skip the warning
    // but Medium / Large / Advanced get it.
    const bootModelLabel = labelForMode(modelMode)
    const bootIsLargeModel = (modelById(modelMode)?.approxSizeMB ?? 0) >= 300
    showOverlay(
      bootIsLargeModel
        ? `Loading ${bootModelLabel} model… first load can take ~1 minute for large models. Subsequent launches are faster.`
        : `Loading ${bootModelLabel} model…`
    )
    micLabel.textContent = bootIsLargeModel
      ? `Loading ${bootModelLabel} model… (first time can take ~1 minute)`
      : `Loading ${bootModelLabel} model…`

    const bootTargetMode: ModelMode = modelMode

    // Try the saved model directly. prepare() is the source of truth:
    //   ready=true                          → loaded; we're done.
    //   code=MODEL_NOT_INSTALLED            → genuinely not on disk; open setup.
    //   code=NETWORK                        → tokenizer fetch failed; the
    //                                         model bytes are fine, surface
    //                                         a banner and let the user
    //                                         retry without losing files.
    //   code=LOAD_FAILED / other            → bytes failed to load; open
    //                                         setup so user can reinstall.
    let prepareErr: unknown = null
    let prepareCode: SttErrorCode | undefined
    try {
      await Promise.all([
        prepareWithRecovery(bootTargetMode).then((r) => {
          modelReady = true
          console.log(
            `[pronunciation-coach] Whisper prepared: ${r.model} (${labelForMode(bootTargetMode)})`
          )
        }),
        loadFirstPhrase(),
      ])
    } catch (err) {
      prepareErr = err
      prepareCode = errCode(err)
      console.error(
        `[pronunciation-coach] boot prepare failed (code=${prepareCode ?? "—"}):`,
        formatErr(err)
      )
      // Stale-plugin detection: the new plugin always emits a structured
      // `code` on prepare failures. If we got a failure with no code AND
      // the message looks like the heuristic-validateModel false-negative
      // pattern, the iOS app is running an old plugin binary that lies
      // about disk state and destroys installs on every Install click.
      // Surface a loud, actionable warning so it doesn't get lost in the
      // log noise — this is the difference between "rebuild needed" and
      // "real bug".
      const msg = formatErr(err)
      if (!prepareCode && /<model dir missing>|Run install first/i.test(msg)) {
        console.warn(
          "%c[pronunciation-coach] STALE PLUGIN DETECTED",
          "background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600",
          "\nThe host app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",
          "\nValidateModel false-negatives in that build trigger destructive wipes on every Install click.",
          "\nFix: rebuild and reinstall the host app (cargo tauri ios dev / android dev) to pick up the marker-file fix.",
        )
      }
    }

    if (disposed) return

    if (modelReady && !prepareErr) {
      hideOverlay()
      setUiState("idle")
      return
    }

    // Prepare failed. Route on structured code; never auto-wipe.
    hideOverlay()
    const targetLabel = labelForMode(bootTargetMode)
    if (prepareCode === "STT_UNAVAILABLE") {
      // Native lib unavailable for this device's ABI — there's
      // literally no path to working speech recognition here.
      // Stop trying to load anything; show a clear "not for this
      // device" state so the user understands and goes back rather
      // than tapping things that can't work.
      showError(
        `Parlometron needs on-device speech recognition that isn't available on this device. ` +
          `Try Parlometron on iPhone, iPad, or an Android phone.`
      )
      micBtn.disabled = true
      micLabel.textContent = "Not supported on this device"
      return
    }
    if (prepareCode === "NETWORK") {
      showError(
        `${targetLabel} needs internet to finish setting up. Reconnect and tap the model badge to retry — your downloaded files are intact.`
      )
      micBtn.disabled = true
      micLabel.textContent = "Reconnect to load"
      return
    }
    if (prepareCode && prepareCode !== "MODEL_NOT_INSTALLED" && prepareCode !== "LOAD_FAILED") {
      showError(`Model failed to load: ${formatErr(prepareErr)}`)
      micBtn.disabled = true
      micLabel.textContent = "Model unavailable"
      return
    }
    // MODEL_NOT_INSTALLED → open setup silently. LOAD_FAILED → also
    // route to setup with a banner so the user can pick Reinstall.
    if (prepareCode === "LOAD_FAILED") {
      showError(
        `${targetLabel} model failed to load. Use Reinstall in setup if it keeps happening.`
      )
    }
    // Open the setup overlay; on selection it triggers a fresh prepare.
    micBtn.disabled = true
    micLabel.textContent = `Loading ${targetLabel} model…`
    openModelSetup().catch((e) => {
      console.error(
        "[pronunciation-coach] openModelSetup after boot prepare failure threw:",
        e
      )
    })
  }

  boot().catch((err) => {
    console.error("[pronunciation-coach] boot threw:", err)
  })

  return {
    unmount: () => {
      disposed = true
      cancelActiveSession()
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      container.removeEventListener("pointerdown", onLpPointerDown)
      container.removeEventListener("pointermove", onLpPointerMove)
      container.removeEventListener("pointerup", cancelLongPress)
      container.removeEventListener("pointercancel", cancelLongPress)
      cancelLongPress()
      hideOverlay()
      teardownZoomBlock()
      container.innerHTML = ""
    },
  }
}

// Parlometron-era alias for the practice mount. Both names point at
// the same function — `mountGame` for legacy callers, `mountPractice`
// for the new mode router in `parlometron.ts`.
export { mountGame as mountPractice }
