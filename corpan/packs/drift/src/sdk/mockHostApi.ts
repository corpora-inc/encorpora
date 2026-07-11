import type { HostApi, EntryOut, StackConfig } from "./types"
import type { ActivitySpec } from "./activityContract"

const defaultStackConfig: StackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.85,
  textSize: "medium",
  showRomanization: true,
}

// A small bilingual pool so standalone dev can compose a story + glosses
// without a real host DB. Native (en) + target (es) is arbitrary — Drift is
// pair-agnostic; the mock just needs SOME native/target pair to render.
const mockPhrases: EntryOut[] = [
  { entry_id: 1, level: "A1", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "the morning" }, { language_code: "es", text: "la mañana" } ] },
  { entry_id: 2, level: "A1", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "a quiet street" }, { language_code: "es", text: "una calle tranquila" } ] },
  { entry_id: 3, level: "A1", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "the light" }, { language_code: "es", text: "la luz" } ] },
  { entry_id: 4, level: "A1", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "slowly" }, { language_code: "es", text: "despacio" } ] },
  { entry_id: 5, level: "A1", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "the sea" }, { language_code: "es", text: "el mar" } ] },
  { entry_id: 6, level: "A2", domains: ["travel"], source: "base", translations: [
    { language_code: "en", text: "I remember" }, { language_code: "es", text: "recuerdo" } ] },
]

const speakWithBrowserTts = (uiCode: string, text: string, rate: number) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.log(`[Drift mock TTS ${uiCode}]`, text)
    return
  }
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = uiCode
  if (typeof rate === "number") utter.rate = rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

const mockStash = () => {
  const w = window as unknown as { __corpanMockJourney?: { items: unknown[]; results: unknown[] } }
  const stash = w.__corpanMockJourney || { items: [], results: [] }
  w.__corpanMockJourney = stash
  return stash
}

export const createMockHostApi = (
  overrides: Partial<HostApi> & { activity?: ActivitySpec } = {}
): HostApi => {
  const { activity, ...rest } = overrides
  const stackConfig = { ...defaultStackConfig }
  const snapshot = () => ({ ...stackConfig, languages: [...stackConfig.languages] })

  return {
    isMock: true,
    journey: {
      isActive: () => !!activity,
      getSpec: () => activity || null,
      reportItem: (item) => { console.log("[Drift mock journey] reportItem", item); mockStash().items.push(item) },
      reportResult: (result) => { console.log("[Drift mock journey] reportResult", result); mockStash().results.push(result) },
      abandon: (reason = "user_exit") => {
        console.log("[Drift mock journey] abandon", reason)
        mockStash().results.push({ specId: activity?.specId ?? "", score: 0, perItem: [], durationMs: 0, abandoned: true })
      },
    },
    speak: async (uiCode, text) => speakWithBrowserTts(uiCode, text, stackConfig.rate),
    stopSpeech: () => { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel() },
    getStackConfig: () => snapshot(),
    onStackConfigChange: (listener) => { listener(snapshot()); return () => {} },
    getRandomEntry: async () => mockPhrases[Math.floor(Math.random() * mockPhrases.length)],
    getRandomEntries: async (count = 1) => {
      const pool = [...mockPhrases]
      const out: EntryOut[] = []
      for (let i = 0; i < count && pool.length; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
      return out
    },
    getEntryById: async (entryId) => mockPhrases.find((p) => p.entry_id === entryId) ?? mockPhrases[0],
    ...rest,
  }
}
