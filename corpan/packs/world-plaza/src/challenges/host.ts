/**
 * The runtime host a {@link ChallengeTool} composes to build + play a challenge:
 * corpus access (pick/search entries), TTS (speak a phrase), and STT (record +
 * score a read-aloud). It is a thin, *typed* adapter over the Corpán
 * `HostApi` — but deliberately self-contained (no cross-package import) so the
 * pack stays a standalone IIFE, and so the whole library runs in the browser
 * against {@link mockChallengeHost} with zero native dependencies.
 *
 * Note the naming: the frozen contract `ChallengeHost` is the tiny *callback*
 * surface a mounted challenge reports through (onComplete/onCancel/speak). This
 * `ChallengeRuntimeHost` is the *capability* surface a tool pulls content from.
 * They are orthogonal; a tool receives both.
 */

import type { LanguageCode } from "@world-plaza/contracts"

/** One corpus translation in some language. Mirrors host `TranslationOut`. */
export interface ChallengeTranslation {
  language_code: string
  text: string
  romanization: string
}

/** A corpus entry surfaced to a challenge. Mirrors host `EntryOut`. */
export interface ChallengeEntry {
  entry_id: number
  level: string
  domains: string[]
  translations: ChallengeTranslation[]
  source: string
}

/** Result of an STT scoring round. Normalized `score` 0..1 + the transcript. */
export interface ChallengeSttResult {
  /** Normalized pronunciation/accuracy score, 0..1. */
  score: number
  /** What Whisper heard. */
  transcript: string
  /** The text the learner was asked to say. */
  expected: string
}

/**
 * The capability host. Every method is async + best-effort: a tool must degrade
 * gracefully (the mock host always satisfies it, but a real device may have TTS
 * muted or STT unavailable). `sttAvailable` lets a tool feature-detect up front.
 */
export interface ChallengeRuntimeHost {
  /** Pull `n` random entries from the corpus (base + active phrase packs). */
  getRandomEntries: (n: number) => Promise<ChallengeEntry[]>
  /** Full-text search for entries (used to build distractors / themed sets). */
  searchEntries: (
    text: string,
    opts?: { languageCodes?: string[]; limit?: number },
  ) => Promise<ChallengeEntry[]>
  /** Resolve specific entries the Quest pre-selected. */
  getEntriesByIds: (ids: number[], source?: string) => Promise<ChallengeEntry[]>
  /** Speak `text` in `uiCode` via host TTS. Resolves when playback starts. */
  speak: (uiCode: string, text: string) => Promise<void>
  /** Whether on-device STT is usable right now (drives read-aloud availability). */
  sttAvailable: () => Promise<boolean>
  /**
   * Record from the mic and score against `expected` in `language`. The tool
   * calls `start()` to begin and the returned `stop()` to finish + score;
   * `cancel()` aborts. Implementations own session lifecycle internally.
   */
  recordAndScore: (opts: {
    language: string
    expected: string
  }) => Promise<{
    stop: () => Promise<ChallengeSttResult>
    cancel: () => Promise<void>
    /** Subscribe to mic level 0..1 for a VU meter. Returns an unsubscribe. */
    onLevel?: (cb: (rms: number) => void) => () => void
  }>
}

/* ------------------------------------------------------------------ *
 * Adapter over the real Corpán HostApi.
 * We declare only the slice we touch (kept in lockstep with the host's
 * `contentPacks/types.ts`), so the pack never imports across packages.
 * ------------------------------------------------------------------ */

interface CorpanEntryOut {
  entry_id: number
  level: string
  domains: string[]
  translations: ChallengeTranslation[]
  source: string
}

interface CorpanSttApi {
  isAvailable: () => Promise<boolean>
  getStatus?: () => Promise<{ available: boolean; prepared: boolean }>
  prepare?: (opts?: { model?: string }) => Promise<{ ready: boolean }>
  startSession: (opts: {
    sessionId: string
    language: string
    expectedText: string
  }) => Promise<{ started: boolean; sessionId: string }>
  stopSession: (opts: {
    sessionId: string
  }) => Promise<{ text: string; overallScore: number }>
  cancelSession: (opts: { sessionId: string }) => Promise<void>
  subscribeAudioLevel?: (
    cb: (e: { rms: number; t: number }) => void,
  ) => Promise<() => void>
}

