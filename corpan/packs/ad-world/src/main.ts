import type { GameModule, HostApi, StackConfig } from "../../shared/sdk/types"
import { createWorld } from "./world"
import "./styles.css"

const GAME_ID = "ad_world"

const w = window as unknown as Record<string, unknown>
const registry = (
  w.CorpanGames ?? (w.CorpanGames = {} as Record<string, GameModule>)
) as Record<string, GameModule>

registry[GAME_ID] = {
  mount: (container, hostApi, initialState) => {
    const world = createWorld(container, hostApi, initialState?.stackConfig)
    return {
      unmount: () => world.dispose(),
    }
  },
}

// Standalone dev mount
if (import.meta.env.DEV) {
  const root = document.getElementById("game-root")
  if (root) {
    const mockHostApi: HostApi = {
      speak: (lang, text) => console.log(`[TTS] ${lang}: ${text}`),
      getStackConfig: () => ({
        languages: ["en", "es", "ja", "ko", "zh-Hans"],
        domains: [],
        levels: [],
        rate: 1,
        textSize: "medium",
        showRomanization: true,
      }),
      isMock: true,
    }

    const mockConfig: StackConfig = mockHostApi.getStackConfig()
    registry[GAME_ID].mount(root, mockHostApi, { stackConfig: mockConfig })
  }
}
