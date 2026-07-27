import type { NpcAdProvider, NpcAdRequest, NpcAdCreative } from "../types"

/**
 * Anzu/Playgama In-Game Ad Provider (stub)
 *
 * To activate:
 * 1. Sign up at playgama.com
 * 2. Contact their support for "Intrinsic ads monetization (beta)"
 * 3. Integrate the Playgama SDK
 * 4. Replace this stub with real SDK calls
 *
 * When active, this provider fetches real ad image creatives
 * sized for 3D surface rendering per IAB Intrinsic In-Game (IIG) standards.
 * Returned NpcAdCreative objects will have imageUrl populated.
 */
export const createAnzuProvider = (): NpcAdProvider => {
  return {
    name: "anzu",

    async init(): Promise<boolean> {
      // Stub — returns false until real SDK is integrated
      return false
    },

    isAvailable(): boolean {
      return false
    },

    async fetch(_request: NpcAdRequest): Promise<NpcAdCreative[]> {
      // Stub — no creatives available
      return []
    },

    reportImpression(_creativeId: string) {
      // Stub
    },

    reportClick(_creativeId: string) {
      // Stub
    },
  }
}
