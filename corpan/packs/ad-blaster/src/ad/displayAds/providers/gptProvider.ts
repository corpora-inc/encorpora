import type { DisplayAdConfig, DisplayAdSlot } from "../config"

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>
      defineSlot(
        adUnitPath: string,
        size: [number, number],
        divId: string,
      ): { addService(service: unknown): unknown } | null
      pubads(): {
        enableSingleRequest(): void
        refresh(slots?: unknown[]): void
      }
      enableServices(): void
      display(divId: string): void
      destroySlots(): void
    }
  }
}

type GptSlotHandle = {
  divId: string
  slot: unknown
}

export type GptProvider = {
  init(config: DisplayAdConfig, containers: Map<string, HTMLElement>): void
  refresh(): void
  dispose(): void
}

const GPT_SCRIPT_URL = "https://securepubads.g.doubleclick.net/tag/js/gpt.js"

export const createGptProvider = (onBeforeRefresh?: () => void): GptProvider => {
  let scriptLoaded = false
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  const handles: GptSlotHandle[] = []

  const loadScript = (): Promise<void> => {
    if (scriptLoaded) return Promise.resolve()
    if (document.querySelector(`script[src="${GPT_SCRIPT_URL}"]`)) {
      scriptLoaded = true
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.async = true
      script.src = GPT_SCRIPT_URL
      script.onload = () => {
        scriptLoaded = true
        resolve()
      }
      script.onerror = () => reject(new Error("GPT script failed to load"))
      document.head.appendChild(script)
    })
  }

  const slotDivId = (slot: DisplayAdSlot) => `ab-gpt-${slot.position}`

  const init = (config: DisplayAdConfig, containers: Map<string, HTMLElement>) => {
    if (!config.enabled || !config.networkCode) return

    void loadScript().then(() => {
      const googletag = window.googletag
      if (!googletag) return

      googletag.cmd.push(() => {
        for (const slotConfig of config.slots) {
          const divId = slotDivId(slotConfig)
          const container = containers.get(slotConfig.position)
          if (!container) continue

          // Create ad div inside container
          const adDiv = document.createElement("div")
          adDiv.id = divId
          adDiv.style.width = `${slotConfig.width}px`
          adDiv.style.height = `${slotConfig.height}px`
          container.appendChild(adDiv)

          const adUnitPath = slotConfig.adUnitPath
            ?? `/${config.networkCode}/ad-blaster-${slotConfig.position}`

          const slot = googletag.defineSlot(
            adUnitPath,
            [slotConfig.width, slotConfig.height],
            divId,
          )

          if (slot) {
            slot.addService(googletag.pubads())
            handles.push({ divId, slot })
          }
        }

        googletag.pubads().enableSingleRequest()
        googletag.enableServices()

        for (const h of handles) {
          googletag.display(h.divId)
        }
      })

      // Periodic refresh
      if (config.refreshIntervalMs > 0) {
        refreshTimer = setInterval(() => {
          refresh()
        }, config.refreshIntervalMs)
      }
    })
  }

  const refresh = () => {
    const googletag = window.googletag
    if (!googletag || handles.length === 0) return
    onBeforeRefresh?.()
    googletag.cmd.push(() => {
      googletag.pubads().refresh()
    })
  }

  const dispose = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    const googletag = window.googletag
    if (googletag) {
      googletag.cmd.push(() => {
        googletag.destroySlots()
      })
    }
    handles.length = 0
  }

  return { init, refresh, dispose }
}
