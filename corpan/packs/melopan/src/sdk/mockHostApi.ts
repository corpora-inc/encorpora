import type { HostApi, EntryOut } from "./types"

const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["general"],
  levels: ["A1"],
  rate: 0.9,
  textSize: "medium",
  showRomanization: true,
}

const mockPhrases: EntryOut[] = [
  { entry_id: 1, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "mountain" }, { language_code: "es", text: "montaña" },
  ]},
  { entry_id: 2, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "river" }, { language_code: "es", text: "río" },
  ]},
  { entry_id: 3, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "fire" }, { language_code: "es", text: "fuego" },
  ]},
  { entry_id: 4, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "water" }, { language_code: "es", text: "agua" },
  ]},
  { entry_id: 5, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "earth" }, { language_code: "es", text: "tierra" },
  ]},
  { entry_id: 6, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "sky" }, { language_code: "es", text: "cielo" },
  ]},
  { entry_id: 7, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "bread" }, { language_code: "es", text: "pan" },
  ]},
  { entry_id: 8, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "love" }, { language_code: "es", text: "amor" },
  ]},
]

const speakWithBrowserTts = (uiCode: string, text: string, rate: number) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.log(`[Mock TTS ${uiCode}]`, text)
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = uiCode
  utterance.rate = rate
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export const createMockHostApi = (overrides: Partial<HostApi> = {}): HostApi => {
  const stackConfig = { ...defaultStackConfig }

  return {
    isMock: true,
    speak: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate)
    },
    getStackConfig: () => ({ ...stackConfig, languages: [...stackConfig.languages] }),
    onStackConfigChange: (listener) => {
      listener({ ...stackConfig, languages: [...stackConfig.languages] })
      return () => {}
    },
    getRandomEntry: async () => mockPhrases[Math.floor(Math.random() * mockPhrases.length)],
    getRandomEntries: async (count = 1) => {
      const out: EntryOut[] = []
      const pool = [...mockPhrases]
      for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        out.push(pool[idx])
        pool.splice(idx, 1)
      }
      return out
    },
    getEntryById: async () => mockPhrases[0],
    ...overrides,
  }
}
