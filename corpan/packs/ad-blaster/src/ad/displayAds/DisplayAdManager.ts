import { resolveDisplayAdConfig } from "./config"
import { createGptProvider, type GptProvider } from "./providers/gptProvider"

export type DisplayAdManager = {
  dispose(): void
}

export const createDisplayAdManager = (
  gameRoot: HTMLElement,
  gptNetwork?: string | null,
  onBeforeRefresh?: () => void,
): DisplayAdManager => {
  const config = resolveDisplayAdConfig(gptNetwork)

  // Create ad container divs positioned around the game canvas
  const containers = new Map<string, HTMLElement>()

  // Top banner container
  const topContainer = document.createElement("div")
  topContainer.className = "ab-display-ad ab-display-ad--top"
  gameRoot.appendChild(topContainer)
  containers.set("top", topContainer)

  // Right mrec container
  const rightContainer = document.createElement("div")
  rightContainer.className = "ab-display-ad ab-display-ad--right"
  gameRoot.appendChild(rightContainer)
  containers.set("right", rightContainer)

  // Initialize GPT provider if configured
  let gpt: GptProvider | null = null
  if (config.enabled) {
    gpt = createGptProvider(onBeforeRefresh)
    gpt.init(config, containers)
  }

  const dispose = () => {
    gpt?.dispose()
    topContainer.remove()
    rightContainer.remove()
  }

  return { dispose }
}
