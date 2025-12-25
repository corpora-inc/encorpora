import type { HostApi } from "./types"

const defaultStackConfig = {
  activeStackId: "mock",
  languages: ["en", "es"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.8,
  textSize: "medium",
  showRomanization: true,
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
    getRandomEntry: async () => ({
      entry_id: 1,
      level: "A1",
      domains: ["travel"],
      translations: [
        { language_code: "es", text: "hola", romanization: "" },
        { language_code: "en", text: "hello", romanization: "" },
      ],
    }),
    getRandomEntries: async (count = 1) => {
      const entries = []
      for (let i = 0; i < count; i += 1) {
        entries.push({
          entry_id: 1 + i,
          level: "A1",
          domains: ["travel"],
          translations: [
            { language_code: "es", text: "hola", romanization: "" },
            { language_code: "en", text: "hello", romanization: "" },
          ],
        })
      }
      return entries
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
