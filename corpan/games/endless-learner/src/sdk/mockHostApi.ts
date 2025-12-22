import type { EntryOut, HostApi, StackConfig } from "./types"

const baseStack: StackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 1,
  textSize: "medium",
  showRomanization: true,
}

const seedEntries: EntryOut[] = [
  {
    entry_id: 1,
    level: "A1",
    domains: ["travel"],
    translations: [
      { language_code: "en", text: "hello" },
      { language_code: "es", text: "hola" },
      { language_code: "fr", text: "bonjour" },
    ],
  },
  {
    entry_id: 2,
    level: "A1",
    domains: ["travel"],
    translations: [
      { language_code: "en", text: "goodbye" },
      { language_code: "es", text: "adios" },
      { language_code: "fr", text: "au revoir" },
    ],
  },
  {
    entry_id: 3,
    level: "A1",
    domains: ["travel"],
    translations: [
      { language_code: "en", text: "thank you" },
      { language_code: "es", text: "gracias" },
      { language_code: "fr", text: "merci" },
    ],
  },
  {
    entry_id: 4,
    level: "A1",
    domains: ["food"],
    translations: [
      { language_code: "en", text: "coffee" },
      { language_code: "es", text: "cafe" },
      { language_code: "fr", text: "cafe" },
    ],
  },
]

export const createMockHostApi = (): HostApi => {
  let index = 0
  return {
    speak: (lang, text) => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = lang
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      } else {
        console.info("[mock speak]", lang, text)
      }
    },
    stopSpeech: () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    },
    getStackConfig: () => baseStack,
    getRandomEntry: async () => {
      const entry = seedEntries[index % seedEntries.length]
      index += 1
      return entry
    },
    getRandomEntries: async (count) => {
      const results: EntryOut[] = []
      for (let i = 0; i < count; i += 1) {
        const entry = seedEntries[index % seedEntries.length]
        index += 1
        results.push(entry)
      }
      return results
    },
    getEntryById: async (entryId) => {
      return seedEntries.find((entry) => entry.entry_id === entryId) ?? seedEntries[0]
    },
    isMock: true,
  }
}
