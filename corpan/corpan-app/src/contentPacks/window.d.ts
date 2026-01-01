import type { ContentPackModule } from "./types"

declare global {
  interface Window {
    CorpanGames?: Record<string, ContentPackModule>
  }
}

export {}