/** The minimal Corpán host slice the challenge library consumes. */
export interface CorpanChallengeHostApi {
  speak: (uiCode: string, text: string) => Promise<void>
  getRandomEntries?: (count: number) => Promise<CorpanEntryOut[]>
  getRandomEntry: () => Promise<CorpanEntryOut>
  getEntryById: (entryId: number, source?: string) => Promise<CorpanEntryOut>
  searchEntriesByText?: (opts: {
    text: string
    languageCodes?: string[]
    limit?: number
    offset?: number
  }) => Promise<CorpanEntryOut[]>
  stt?: CorpanSttApi
  isMock?: boolean
}

let sttCounter = 0
const nextSttId = () => `wp-ch-stt-${Date.now()}-${++sttCounter}`

/**
 * Wrap a real (or partial) Corpán HostApi into a {@link ChallengeRuntimeHost}.
 * Tolerates missing optional methods (older hosts) by falling back to repeated
 * single-entry calls and a no-op STT.
 */
export function createChallengeHost(
  api: CorpanChallengeHostApi,
): ChallengeRuntimeHost {
  const getRandomEntries = async (n: number): Promise<ChallengeEntry[]> => {
    try {
      if (api.getRandomEntries) return await api.getRandomEntries(Math.max(1, n))
      const out: ChallengeEntry[] = []
      for (let i = 0; i < n; i++) out.push(await api.getRandomEntry())
      return out
    } catch (err) {
      console.error("[wp-challenge] getRandomEntries failed:", err)
      return []
    }
  }

  const searchEntries: ChallengeRuntimeHost["searchEntries"] = async (
    text,
    opts,
  ) => {
    try {
      if (!api.searchEntriesByText) return []
      return await api.searchEntriesByText({
        text,
        languageCodes: opts?.languageCodes,
        limit: opts?.limit ?? 12,
      })
    } catch (err) {
      console.error("[wp-challenge] searchEntries failed:", err)
      return []
    }
  }

  const getEntriesByIds: ChallengeRuntimeHost["getEntriesByIds"] = async (
    ids,
    source,
  ) => {
    const out: ChallengeEntry[] = []
    for (const id of ids) {
      try {
        out.push(await api.getEntryById(id, source))
      } catch (err) {
        console.error(`[wp-challenge] getEntryById(${id}) failed:`, err)
      }
    }
    return out
  }

  const speak: ChallengeRuntimeHost["speak"] = async (uiCode, text) => {
    try {
      await api.speak(uiCode, text)
    } catch (err) {
      console.error("[wp-challenge] speak failed:", err)
    }
  }

  const sttAvailable: ChallengeRuntimeHost["sttAvailable"] = async () => {
    try {
      if (!api.stt) return false
      if (api.stt.getStatus) {
        const s = await api.stt.getStatus()
        return Boolean(s.available)
      }
      return await api.stt.isAvailable()
    } catch (err) {
      console.error("[wp-challenge] sttAvailable failed:", err)
      return false
    }
  }

  const recordAndScore: ChallengeRuntimeHost["recordAndScore"] = async ({
    language,
    expected,
  }) => {
    const stt = api.stt
    if (!stt) {
      // No STT host — return a degraded recorder that never scores.
      return {
        stop: async () => ({ score: 0, transcript: "", expected }),
        cancel: async () => {},
      }
    }
    const sessionId = nextSttId()
    if (stt.prepare) {
      try {
        await stt.prepare()
      } catch (err) {
        console.error("[wp-challenge] stt.prepare failed:", err)
      }
    }
    await stt.startSession({ sessionId, language, expectedText: expected })

    let unsub: (() => void) | null = null
    return {
      onLevel: (cb) => {
        if (!stt.subscribeAudioLevel) return () => {}
        let live = true
        stt
          .subscribeAudioLevel((e) => {
            if (live) cb(Math.max(0, Math.min(1, e.rms)))
          })
          .then((u) => {
            if (live) unsub = u
            else u()
          })
          .catch((err) =>
            console.error("[wp-challenge] subscribeAudioLevel failed:", err),
          )
        return () => {
          live = false
          unsub?.()
          unsub = null
        }
      },
      stop: async () => {
        unsub?.()
        unsub = null
        const r = await stt.stopSession({ sessionId })
        return {
          score: Math.max(0, Math.min(1, r.overallScore)),
          transcript: r.text,
          expected,
        }
      },
      cancel: async () => {
        unsub?.()
        unsub = null
        try {
          await stt.cancelSession({ sessionId })
        } catch (err) {
          console.error("[wp-challenge] cancelSession failed:", err)
        }
      },
    }
  }

  return {
    getRandomEntries,
    searchEntries,
    getEntriesByIds,
    speak,
    sttAvailable,
    recordAndScore,
  }
}

