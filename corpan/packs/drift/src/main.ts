import "./styles.css"
import type { GameModule, HostApi } from "./sdk/types"
import type { ActivitySpec } from "./sdk/activityContract"
import { createMockHostApi } from "./sdk/mockHostApi"
import { createDrift, type Drift } from "./game"
import { applyUiStrings } from "./i18n/strings"

type GlobalScope = typeof globalThis & {
  CorpanGames?: Record<string, GameModule>
  __drift?: Drift
  __corpanHostActive?: boolean
}

// Pack id MUST be the underscore form — the installer normalizes the zip
// filename's hyphens to underscores, so manifest.id + the CorpanGames key are
// `drift` (already underscore-free). Registers `CorpanGames.drift`.
const GAME_ID = "drift"

const resolveSpec = (
  hostApi: HostApi,
  initialState?: Record<string, unknown>,
): ActivitySpec | null => {
  // Belt: the spec threaded through initialState. Suspenders: the typed-rail
  // seam knows the active spec (activity-contract §6.1).
  const fromState = (initialState?.activity as ActivitySpec | undefined) ?? null
  if (fromState) return fromState
  if (hostApi.journey?.isActive()) return hostApi.journey.getSpec()
  return null
}

const registerGame = () => {
  const scope = globalThis as GlobalScope
  const registry = (scope.CorpanGames = scope.CorpanGames || {})

  registry[GAME_ID] = {
    mount: (container, hostApi, initialState) => {
      const scope = globalThis as GlobalScope
      if (scope.__drift) {
        scope.__drift.dispose()
        scope.__drift = undefined
      }

      const spec = resolveSpec(hostApi, initialState)
      const nativeLocale = hostApi.getStackConfig().languages?.[0]

      const seed = Date.now()
      const drift = createDrift(container, hostApi, spec, seed)
      // Localize the two chrome strings once the shell is in the DOM.
      applyUiStrings(container, nativeLocale)
      scope.__drift = drift

      return {
        unmount: () => {
          drift.dispose()
          scope.__drift = undefined
        },
      }
    },
  }
}

const mountForDev = () => {
  const scope = globalThis as GlobalScope
  if (scope.__corpanHostActive) return

  const root = document.getElementById("corpan-game-root")
  if (!root) return

  // Dev: optionally simulate a journey launch via ?journey=1
  const params = new URLSearchParams(location.search)
  const asJourney = params.get("journey") === "1"
  const activity: ActivitySpec | undefined = asJourney
    ? {
        specId: `dev-${Date.now()}`,
        activityType: "drift:read",
        itemRefs: [{ kind: "phrase", source: "base", id: "1" }],
        targetLang: "es",
        nativeLang: "en",
        timeboxSec: 30,
      }
    : undefined

  const hostApi: HostApi = createMockHostApi(activity ? { activity } : {})

  if (scope.__drift) {
    scope.__drift.dispose()
    scope.__drift = undefined
  }
  const module = scope.CorpanGames?.[GAME_ID]
  if (!module) return
  module.mount(root, hostApi, activity ? { activity } : undefined)

  window.addEventListener("corpan:exit", () => {
    if (scope.__drift) {
      scope.__drift.dispose()
      scope.__drift = undefined
    }
  })
}

registerGame()
mountForDev()
