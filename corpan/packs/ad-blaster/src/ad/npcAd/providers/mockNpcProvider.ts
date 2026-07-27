import type { NpcAdProvider, NpcAdRequest, NpcAdCreative } from "../types"
import { AD_SIZES } from "../types"
import { AD_COLORS } from "../../../core/constants"

const PARODY_BRANDS = [
  "SnakeSoft", "PryEyes Inc", "ClickFarm.biz", "PopUp Pals",
  "TrackU Pro", "Spam Depot", "DataVac 3000", "Malware Mart",
  "CookieBoss", "AdStorm HQ", "NudgeWare", "Dark Pattern Co",
]

const PARODY_SLOGANS = [
  "WE KNOW YOUR NAME", "INSTALL NOW (TRUST US)", "FREE*",
  "YOUR DATA, OUR YACHT", "UNSUBSCRIBE? NO.", "BUY BUY BUY",
  "TARGETED JUST 4 U", "ONE WEIRD TRICK", "DOCTORS HATE THIS",
  "ACT NOW OR ELSE", "YOU WON!! (NOT REALLY)", "SKIP AD IN 99s",
]

let nextMockId = 0

export const createMockNpcProvider = (): NpcAdProvider => {
  let colorIdx = 0

  const pickColor = () => {
    const c = AD_COLORS[colorIdx % AD_COLORS.length]
    colorIdx++
    return c
  }

  return {
    name: "mock-npc",

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
        const useBrand = Math.random() < 0.4
        const text = useBrand
          ? PARODY_BRANDS[Math.floor(Math.random() * PARODY_BRANDS.length)]
          : PARODY_SLOGANS[Math.floor(Math.random() * PARODY_SLOGANS.length)]

        creatives.push({
          id: `mock-npc-${nextMockId++}`,
          size,
          fallbackText: text,
          fallbackColor: pickColor(),
          provider: "mock-npc",
        })
      }

      return creatives
    },

    reportImpression(_creativeId: string) {
      // no-op in mock
    },

    reportClick(_creativeId: string) {
      // no-op in mock
    },
  }
}
