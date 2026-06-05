/**
 * World Plaza — pack entry (IIFE). Registers the game module with the host and
 * supports a standalone dev mount (vite dev / browser) for fast iteration.
 *
 * The clean-room Babylon world, scene renderer, dual-stick controls and juice
 * layer live in `src/world/`, `src/scene/`, `src/movement/`, `src/juice/`.
 */
import "./styles.css"
import { startGame, type GameHandle } from "./game"

const GAME_ID = "world_plaza"

type MountResult = { unmount?: () => void } | void

interface GameModule {
  id?: string
  mount: (container: HTMLElement, hostApi: unknown, initialState?: Record<string, unknown>) => MountResult
}

const registry: Record<string, GameModule> =
  ((globalThis as unknown as { CorpanGames?: Record<string, GameModule> }).CorpanGames ??= {})

// EXACTLY ONE live instance, tracked on a GLOBAL slot — NOT a module-scope `let`.
// The host (ContentPackHost) injects a FRESH <script> on every pack (re)open, so
// this whole module re-evaluates in a NEW scope each time. A per-module `current`
// can therefore never see — let alone dispose — an instance created by a PREVIOUS
// injection: its Babylon engine + render loop + on-device LLM sockets are orphaned
// and keep running (zombie engines stacking each reopen → progressive FPS collapse
// + exhausted LLM sockets). A global slot is shared across every injected copy, so
// we always tear down the prior instance before (or instead of) making a new one.
const slot: { game: GameHandle | null } =
  ((globalThis as unknown as { __wpLiveGame?: { game: GameHandle | null } }).__wpLiveGame ??= {
    game: null,
  })

function disposePriorGame(): void {
  if (!slot.game) return
  try {
    slot.game.dispose()
  } catch (err) {
    console.error("[world-plaza] disposing prior game instance threw:", err)
  }
  slot.game = null
}

registry[GAME_ID] = {
  id: GAME_ID,
  mount(container, hostApi) {
    // Real Corpán HostApi (TTS + on-device Qwen3 LLM) when running as a pack;
    // undefined in standalone dev → the game falls back to a mock host.
    disposePriorGame()
    container.replaceChildren() // clear any leftover DOM from a prior instance
    const game: GameHandle = startGame(container, hostApi)
    slot.game = game
    return {
      unmount: () => {
        if (slot.game === game) slot.game = null
        try {
          game.dispose()
        } catch (err) {
          console.error("[world-plaza] unmount dispose threw:", err)
        }
      },
    }
  },
}

/**
 * Dev-only host stub so standalone (`:5174`) can exercise a NON-English NATIVE +
 * RTL. `?stack=ar` → native Arabic (RTL chrome); `?stack=es,ja` → native Spanish
 * studying Japanese (the multi-target chooser, both localized). Order matches the
 * Corpán stack: `languages[0]` = native, `[1..]` = targets. Absent → no host
 * (native falls back to "en"), exactly as before. Returns only `getStackConfig`;
 * the challenge/NPC paths still see no host and use their mocks.
 */
function devHostFromUrl(): unknown {
  try {
    const raw = new URLSearchParams(location.search).get("stack")
    if (!raw) return undefined
    const languages = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    if (languages.length === 0) return undefined
    console.info("[world-plaza:dev] mock stack →", languages)
    return { getStackConfig: () => ({ activeStackId: "dev", languages }) }
  } catch (err) {
    console.error("[world-plaza:dev] bad ?stack= param:", err)
    return undefined
  }
}

// Diagnostics — exposed ALWAYS (real app + standalone), not just the dev mount, so
// the engine-leak check works on-device. `__wpEngines()` must read 1; >1 means a
// prior instance leaked (an undisposed engine still running its render loop).
void import("@babylonjs/core/Engines/engineStore").then(({ EngineStore }) => {
  ;(window as unknown as { __wpScene?: () => unknown }).__wpScene = () =>
    EngineStore.LastCreatedScene
  ;(window as unknown as { __wpEngines?: () => number }).__wpEngines = () =>
    EngineStore.Instances.length
})

// Standalone dev mount (vite dev server / plain browser). Also routed through the
// global slot so a vite HMR re-eval of this module disposes the prior engine
// instead of stacking a second one (the same zombie-engine trap, dev edition).
const devRoot = document.getElementById("corpan-game-root")
if (devRoot) {
  disposePriorGame()
  devRoot.replaceChildren()
  slot.game = startGame(devRoot, devHostFromUrl())
}

export {}
