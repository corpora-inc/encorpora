import type { EntryOut, HostApi, StackConfig } from "./types"

/** A mock host for standalone dev (`npm run dev`). Mirrors the real host's
 *  shape so modules can be developed without the Corpán app. */
export const createMockHostApi = (): HostApi => {
  const stackConfig: StackConfig = {
    activeStackId: "mock",
    languages: ["en", "es"],
    domains: [],
    levels: ["A1", "A2", "B1"],
    rate: 1,
    textSize: "medium",
    showRomanization: true,
  }

  const sample: EntryOut[] = [
    {
      entry_id: 1,
      level: "A1",
      domains: ["travel"],
      source: "base",
      translations: [
        { language_code: "en", text: "let's go" },
        { language_code: "es", text: "vamos" },
      ],
    },
    {
      entry_id: 2,
      level: "A2",
      domains: ["food"],
      source: "base",
      translations: [
        { language_code: "en", text: "the night falls" },
        { language_code: "es", text: "cae la noche" },
      ],
    },
  ]

  return {
    speak: () => {},
    stopSpeech: () => {},
    getStackConfig: () => stackConfig,
    getRandomEntry: async () => sample[Math.floor(Math.random() * sample.length)],
    getRandomEntries: async (q) => {
      const count = typeof q === "number" ? q : q.count
      return Array.from({ length: count }, (_, i) => sample[i % sample.length])
    },
    searchEntriesByText: async ({ text }) =>
      sample.filter((e) => e.translations.some((t) => t.text.includes(text))),
    isMock: true,
  }
}
