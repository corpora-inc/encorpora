import type { HostApi, EntryOut } from "./types"

const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.85,
  textSize: "medium",
  showRomanization: true,
}

const mockPhrases: EntryOut[] = [
  { entry_id: 1, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "hello" },
    { language_code: "es", text: "hola" },
  ] },
  { entry_id: 2, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "goodbye" },
    { language_code: "es", text: "adiós" },
  ] },
  { entry_id: 3, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "thank you" },
    { language_code: "es", text: "gracias" },
  ] },
  { entry_id: 4, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "please" },
    { language_code: "es", text: "por favor" },
  ] },
  { entry_id: 5, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "water" },
    { language_code: "es", text: "agua" },
  ] },
  { entry_id: 6, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "friend" },
    { language_code: "es", text: "amigo" },
  ] },
  { entry_id: 7, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "cat" },
    { language_code: "es", text: "gato" },
  ] },
  { entry_id: 8, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "dog" },
    { language_code: "es", text: "perro" },
  ] },
  { entry_id: 9, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "morning" },
    { language_code: "es", text: "mañana" },
  ] },
  { entry_id: 10, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "station" },
    { language_code: "es", text: "estación" },
  ] },
  { entry_id: 11, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "ticket" },
    { language_code: "es", text: "billete" },
  ] },
  { entry_id: 12, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "money" },
    { language_code: "es", text: "dinero" },
  ] },
]

const pickRandomPhrases = (count: number): EntryOut[] => {
  const result: EntryOut[] = []
  const pool = [...mockPhrases]
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }
  return result
}

const speakWithBrowserTts = (uiCode: string, text: string, rate: number) => {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) {
    setTimeout(() => speakWithBrowserTts(uiCode, text, rate), 100)
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = uiCode
  const matching = voices.find(
    (v) => v.lang.startsWith(uiCode) || v.lang.includes(uiCode)
  )
  if (matching) utterance.voice = matching
  if (typeof rate === "number") utterance.rate = rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export const createMockHostApi = (
  overrides: Partial<HostApi> = {}
): HostApi => {
  const stackConfig = { ...defaultStackConfig }
  const byId = new Map(mockPhrases.map((p) => [p.entry_id, p]))

  return {
    isMock: true,
    speak: (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate)
    },
    stopSpeech: () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    },
    getStackConfig: () => ({
      ...stackConfig,
      languages: [...stackConfig.languages],
    }),
    onStackConfigChange: (listener) => {
      listener({ ...stackConfig, languages: [...stackConfig.languages] })
      return () => {}
    },
    getRandomEntry: async () => pickRandomPhrases(1)[0] || mockPhrases[0],
    getRandomEntries: async (count = 1) => pickRandomPhrases(count),
    getEntryById: async (id) =>
      byId.get(id) || {
        entry_id: id,
        level: "A1",
        domains: [],
        translations: [],
      },
    ...overrides,
  }
}
