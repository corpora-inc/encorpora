import type { AdFormat, AdManagerApi, AdProvider, AdResult } from "./types"

const FAIL_RESULT: AdResult = { shown: false, rewarded: false, error: "no provider ready" }

export const createAdManager = (
  providers: AdProvider[],
  onBeforeShow?: () => void,
): AdManagerApi => {
  let initialized = false

  const init = async () => {
    if (initialized) return
    initialized = true
    for (const p of providers) {
      try {
        await p.init()
      } catch {
        // Provider failed to init, continue waterfall
      }
    }
  }

  const findReady = (format: AdFormat): AdProvider | null => {
    for (const p of providers) {
      if (p.isReady(format)) return p
    }
    return null
  }

  const show = async (format: AdFormat): Promise<AdResult> => {
    onBeforeShow?.()
    const provider = findReady(format)
    if (!provider) return FAIL_RESULT
    const ad = await provider.load(format)
    if (!ad) return FAIL_RESULT
    return ad.show()
  }

  return {
    init,
    showInterstitial: () => show("interstitial"),
    showRewarded: () => show("rewarded"),
    isReady: (format) => findReady(format) !== null,
  }
}
