import type { HostApi, EntryOut } from "./types"

const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.8,
  textSize: "medium",
  showRomanization: true,
}

const mockPhrases: EntryOut[] = [
  { entry_id: 1, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "hello" },
    { language_code: "es", text: "hola" }
  ]},
  { entry_id: 2, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "goodbye" },
    { language_code: "es", text: "adiós" }
  ]},
  { entry_id: 3, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "thank you" },
    { language_code: "es", text: "gracias" }
  ]},
  { entry_id: 4, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "please" },
    { language_code: "es", text: "por favor" }
  ]},
  { entry_id: 5, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "water" },
    { language_code: "es", text: "agua" }
  ]},
  { entry_id: 6, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "friend" },
    { language_code: "es", text: "amigo" }
  ]},
  { entry_id: 7, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "cat" },
    { language_code: "es", text: "gato" }
  ]},
  { entry_id: 8, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "dog" },
    { language_code: "es", text: "perro" }
  ]}
]

const pickRandomPhrases = (count: number): EntryOut[] => {
  const result: EntryOut[] = []
  const pool = [...mockPhrases]

  for (let i = 0; i < count && pool.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length)
    result.push(pool[randomIndex])
    pool.splice(randomIndex, 1)
  }

  return result
}

const speakWithBrowserTts = (uiCode: string, text: string, rate: number) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    console.log(`[Mock TTS ${uiCode}]`, text)
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = uiCode
  if (typeof rate === "number") {
    utterance.rate = rate
  }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export const createMockHostApi = (
  overrides: Partial<HostApi> = {}
): HostApi => {
  const stackConfig = {
    ...defaultStackConfig,
  }

  return {
    isMock: true,
    speak: async (uiCode, text) => {
      speakWithBrowserTts(uiCode, text, stackConfig.rate)
    },
    getStackConfig: () => ({
      ...stackConfig,
      languages: [...stackConfig.languages],
    }),
    onStackConfigChange: (listener) => {
      listener({
        ...stackConfig,
        languages: [...stackConfig.languages],
      })
      return () => {}
    },
    getRandomEntry: async () => {
      const phrases = pickRandomPhrases(1)
      return phrases[0] || mockPhrases[0]
    },
    getRandomEntries: async (count = 1) => {
      return pickRandomPhrases(count)
    },
    getEntryById: async () => {
      return {
        entry_id: 0,
        level: "A1",
        domains: [],
        translations: [],
      }
    },
    ...overrides,
  }
}
