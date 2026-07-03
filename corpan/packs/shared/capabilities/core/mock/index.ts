// Mock capability host (capability-modules.md §7.1) — extends the proven
// `mockChallengeHost` pattern (corpan-city host.ts): deterministic, zero
// native deps, fully playable. DEV/TEST ONLY — separate entry so the mock
// never rides into a shipped consumer bundle.
import type {
  CapabilityHostApi,
  CapabilitySttApi,
  SttTranscriptionResult,
  SttWordTiming,
} from "../src/hostSlice"

export interface MockCapabilityHostOptions {
  stt?:
    | {
        overallScore?: number // default 0.86 (mockChallengeHost precedent)
        words?: SttWordTiming[] // default: derived from expectedText, prob 0.9
        freeText?: string
        installedModels?: string[] // default ["small"]; [] → needs-model paths
      }
    | false // false ⇒ hostApi.stt absent (degradation paths)
  languages?: string[] // default ["en", "es"]
  speakLog?: (uiCode: string, text: string) => void
  /** Injected clock for deterministic word timings. */
  now?: () => number
}

type MockSttState = {
  sessions: Array<{ sessionId: string; expectedText: string; language: string }>
  cancelled: string[]
  released: number
}

export type MockCapabilityHost = CapabilityHostApi & {
  /** Introspection for tests. */
  _stt: MockSttState
  _spoken: Array<{ lang: string; text: string }>
}

const wordsFromExpected = (expectedText: string): SttWordTiming[] => {
  const tokens = expectedText.trim().split(/\s+/).filter(Boolean)
  const per = 380
  return tokens.map((word, i) => ({
    word,
    startMs: i * per,
    endMs: i * per + per - 40,
    probability: 0.9,
  }))
}

/** Fabricate a full 18-field SttTranscriptionResult so cap-pronounce's pill
 *  UI renders every tier standalone. */
export const makeMockTranscription = (
  sessionId: string,
  expectedText: string,
  language: string,
  opts?: { overallScore?: number; words?: SttWordTiming[]; freeText?: string },
): SttTranscriptionResult => {
  const words = opts?.words ?? wordsFromExpected(expectedText)
  const overall = opts?.overallScore ?? 0.86
  const durationMs = words.length > 0 ? words[words.length - 1].endMs + 200 : 600
  return {
    sessionId,
    text: expectedText,
    expectedText,
    language,
    whisperLanguage: language.split("-")[0] || "en",
    durationMs,
    overallScore: overall,
    transcriptScore: overall,
    likelihoodScore: Math.min(1, overall + 0.05),
    acousticScore: Math.max(0, overall - 0.05),
    avgLogprob: -0.3,
    noSpeechProb: 0.02,
    compressionRatio: 1.4,
    temperature: 0,
    minTokenLogprob: -1.2,
    tokenLogprobStdev: 0.4,
    freeVsConstrainedSimilarity: Math.min(1, overall + 0.1),
    freeText: opts?.freeText ?? expectedText,
    words,
  }
}

export function createMockCapabilityHost(
  opts?: MockCapabilityHostOptions,
): MockCapabilityHost {
  const languages = opts?.languages ?? ["en", "es"]
  const spoken: Array<{ lang: string; text: string }> = []
  const sttState: MockSttState = { sessions: [], cancelled: [], released: 0 }

  let stt: CapabilitySttApi | undefined
  if (opts?.stt !== false) {
    const sttOpts = opts?.stt === undefined ? {} : opts.stt
    const installed = sttOpts.installedModels ?? ["small"]
    stt = {
      isAvailable: async () => true,
      getStatus: async () => ({
        available: true,
        prepared: installed.length > 0,
        model: installed[0] ?? null,
        recording: false,
        message: null,
        availableMemoryMB: 4096,
        physicalMemoryMB: 8192,
      }),
      prepare: async (o) => ({
        ready: installed.length > 0,
        model: o?.model ?? installed[0] ?? "small",
        ...(installed.length === 0
          ? { message: "no model installed", code: "MODEL_NOT_INSTALLED" as const }
          : {}),
      }),
      startSession: async (o) => {
        sttState.sessions.push({
          sessionId: o.sessionId,
          expectedText: o.expectedText,
          language: o.language,
        })
        return { started: true, sessionId: o.sessionId }
      },
      stopSession: async (o) => {
        const session = sttState.sessions.find((s) => s.sessionId === o.sessionId)
        return makeMockTranscription(
          o.sessionId,
          session?.expectedText ?? "",
          session?.language ?? "en",
          sttOpts,
        )
      },
      cancelSession: async (o) => {
        sttState.cancelled.push(o.sessionId)
      },
      listInstalled: async (o) => ({
        models: o.models
          .filter((m) => installed.includes(m))
          .map((m) => ({
            model: m,
            valid: true,
            problems: [],
            sizeBytes: 250 * 1024 * 1024,
            isLoaded: m === installed[0],
          })),
      }),
      releaseAudio: async () => {
        sttState.released += 1
      },
    }
  }

  const host: MockCapabilityHost = {
    speak: async (lang, text) => {
      spoken.push({ lang, text })
      opts?.speakLog?.(lang, text)
    },
    getStackConfig: () => ({
      languages,
      rate: 1,
      showRomanization: true,
      levels: ["A0", "A1"],
    }),
    stopSpeech: async () => {},
    ...(stt ? { stt } : {}),
    isMock: true,
    _stt: sttState,
    _spoken: spoken,
  }
  return host
}
