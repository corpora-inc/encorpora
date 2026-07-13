/**
 * Corpan City — pack entry (IIFE). Registers the game module with the host and
 * supports a standalone dev mount (vite dev / browser) for fast iteration.
 *
 * The clean-room Babylon world, scene renderer, dual-stick controls and juice
 * layer live in `src/world/`, `src/scene/`, `src/movement/`, `src/juice/`.
 */
import "./styles.css"
import { startGame, type GameHandle } from "./game"
import {
  mountJourneyChallenge,
  synthesizeFallbackActivitySpec,
  type JourneyCapableHostApi,
} from "./journey/adapter"
import type { ActivitySpec } from "./sdk/activityContract"

const GAME_ID = "corpan_city"

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
    console.error("[corpan-city] disposing prior game instance threw:", err)
  }
  slot.game = null
}

registry[GAME_ID] = {
  id: GAME_ID,
  mount(container, hostApi, initialState) {
    // Real Corpán HostApi (TTS + on-device Qwen3 LLM) when running as a pack;
    // undefined in standalone dev → the game falls back to a mock host.
    disposePriorGame()
    container.replaceChildren() // clear any leftover DOM from a prior instance
    // Journey activity launch (activity-contract §6.3): run ONE challenge from
    // the library and report — the Babylon world NEVER boots on this path.
    const journeyApi = (hostApi as JourneyCapableHostApi | undefined)?.journey
    const declaredActivity = (
      initialState as { activity?: ActivitySpec } | undefined
    )?.activity
    // DEFENSE IN DEPTH (WS-D repro: journey entry showing the welcome +
    // language chooser and booting the on-device LLM instead of the
    // micro-challenge). `hostApi.journey.isActive()` is the HOST's own
    // authoritative marker for "this mount was launched by the Journey feed
    // with a spec" (JourneyHostApi doc, activity-contract.ts) — it flips true
    // synchronously in the host BEFORE this pack is ever mounted
    // (activitySchemas.ts beginActivitySession), independent of whatever
    // `initialState.activity` carries. So if it reads true we are ALWAYS a
    // Journey launch and must NEVER fall through to the full 3D world + LLM
    // boot below, even if `initialState.activity` was somehow lost upstream
    // of this pack (a bug elsewhere in the host chain). Recover the real spec
    // straight from the rail; `getSpec()` is guaranteed non-null whenever
    // `isActive()` is true, so the synthesized fallback below should be
    // unreachable in practice — it exists only for a malformed/legacy host.
    let activity = declaredActivity
    if (!activity && journeyApi?.isActive?.()) {
      activity = journeyApi.getSpec?.() ?? undefined
    }
    if (activity) {
      return mountJourneyChallenge(container, hostApi, activity)
    }
    if (journeyApi?.isActive?.()) {
      console.warn(
        "[corpan-city] journey session active with no recoverable ActivitySpec (initialState.activity and hostApi.journey.getSpec() both empty) — synthesizing a fallback micro-challenge instead of booting the full world/LLM",
      )
      return mountJourneyChallenge(
        container,
        hostApi,
        synthesizeFallbackActivitySpec(hostApi),
      )
    }
    const game: GameHandle = startGame(container, hostApi)
    slot.game = game
    return {
      unmount: () => {
        if (slot.game === game) slot.game = null
        try {
          game.dispose()
        } catch (err) {
          console.error("[corpan-city] unmount dispose threw:", err)
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
    console.info("[corpan-city:dev] mock stack →", languages)
    return { getStackConfig: () => ({ activeStackId: "dev", languages }) }
  } catch (err) {
    console.error("[corpan-city:dev] bad ?stack= param:", err)
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
