import type { AdProvider, AdFormat, LoadedAd, AdResult } from "../types"

export const createMockProvider = (): AdProvider => {
  let ready = false

  return {
    name: "mock",

    async init() {
      ready = true
      return true
    },

    isReady(_format: AdFormat) {
      return ready
    },

    async load(format: AdFormat): Promise<LoadedAd> {
      return {
        format,
        show: async (): Promise<AdResult> => {
          // Simulate ad display with a brief delay
          await new Promise((r) => setTimeout(r, 1500))
          return {
            shown: true,
            rewarded: format === "rewarded",
          }
        },
      }
    },
  }
}