/* ------------------------------------------------------------------ *
 * Mock host — full standalone library, zero native deps.
 * ------------------------------------------------------------------ */

/** A small, multilingual seed corpus so every tool has real content offline. */
const MOCK_CORPUS: Array<{
  level: string
  domains: string[]
  en: string
  es: string
  es_rom?: string
}> = [
  { level: "A1", domains: ["food"], en: "the bread", es: "el pan" },
  { level: "A1", domains: ["food"], en: "the coffee", es: "el café" },
  { level: "A1", domains: ["food"], en: "the water", es: "el agua" },
  { level: "A1", domains: ["food"], en: "the apple", es: "la manzana" },
  { level: "A1", domains: ["food"], en: "the cheese", es: "el queso" },
  { level: "A1", domains: ["market"], en: "the market", es: "el mercado" },
  { level: "A1", domains: ["market"], en: "the money", es: "el dinero" },
  { level: "A1", domains: ["market"], en: "the price", es: "el precio" },
  { level: "A1", domains: ["travel"], en: "the ferry", es: "el ferri" },
  { level: "A1", domains: ["travel"], en: "the road", es: "el camino" },
  { level: "A1", domains: ["travel"], en: "the map", es: "el mapa" },
  { level: "A1", domains: ["greetings"], en: "good morning", es: "buenos días" },
  { level: "A1", domains: ["greetings"], en: "good night", es: "buenas noches" },
  { level: "A1", domains: ["greetings"], en: "thank you", es: "gracias" },
  { level: "A1", domains: ["greetings"], en: "please", es: "por favor" },
  { level: "A2", domains: ["food"], en: "I would like a coffee", es: "quisiera un café" },
  { level: "A2", domains: ["market"], en: "how much does it cost", es: "cuánto cuesta" },
  { level: "A2", domains: ["travel"], en: "where is the station", es: "dónde está la estación" },
  { level: "A2", domains: ["food"], en: "the table is ready", es: "la mesa está lista" },
  { level: "A2", domains: ["greetings"], en: "see you tomorrow", es: "hasta mañana" },
  { level: "A1", domains: ["food"], en: "the milk", es: "la leche" },
  { level: "A1", domains: ["food"], en: "the egg", es: "el huevo" },
  { level: "A1", domains: ["market"], en: "the basket", es: "la cesta" },
  { level: "A1", domains: ["travel"], en: "the ticket", es: "el billete" },
]

function mockEntry(i: number): ChallengeEntry {
  const row = MOCK_CORPUS[i % MOCK_CORPUS.length]
  return {
    entry_id: 1000 + i,
    level: row.level,
    domains: row.domains,
    source: "base",
    translations: [
      { language_code: "en", text: row.en, romanization: "" },
      { language_code: "es", text: row.es, romanization: row.es_rom ?? "" },
    ],
  }
}

export interface MockChallengeHostOptions {
  /** Fixed pronunciation score the mock STT returns (default 0.86). */
  sttScore?: number
  /** ms the mock "recording" pretends to last when level pinged. */
  recordMs?: number
  /** Deterministic shuffle/pick seed. */
  seed?: number
}

/**
 * A {@link ChallengeRuntimeHost} that needs no native host: a built-in
 * EN↔ES corpus, a `speak` that logs, and an STT that fakes a high score after
 * a brief "recording". Everything in the library is fully playable against it.
 */
