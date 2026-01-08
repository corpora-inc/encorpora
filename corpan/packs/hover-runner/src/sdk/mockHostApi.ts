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

// Mock phrase pool for standalone gameplay
const mockPhrases: EntryOut[] = [
  // Greetings
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
    { language_code: "en", text: "good night" },
    { language_code: "es", text: "buenas noches" }
  ]},
  { entry_id: 5, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "thank you" },
    { language_code: "es", text: "gracias" }
  ]},
  { entry_id: 6, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "please" },
    { language_code: "es", text: "por favor" }
  ]},
  { entry_id: 7, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "excuse me" },
    { language_code: "es", text: "perdón" }
  ]},
  { entry_id: 8, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "yes" },
    { language_code: "es", text: "sí" }
  ]},
  { entry_id: 9, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "no" },
    { language_code: "es", text: "no" }
  ]},

  // Travel
  { entry_id: 10, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "where is the bathroom?" },
    { language_code: "es", text: "¿dónde está el baño?" }
  ]},
  { entry_id: 11, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "how much does it cost?" },
    { language_code: "es", text: "¿cuánto cuesta?" }
  ]},
  { entry_id: 12, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "I need a taxi" },
    { language_code: "es", text: "necesito un taxi" }
  ]},
  { entry_id: 13, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "where is the train station?" },
    { language_code: "es", text: "¿dónde está la estación de tren?" }
  ]},
  { entry_id: 14, level: "A1", domains: ["travel"], translations: [
    { language_code: "en", text: "I don't understand" },
    { language_code: "es", text: "no entiendo" }
  ]},
  { entry_id: 15, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "can you help me?" },
    { language_code: "es", text: "¿me puede ayudar?" }
  ]},

  // Food & Dining
  { entry_id: 16, level: "A1", domains: ["food"], translations: [
    { language_code: "en", text: "water" },
    { language_code: "es", text: "agua" }
  ]},
  { entry_id: 17, level: "A1", domains: ["food"], translations: [
    { language_code: "en", text: "coffee" },
    { language_code: "es", text: "café" }
  ]},
  { entry_id: 18, level: "A1", domains: ["food"], translations: [
    { language_code: "en", text: "bread" },
    { language_code: "es", text: "pan" }
  ]},
  { entry_id: 19, level: "A2", domains: ["food"], translations: [
    { language_code: "en", text: "the check, please" },
    { language_code: "es", text: "la cuenta, por favor" }
  ]},
  { entry_id: 20, level: "A2", domains: ["food"], translations: [
    { language_code: "en", text: "I'm hungry" },
    { language_code: "es", text: "tengo hambre" }
  ]},
  { entry_id: 21, level: "A2", domains: ["food"], translations: [
    { language_code: "en", text: "I'm thirsty" },
    { language_code: "es", text: "tengo sed" }
  ]},
  { entry_id: 22, level: "A1", domains: ["food"], translations: [
    { language_code: "en", text: "delicious" },
    { language_code: "es", text: "delicioso" }
  ]},

  // Common expressions
  { entry_id: 23, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "my name is..." },
    { language_code: "es", text: "me llamo..." }
  ]},
  { entry_id: 24, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "nice to meet you" },
    { language_code: "es", text: "mucho gusto" }
  ]},
  { entry_id: 25, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "I'm sorry" },
    { language_code: "es", text: "lo siento" }
  ]},
  { entry_id: 26, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "how are you?" },
    { language_code: "es", text: "¿cómo estás?" }
  ]},
  { entry_id: 27, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I'm fine" },
    { language_code: "es", text: "estoy bien" }
  ]},
  { entry_id: 28, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I don't speak Spanish" },
    { language_code: "es", text: "no hablo español" }
  ]},
  { entry_id: 29, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "do you speak English?" },
    { language_code: "es", text: "¿habla inglés?" }
  ]},

  // Numbers & Time
  { entry_id: 30, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "one" },
    { language_code: "es", text: "uno" }
  ]},
  { entry_id: 31, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "two" },
    { language_code: "es", text: "dos" }
  ]},
  { entry_id: 32, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "three" },
    { language_code: "es", text: "tres" }
  ]},
  { entry_id: 33, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "what time is it?" },
    { language_code: "es", text: "¿qué hora es?" }
  ]},
  { entry_id: 34, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "today" },
    { language_code: "es", text: "hoy" }
  ]},
  { entry_id: 35, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "tomorrow" },
    { language_code: "es", text: "mañana" }
  ]},
  { entry_id: 36, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "yesterday" },
    { language_code: "es", text: "ayer" }
  ]},

  // Common verbs & actions
  { entry_id: 37, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I want" },
    { language_code: "es", text: "quiero" }
  ]},
  { entry_id: 38, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I need" },
    { language_code: "es", text: "necesito" }
  ]},
  { entry_id: 39, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I have" },
    { language_code: "es", text: "tengo" }
  ]},
  { entry_id: 40, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "I am" },
    { language_code: "es", text: "soy" }
  ]},
  { entry_id: 41, level: "A2", domains: ["travel"], translations: [
    { language_code: "en", text: "I'm going to..." },
    { language_code: "es", text: "voy a..." }
  ]},
  { entry_id: 42, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "I would like" },
    { language_code: "es", text: "me gustaría" }
  ]},

  // Intermediate phrases
  { entry_id: 43, level: "B1", domains: ["travel"], translations: [
    { language_code: "en", text: "could you repeat that?" },
    { language_code: "es", text: "¿puede repetir eso?" }
  ]},
  { entry_id: 44, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "I don't know" },
    { language_code: "es", text: "no sé" }
  ]},
  { entry_id: 45, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "maybe" },
    { language_code: "es", text: "tal vez" }
  ]},
  { entry_id: 46, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "of course" },
    { language_code: "es", text: "por supuesto" }
  ]},
  { entry_id: 47, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "see you later" },
    { language_code: "es", text: "hasta luego" }
  ]},
  { entry_id: 48, level: "A2", domains: ["general"], translations: [
    { language_code: "en", text: "have a good day" },
    { language_code: "es", text: "que tengas un buen día" }
  ]},
  { entry_id: 49, level: "B1", domains: ["general"], translations: [
    { language_code: "en", text: "congratulations" },
    { language_code: "es", text: "felicidades" }
  ]},
  { entry_id: 50, level: "A1", domains: ["general"], translations: [
    { language_code: "en", text: "welcome" },
    { language_code: "es", text: "bienvenido" }
  ]},
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
    // eslint-disable-next-line no-console
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
      // Mock implementation - not used in hover-runner
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
