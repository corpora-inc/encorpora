export type DisplayAdSlot = {
  position: string
  width: number
  height: number
  adUnitPath?: string
}

export type DisplayAdConfig = {
  enabled: boolean
  networkCode?: string
  slots: DisplayAdSlot[]
  refreshIntervalMs: number
}

export const DEFAULT_DISPLAY_AD_CONFIG: DisplayAdConfig = {
  enabled: false,
  slots: [
    { position: "top", width: 728, height: 90 },
    { position: "right", width: 300, height: 250 },
  ],
  refreshIntervalMs: 45_000,
}

/**
 * Build config from resolved ad config + URL param overrides.
 * Auto-enables when a network code is present.
 * Override in dev with ?displayAds=0 to force-disable.
 */
export const resolveDisplayAdConfig = (gptNetwork?: string | null): DisplayAdConfig => {
  const config = { ...DEFAULT_DISPLAY_AD_CONFIG }

  // Apply programmatic config
  if (gptNetwork) {
    config.networkCode = gptNetwork
    config.enabled = true
  }

  if (typeof window === "undefined") return config

  // URL param overrides
  const params = new URLSearchParams(window.location.search)
  const displayParam = params.get("displayAds")
  if (displayParam === "1") config.enabled = true
  if (displayParam === "0") config.enabled = false

  const networkParam = params.get("gptNetwork")
  if (networkParam) {
    config.networkCode = networkParam
    config.enabled = true
  }

  return config
}