export function mockChallengeHost(
  opts: MockChallengeHostOptions = {},
): ChallengeRuntimeHost {
  const sttScore = opts.sttScore ?? 0.86
  let pick = opts.seed ?? 7

  const getRandomEntries = async (n: number): Promise<ChallengeEntry[]> => {
    // Deterministic but well-distributed: Fisher–Yates the full index list with
    // the running LCG, then take the first `n`. This GUARANTEES min(n, corpus)
    // distinct entries (the old modulo-collision loop could starve at ~3 because
    // the LCG's low bits cycle poorly mod the corpus size — that broke any tool
    // needing 4+ distinct pairs, e.g. dialogue-fill). For n > corpus we wrap to
    // a second shuffled pass with fresh ids so callers always get `n` back.
    const next = () => {
      pick = (pick * 1103515245 + 12345) & 0x7fffffff
      return pick / 0x80000000
    }
    const order = MOCK_CORPUS.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const out: ChallengeEntry[] = []
    for (let k = 0; k < n; k++) {
      const idx = order[k % order.length]
      // bump the id on wrap so distractor logic never sees duplicate ids
      out.push(mockEntry(idx + (k >= order.length ? order.length * Math.floor(k / order.length) : 0)))
    }
    return out
  }

  const searchEntries: ChallengeRuntimeHost["searchEntries"] = async (text) => {
    const q = text.toLowerCase()
    return MOCK_CORPUS.map((_, i) => mockEntry(i)).filter((e) =>
      e.translations.some((t) => t.text.toLowerCase().includes(q)),
    )
  }

  const getEntriesByIds: ChallengeRuntimeHost["getEntriesByIds"] = async (ids) =>
    ids.map((id) => mockEntry(((id - 1000) % MOCK_CORPUS.length + MOCK_CORPUS.length) % MOCK_CORPUS.length))

  const speak: ChallengeRuntimeHost["speak"] = async (uiCode, text) => {
    console.log(`[mock-tts ${uiCode}] ${text}`)
  }

  const recordAndScore: ChallengeRuntimeHost["recordAndScore"] = async ({
    expected,
  }) => {
    let levelTimer: ReturnType<typeof setInterval> | null = null
    return {
      onLevel: (cb) => {
        let t = 0
        levelTimer = setInterval(() => {
          t += 1
          cb(0.35 + 0.4 * Math.abs(Math.sin(t / 2)))
        }, 90)
        return () => {
          if (levelTimer) clearInterval(levelTimer)
          levelTimer = null
        }
      },
      stop: async () => {
        if (levelTimer) clearInterval(levelTimer)
        levelTimer = null
        return { score: sttScore, transcript: expected, expected }
      },
      cancel: async () => {
        if (levelTimer) clearInterval(levelTimer)
        levelTimer = null
      },
    }
  }

  return {
    getRandomEntries,
    searchEntries,
    getEntriesByIds,
    speak,
    sttAvailable: async () => true,
    recordAndScore,
  }
}

/** Pull the (target, native) text from an entry for a learner pair. */
export function entryText(
  entry: ChallengeEntry,
  language: string,
): { text: string; romanization: string } | null {
  const exact = entry.translations.find((t) => t.language_code === language)
  if (exact) return { text: exact.text, romanization: exact.romanization }
  const base = language.split("-")[0]
  const loose = entry.translations.find(
    (t) => t.language_code.split("-")[0] === base,
  )
  return loose ? { text: loose.text, romanization: loose.romanization } : null
}

/** Resolve the language pair into target + native text for one entry. */
export function entryPair(
  entry: ChallengeEntry,
  language: LanguageCode,
  nativeLanguage?: LanguageCode,
): { target: string; native: string; romanization: string } | null {
  const t = entryText(entry, language)
  if (!t || !t.text) return null
  // Single-language stack → native is the same as target (immersion).
  const nat = nativeLanguage ? entryText(entry, nativeLanguage) : null
  return {
    target: t.text,
    native: nat?.text ?? t.text,
    romanization: t.romanization,
  }
}
