import type { Billboard } from "../scene/Billboards"
import { resolveDisplayAdConfig, type DisplayAdConfig } from "../../../shared/ad/displayAds/config"
import { createGptProvider, type GptProvider } from "../../../shared/ad/displayAds/providers/gptProvider"

export type BillboardAdManager = {
  dispose: () => void
}

/**
 * Loads real GPT display ads into billboard HtmlMesh containers.
 * Each billboard gets its own GPT slot based on its ad size.
 */
export const createBillboardAdManager = (
  billboards: Billboard[],
  gptNetwork?: string | null,
): BillboardAdManager => {
  const config = resolveDisplayAdConfig(gptNetwork)

  // If no GPT network configured, show placeholder content
  if (!config.enabled || !config.networkCode) {
    showPlaceholders(billboards)
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
    // Clear the "LOADING AD..." text
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

/**
 * When no ad network is configured, show stylish placeholder content.
 */
const showPlaceholders = (billboards: Billboard[]) => {
  const slogans = [
    "YOUR AD HERE",
    "ADVERTISE IN 3D",
    "THE FUTURE IS NOW",
    "NEON DREAMS",
    "BUY SOMETHING",
    "CONSUME",
    "OBEY",
    "LIVE LAUGH ADVERTISE",
  ]

  for (let i = 0; i < billboards.length; i++) {
    const bb = billboards[i]
    const slogan = slogans[i % slogans.length]
    const { r, g, b } = bb.config.color

    bb.adDiv.textContent = ""
    bb.adDiv.style.background = `linear-gradient(135deg, rgba(${r * 30},${g * 30},${b * 30},1), #0a0a0a)`
    bb.adDiv.style.display = "flex"
    bb.adDiv.style.alignItems = "center"
    bb.adDiv.style.justifyContent = "center"
    bb.adDiv.style.padding = "8px"

    const text = document.createElement("div")
    text.textContent = slogan
    text.style.color = `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`
    text.style.fontFamily = "'Courier New', monospace"
    text.style.fontWeight = "bold"
    text.style.fontSize = bb.config.adHeight > 200 ? "24px" : "16px"
    text.style.textAlign = "center"
    text.style.textShadow = `0 0 10px rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`
    text.style.letterSpacing = "2px"
    bb.adDiv.appendChild(text)
  }
}
