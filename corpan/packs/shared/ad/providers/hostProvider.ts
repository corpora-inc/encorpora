import type { HostApi } from "../../sdk/types"
import type { AdProvider, AdFormat, LoadedAd, AdResult } from "../types"

/**
 * AdProvider that delegates to native AdMob via HostApi.
 * Primary provider when running inside the Corpan app (Tauri WebView).
 */
export const createHostProvider = (hostApi: HostApi): AdProvider => {
  return {
    name: "host-admob",

    async init() {
      return true
    },

    isReady(format: AdFormat) {
      if (format === "rewarded") return !!hostApi.showRewarded
      if (format === "interstitial") return !!hostApi.showInterstitial
      return false
    },

    async load(format: AdFormat): Promise<LoadedAd | null> {
      if (format === "rewarded" && hostApi.showRewarded) {
        return {
          format,
          show: async (): Promise<AdResult> => {
            const result = await hostApi.showRewarded!()
            return {
              shown: result.shown,
              rewarded: result.rewarded,
              error: result.error,
            }
          },
        }
      }

      if (format === "interstitial" && hostApi.showInterstitial) {
        return {
          format,
          show: async (): Promise<AdResult> => {
            const result = await hostApi.showInterstitial!()
            return {
              shown: result.shown,
              rewarded: false,
              error: result.error,
            }
          },
        }
      }

      return null
    },
  }
}
