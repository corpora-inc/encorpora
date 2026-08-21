// A standalone-dev stand-in for the corpan host. Used only when the pack runs
// under `npm run dev` outside the app, so the shell has a StackConfig to read.

import type { HostApi, StackConfig } from "./types"

const DEFAULT_STACK: StackConfig = {
  languages: ["en"],
  domains: [],
  levels: [],
  rate: 1,
  textSize: "medium",
  showRomanization: false,
}

export const createMockHostApi = (overrides: Partial<HostApi> = {}): HostApi => ({
  getStackConfig: () => DEFAULT_STACK,
  speak: (_lang, text) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
  },
  isMock: true,
  ...overrides,
})
