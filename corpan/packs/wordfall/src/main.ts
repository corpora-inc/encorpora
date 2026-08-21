import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import { createMockHostApi } from "./sdk/mockHostApi"
import { Game } from "./Game"
import { mountJourney } from "./journey/mount"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __wordfall?: Game | null
  __corpanHostActive?: boolean
}

// Pack id MUST be the underscore form. The installer derives the pack id from
// the zip filename and normalizes hyphens to underscores (see install.ts), so
// the game registers under — and the manifest id must be — `wordfall`.
const GAME_ID = "wordfall"

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__wordfall) {
        scope.__wordfall.dispose()
        scope.__wordfall = null
      }

      // Journey activity launch (activity-contract §6.1). Belt: the spec in
      // initialState; suspenders: the typed-rail seam knows the active spec.
      const spec =
        initialState?.activity ??
        (hostApi.journey?.isActive() ? hostApi.journey.getSpec() : null)

      if (spec) {
        return mountJourney(container, hostApi, spec, (game) => {
          scope.__wordfall = game
        })
      }

      // Standalone launch — no spec, samples random entries, never reports.
      const instance = new Game(container, hostApi)
      scope.__wordfall = instance
      return {
        unmount: () => {
          instance.dispose()
          scope.__wordfall = null
        },
      }
    },
  }
}

/**
 * Standalone browser dev mount (index.html). Mounts a mock host so the pack is
 * playable at `npm run dev` without the app. No-op when the real host is active.
 */
const mountStandalone = () => {
  const scope = globalThis as GlobalScope
  if (scope.__corpanHostActive) return

  let root = document.getElementById("wordfall-root")
  if (!root) {
    root = document.createElement("div")
    root.id = "wordfall-root"
    root.style.position = "fixed"
    root.style.inset = "0"
    document.body.appendChild(root)
  }

  const hostApi: HostApi = createMockHostApi()
  if (scope.__wordfall) scope.__wordfall.dispose()
  scope.__wordfall = new Game(root, hostApi)
}

registerGame()
mountStandalone()
