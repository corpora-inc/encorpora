import type { EntryOut, HostApi, StackConfig } from "./types"

/** Standalone dev override: `?lang=ar` (or `?stack=ar`) forces the native UI
 *  language so RTL / a specific locale can be exercised without the Corpán app.
 *  No-op outside the browser (tests). languages[0] = native, [1..] = targets. */
const devLanguages = (): string[] => {
  if (typeof window === "undefined") return ["en", "es"]
  const params = new URLSearchParams(window.location.search)
  const forced = params.get("lang") || params.get("stack")
  if (!forced) return ["en", "es"]
  const langs = forced.split(",").map((l) => l.trim()).filter(Boolean)
  // Keep a distinct target so two-language surfaces still have a pair.
  return langs.length >= 2 ? langs : [langs[0], langs[0] === "en" ? "es" : "en"]
}

/** A mock host for standalone dev (`npm run dev`). Mirrors the real host's
 *  shape so modules can be developed without the Corpán app. */
export const createMockHostApi = (): HostApi => {
  const stackConfig: StackConfig = {
    activeStackId: "mock",
    languages: devLanguages(),
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
