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

// Single live instance. Dev (React StrictMode / re-injection) can call mount()
// more than once without unmounting between — which spawned TWO game instances
// (two Babylon engines, two input handlers, doubled LLM streams, ghost WASDQE).
// Disposing any prior instance before creating a new one guarantees exactly one.
let current: GameHandle | null = null

registry[GAME_ID] = {
  id: GAME_ID,
  mount(container, hostApi) {
    // Real Corpán HostApi (TTS + on-device Qwen3 LLM) when running as a pack;
    // undefined in standalone dev → the game falls back to a mock host.
    current?.dispose()
    current = null
    container.replaceChildren() // clear any leftover DOM from a prior instance
    const game: GameHandle = startGame(container, hostApi)
    current = game
    return {
      unmount: () => {
        game.dispose()
        if (current === game) current = null
      },
    }
  },
}

// Standalone dev mount (vite dev server / plain browser).
const devRoot = document.getElementById("corpan-game-root")
if (devRoot) {
  startGame(devRoot)
  // Dev-only: expose the live Babylon scene so a headless harness (Playwright)
  // can orbit the camera to verify prop depth. No effect when packaged.
  void import("@babylonjs/core/Engines/engineStore").then(({ EngineStore }) => {
    ;(window as unknown as { __wpScene?: () => unknown }).__wpScene = () =>
      EngineStore.LastCreatedScene
  })
}

export {}
