import type { NpcAdProvider, NpcAdRequest, NpcAdCreative } from "../types"
import { AD_SIZES } from "../types"
import type { AdContentManager } from "../../../systems/AdContentManager"

let nextCorpanId = 0

export const createCorpanTextProvider = (adContent: AdContentManager): NpcAdProvider => {
  return {
    name: "corpan-text",

    async init() {
      return true
    },

    isAvailable() {
      return true
    },

    async fetch(request: NpcAdRequest): Promise<NpcAdCreative[]> {
      const size = AD_SIZES[request.size]
      const creatives: NpcAdCreative[] = []

      for (let i = 0; i < request.count; i++) {
        const content = adContent.getNext()
        creatives.push({
          id: `corpan-${nextCorpanId++}`,
          size,
          fallbackText: content.text,
          fallbackColor: content.color,
          provider: "corpan-text",
          language: content.lang,
        })
      }

      return creatives
    },

    reportImpression(_creativeId: string) {
      // no-op — Corpan text doesn't need impression tracking
    },

    reportClick(_creativeId: string) {
      // no-op
    },
  }
}
