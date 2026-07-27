import type { HostApi, EntryOut } from "../sdk/types"
import { AD_COLORS } from "../core/constants"

export type AdContent = {
  text: string
  lang: string
  color: string
  entryId: number
}

export type AdContentManager = {
  getNext: () => AdContent
  prefetch: () => void
}

// Ironic ad slogans for fallback
const FAKE_SLOGANS = [
  "BUY NOW", "50% OFF", "FREE TRIAL", "CLICK HERE",
  "SUBSCRIBE", "DOWNLOAD", "LIMITED TIME", "ACT FAST",
  "DON'T MISS", "BEST DEAL", "SALE ENDS", "ORDER NOW",
  "AD FREE*", "UPGRADE", "PREMIUM", "UNLOCK ALL",
  "NO SPAM", "TRUST US", "AS SEEN ON", "TRENDING",
  "HURRY UP", "LAST CHANCE", "VIP ACCESS", "EXCLUSIVE",
]

// Fake brands for extra flavor
const FAKE_BRANDS = [
  "AdCorp", "BuyStuff Inc", "ShopMore", "ClickBait Co",
  "DataMine LLC", "TrackYou", "SpamBot 3000", "Pop-Up Pro",
  "Malware Max", "Cookie Monster", "Privacy? LOL", "Ad Nauseam",
]

export const createAdContentManager = (hostApi: HostApi): AdContentManager => {
  const queue: AdContent[] = []
  let fetching = false
  let colorIdx = 0

  const pickColor = (): string => {
    const c = AD_COLORS[colorIdx % AD_COLORS.length]
    colorIdx++
    return c
  }

  const entryToContent = (entry: EntryOut): AdContent => {
    const config = hostApi.getStackConfig()
    const targetLangs = config.languages.filter((l) => l !== "en")
    const lang = targetLangs.length > 0 ? targetLangs[0] : "en"
    const translation = entry.translations.find((t) => t.language_code === lang)
      || entry.translations.find((t) => t.language_code === "en")
      || entry.translations[0]
    return {
      text: translation?.text ?? "AD",
      lang: translation?.language_code ?? "en",
      color: pickColor(),
      entryId: entry.entry_id,
    }
  }

  const prefetch = () => {
    if (fetching || queue.length > 10) return
    fetching = true
    const getEntries = hostApi.getRandomEntries
    if (getEntries) {
      getEntries(8).then((entries) => {
        for (const e of entries) {
          queue.push(entryToContent(e))
        }
        fetching = false
      }).catch(() => {
        fetching = false
      })
    } else {
      fetching = false
    }
  }

  const getNext = (): AdContent => {
    if (queue.length > 0) {
      if (queue.length < 4) prefetch()
      return queue.shift()!
    }
    prefetch()

    // Mix slogans and brands for variety
    const useBrand = Math.random() < 0.3
    const text = useBrand
      ? FAKE_BRANDS[Math.floor(Math.random() * FAKE_BRANDS.length)]
      : FAKE_SLOGANS[Math.floor(Math.random() * FAKE_SLOGANS.length)]

    return {
      text,
      lang: "en",
      color: pickColor(),
      entryId: -1,
    }
  }

  // Initial prefetch
  prefetch()

  return { getNext, prefetch }
}
