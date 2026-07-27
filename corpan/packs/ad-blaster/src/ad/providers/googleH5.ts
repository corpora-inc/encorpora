import type { AdProvider, AdFormat, LoadedAd, AdResult } from "../types"

// Google H5 Ad Placement API types
type AdBreakType = "preroll" | "start" | "pause" | "next" | "browse" | "reward"

type AdBreakConfig = {
  type: AdBreakType
  name?: string
  beforeAd?: () => void
  afterAd?: () => void
  beforeReward?: (showAdFn: () => void) => void
  adDismissed?: () => void
  adViewed?: () => void
  adBreakDone?: (placementInfo: { breakStatus: string }) => void
}

type AdConfigConfig = {
  preloadAdBreaks?: "on" | "auto"
  sound?: "on" | "off"
  onReady?: () => void
}

type AdSdkGlobal = {
  adBreak: (config: AdBreakConfig) => void
  adConfig: (config: AdConfigConfig) => void
}

export type GoogleH5Config = {
  adClient: string // ca-pub-XXXXX
}

export const createGoogleH5Provider = (config: GoogleH5Config): AdProvider => {
  let sdk: AdSdkGlobal | null = null
  let ready = false

  const injectScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="adsbygoogle"]')) {
        resolve()
        return
      }
      const script = document.createElement("script")
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adClient}`
      script.async = true
      script.crossOrigin = "anonymous"
      script.setAttribute("data-ad-frequency-hint", "30s")
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load Google H5 ads script"))
      document.head.appendChild(script)
    })
  }

  return {
    name: "google-h5",

    async init(): Promise<boolean> {
      try {
        await injectScript()
        const w = window as unknown as {
          adBreak?: AdSdkGlobal["adBreak"]
          adConfig?: AdSdkGlobal["adConfig"]
        }
        if (!w.adBreak || !w.adConfig) {
          return false
        }
        sdk = { adBreak: w.adBreak, adConfig: w.adConfig }

        return new Promise<boolean>((resolve) => {
          sdk!.adConfig({
            preloadAdBreaks: "on",
            sound: "on",
            onReady: () => {
              ready = true
              resolve(true)
            },
          })
          // Timeout if onReady never fires
          setTimeout(() => {
            if (!ready) resolve(false)
          }, 5000)
        })
      } catch {
        return false
      }
    },

    isReady(_format: AdFormat): boolean {
      return ready && sdk !== null
    },

    async load(format: AdFormat): Promise<LoadedAd | null> {
      if (!sdk) return null

      return {
        format,
        show: () => {
          return new Promise<AdResult>((resolve) => {
            if (!sdk) {
              resolve({ shown: false, rewarded: false, error: "sdk not loaded" })
              return
            }

            if (format === "rewarded") {
              sdk.adBreak({
                type: "reward",
                name: "ad-blaster-continue",
                beforeReward: (showAdFn) => {
                  showAdFn()
                },
                adViewed: () => {
                  resolve({ shown: true, rewarded: true })
                },
                adDismissed: () => {
                  resolve({ shown: true, rewarded: false })
                },
                adBreakDone: (info) => {
                  if (info.breakStatus !== "viewed" && info.breakStatus !== "dismissed") {
                    resolve({ shown: false, rewarded: false, error: info.breakStatus })
                  }
                },
              })
            } else {
              // Interstitial
              sdk.adBreak({
                type: "next",
                name: "ad-blaster-death",
                adBreakDone: (info) => {
                  resolve({
                    shown: info.breakStatus === "viewed",
                    rewarded: false,
                    error: info.breakStatus !== "viewed" ? info.breakStatus : undefined,
                  })
                },
              })
            }
          })
        },
      }
    },
  }
}
