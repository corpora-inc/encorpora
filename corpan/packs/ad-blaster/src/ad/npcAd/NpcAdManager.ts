import type { AdSizeCategory, NpcAdCreative, NpcAdProvider } from "./types"

export type NpcAdManager = {
  init(): Promise<void>
  getNext(sizeCategory: AdSizeCategory): NpcAdCreative | null
  reportImpression(creativeId: string): void
  reportClick(creativeId: string): void
  getStats(): { served: number; impressions: number; clicks: number }
}

const PREFETCH_THRESHOLD = 3
const PREFETCH_COUNT = 5

export const createNpcAdManager = (providers: NpcAdProvider[]): NpcAdManager => {
  const queues = new Map<AdSizeCategory, NpcAdCreative[]>()
  const fetching = new Set<AdSizeCategory>()
  let activeProviders: NpcAdProvider[] = []

  const stats = { served: 0, impressions: 0, clicks: 0 }

  // Provider-to-creative tracking for impression/click delegation
  const creativeProviderMap = new Map<string, NpcAdProvider>()

  const getQueue = (size: AdSizeCategory): NpcAdCreative[] => {
    let q = queues.get(size)
    if (!q) {
      q = []
      queues.set(size, q)
    }
    return q
  }

  const prefetch = (size: AdSizeCategory) => {
    if (fetching.has(size)) return
    if (activeProviders.length === 0) return

    fetching.add(size)

    // Waterfall: try each provider in order
    const tryProvider = (index: number) => {
      if (index >= activeProviders.length) {
        fetching.delete(size)
        return
      }

      const provider = activeProviders[index]
      provider
        .fetch({ size, count: PREFETCH_COUNT })
        .then((creatives) => {
          if (creatives.length > 0) {
            const queue = getQueue(size)
            for (const c of creatives) {
              queue.push(c)
              creativeProviderMap.set(c.id, provider)
            }
          } else {
            // This provider returned nothing, try next
            tryProvider(index + 1)
            return
          }
          fetching.delete(size)
        })
        .catch(() => {
          // Provider failed, try next
          tryProvider(index + 1)
        })
    }

    tryProvider(0)
  }

  const init = async () => {
    activeProviders = []
    for (const provider of providers) {
      try {
        const ok = await provider.init()
        if (ok) {
          activeProviders.push(provider)
        }
      } catch {
        // Provider failed to init, skip
      }
    }
  }

  const getNext = (sizeCategory: AdSizeCategory): NpcAdCreative | null => {
    const queue = getQueue(sizeCategory)

    if (queue.length < PREFETCH_THRESHOLD) {
      prefetch(sizeCategory)
    }

    if (queue.length > 0) {
      stats.served++
      return queue.shift()!
    }

    return null
  }

  const reportImpression = (creativeId: string) => {
    stats.impressions++
    const provider = creativeProviderMap.get(creativeId)
    provider?.reportImpression(creativeId)
  }

  const reportClick = (creativeId: string) => {
    stats.clicks++
    const provider = creativeProviderMap.get(creativeId)
    provider?.reportClick(creativeId)
  }

  const getStats = () => ({ ...stats })

  return { init, getNext, reportImpression, reportClick, getStats }
}
