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
    { language_code: "en", text: "good morning" },
    { language_code: "es", text: "buenos días" }
  ]},
  { entry_id: 4, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "thank you" },
    { language_code: "es", text: "gracias" }
  ]},
  { entry_id: 5, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "please" },
    { language_code: "es", text: "por favor" }
  ]},
  { entry_id: 6, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "excuse me" },
    { language_code: "es", text: "perdón" }
  ]},
  { entry_id: 7, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "yes" },
    { language_code: "es", text: "sí" }
  ]},
  { entry_id: 8, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "no" },
    { language_code: "es", text: "no" }
  ]},
  { entry_id: 9, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "where is the bathroom?" },
    { language_code: "es", text: "¿dónde está el baño?" }
  ]},
  { entry_id: 10, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "how much does it cost?" },
    { language_code: "es", text: "¿cuánto cuesta?" }
  ]},
  { entry_id: 11, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "I need a taxi" },
    { language_code: "es", text: "necesito un taxi" }
  ]},
  { entry_id: 12, level: "A2", domains: ["food"], translations: [
    { language_code: "en", text: "water" },
    { language_code: "es", text: "agua" }
  ]},
  { entry_id: 13, level: "A1", domains: ["food"], translations: [
    { language_code: "en", text: "coffee" },
    { language_code: "es", text: "café" }
  ]},
  { entry_id: 14, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "how are you?" },
    { language_code: "es", text: "¿cómo estás?" }
  ]},
  { entry_id: 15, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I'm fine" },
    { language_code: "es", text: "estoy bien" }
  ]},
  { entry_id: 16, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "welcome" },
    { language_code: "es", text: "bienvenido" }
  ]},
  { entry_id: 17, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "congratulations" },
    { language_code: "es", text: "felicidades" }
  ]},
  { entry_id: 18, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "see you later" },
    { language_code: "es", text: "hasta luego" }
  ]},
  { entry_id: 19, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "I'm sorry" },
    { language_code: "es", text: "lo siento" }
  ]},
  { entry_id: 20, level: "A2", domains: ["food"], translations: [
    { language_code: "en", text: "delicious" },
    { language_code: "es", text: "delicioso" }
  ]},
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

export const createMockHostApi = (
  overrides: Partial<HostApi> = {}
): HostApi => {
  const stackConfig = { ...defaultStackConfig }

  return {
    isMock: true,
    speak: (_lang, _text) => {},
    getStackConfig: () => ({
      ...stackConfig,
      languages: [...stackConfig.languages],
    }),
    onStackConfigChange: (listener) => {
      listener({ ...stackConfig, languages: [...stackConfig.languages] })
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
      return { entry_id: 0, level: "A1", domains: [], translations: [] }
    },
    ...overrides,
  }
}
