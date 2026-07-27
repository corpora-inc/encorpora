export type AdConfig = {
  /** Google AdSense publisher ID, e.g. "ca-pub-1234567890" */
  adClient: string | null
  /** Google Ad Manager network code for display ads */
  gptNetwork: string | null
}

/**
 * Resolve ad config. In-app ads use native AdMob (via HostApi), not web ads.
 * URL params enable Google H5 for standalone web dev testing only.
 */
export const resolveAdConfig = (): AdConfig => {
  const config: AdConfig = {
    adClient: null,
    gptNetwork: null,
  }

  if (typeof window === "undefined") return config

  const params = new URLSearchParams(window.location.search)

  const adClient = params.get("adClient")
  if (adClient === "none") {
    config.adClient = null
  } else if (adClient) {
    config.adClient = adClient
  }

  const gptNetwork = params.get("gptNetwork")
  if (gptNetwork) config.gptNetwork = gptNetwork

  return config
}
