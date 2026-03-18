import type { Billboard } from "../scene/Billboards"
import { resolveDisplayAdConfig, type DisplayAdConfig } from "../../../shared/ad/displayAds/config"
import { createGptProvider, type GptProvider } from "../../../shared/ad/displayAds/providers/gptProvider"

export type BillboardAdManager = {
  dispose: () => void
}

/**
 * Loads real GPT display ads into billboard HtmlMesh containers.
 * Falls back to animated placeholders when no ad network is configured.
 */
export const createBillboardAdManager = (
  billboards: Billboard[],
  gptNetwork?: string | null,
): BillboardAdManager => {
  const config = resolveDisplayAdConfig(gptNetwork)

  // If no GPT network configured, show dark empty state
  if (!config.enabled || !config.networkCode) {
    console.warn("[Ad World] No ad network configured — billboards will be dark. Provide ?gptNetwork= for GPT ads.")
    showEmptyState(billboards)
    return { dispose: () => {} }
  }

  // Build display config with billboard-specific slots
  const billboardConfig: DisplayAdConfig = {
    ...config,
    slots: billboards.map((bb) => ({
      position: bb.id,
      width: bb.config.adWidth,
      height: bb.config.adHeight,
      adUnitPath: `/${config.networkCode}/ad-world-${bb.id}`,
    })),
  }

  // Build container map — each billboard's adDiv is its container
  const containers = new Map<string, HTMLElement>()
  for (const bb of billboards) {
    bb.adDiv.textContent = ""
    containers.set(bb.id, bb.adDiv)
  }

  // Initialize GPT
  const gpt: GptProvider = createGptProvider()
  gpt.init(billboardConfig, containers, "aw")

  const dispose = () => {
    gpt.dispose()
  }

  return { dispose }
}

// ── Empty state — dark billboard with subtle AD watermark ─────────

const showEmptyState = (billboards: Billboard[]) => {
  for (const bb of billboards) {
    const { r, g, b } = bb.config.color
    bb.adDiv.textContent = ""
    bb.adDiv.style.background = "#0a0a0a"
    bb.adDiv.style.display = "flex"
    bb.adDiv.style.alignItems = "center"
    bb.adDiv.style.justifyContent = "center"
    bb.adDiv.style.flexDirection = "column"

    const prompt = document.createElement("div")
    prompt.textContent = "WATCH AD"
    const glowColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.6)`
    const dimColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.25)`
    prompt.style.cssText = `
      font-family: 'Courier New', monospace; font-size: 16px;
      letter-spacing: 4px; color: ${dimColor};
      text-shadow: 0 0 8px ${glowColor};
      user-select: none; animation: aw-billboard-pulse 3s ease-in-out infinite;
    `
    bb.adDiv.appendChild(prompt)
  }
}
