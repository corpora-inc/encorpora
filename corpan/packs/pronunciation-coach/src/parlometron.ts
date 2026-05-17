// Parlometron — top-level mode router.
//
// First screen: a two-button picker between Practice (solo) and
// Play with Friends (multiplayer). Routes to the appropriate
// sub-module and owns the back-to-picker transition.
//
// State machine:
//
//   picker ──Practice──► practice ──back──► picker
//   picker ──Friends──► lobby ──Start──► round
//                       ↑                 │
//                       └─Play again─┐    ▼
//                                    │  between-rounds ──Next──► round
//                                    │     │
//                                    │     └─Quit───────► picker
//                                    │
//                                    └ game-over ──Play again─► lobby
//                                                  ──Done──────► picker
//
// All transitions tear down the previous screen's DOM (its
// `unmount()`) before mounting the next. State (`GameState`) is
// kept in this module's closure; persisted to localStorage via
// the helpers in `multiplayer/state.ts` for crash-recovery.

import type { HostApi } from "./sdk/types"
import { mountPractice, type GameHandle } from "./game"
import { mountLobby } from "./multiplayer/lobby"
import { mountRound } from "./multiplayer/round"
import {
  mountBetweenRounds,
  mountGameOver,
} from "./multiplayer/results"
import {
  clear as clearGameState,
  isGameOver,
  type GameState,
  type Player,
  type RoundHistory,
  type WinTarget,
} from "./multiplayer/state"
import { defaultModel, modelById } from "./modelRegistry"

const PICKER_STORAGE_KEY = "pc:parlometron:last-mode"
// Solo's persisted state (`{ mode, history, … }`). We only need the
// mode so the multiplayer entry path can call `stt.prepare()` with
// the same model the user picked in Practice — without duplicating
// the full save/restore pipeline. Kept in sync with `game.ts` by
// convention; mismatches just mean we fall back to the default
// variant, which is still safer than not preparing at all.
const SOLO_STORAGE_KEY = "corpan-pronunciation-coach:v2"

type SttPrepareLike = {
  prepare?: (opts?: { model?: string }) => Promise<{
    ready: boolean
    model?: string
    code?: string
    message?: string
  }>
}

const readSavedModelFolder = (): string => {
  let folder: string | null = null
  try {
    const raw = localStorage.getItem(SOLO_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { mode?: string }
      const variant = modelById(parsed.mode)
      if (variant) folder = variant.folder
    }
  } catch (err) {
    console.warn("[parlometron] reading saved model failed:", err)
  }
  return folder ?? defaultModel().folder
}

/**
 * Kick off model load on Parlometron mount. Practice mode does the
 * full prepare flow in its `boot()` — and we used to require the
 * user to enter Practice once before Multiplayer worked, because
 * Multiplayer never called `prepare`. Now both modes share this
 * fire-and-forget prep: by the time the lobby's Start button is
 * tapped, whisper.cpp has the user's model loaded. If the model
 * isn't installed yet the prepare call resolves with `ready:false`
 * and the round-screen's stopSession will surface the failure —
 * we don't open Practice's full setup overlay from here (that's a
 * bigger refactor); the right action is "go to Practice and run
 * setup once."
 */
const ensureModelPrepared = (hostApi: HostApi): void => {
  const stt = (hostApi as unknown as { stt?: SttPrepareLike }).stt
  if (!stt?.prepare) return
  const folder = readSavedModelFolder()
  console.log("[parlometron] ensureModelPrepared — calling prepare:", folder)
  stt
    .prepare({ model: folder })
    .then((r) => {
      if (r.ready) {
        console.log(
          `[parlometron] model ready: ${r.model ?? folder}`,
        )
      } else {
        console.warn(
          `[parlometron] prepare reported not ready (code=${r.code ?? "—"}): ${r.message ?? ""}`,
        )
      }
    })
    .catch((err) => {
      console.warn("[parlometron] prepare threw:", err)
    })
}

export type ParlometronHandle = { unmount: () => void }

export const mountParlometron = (
  container: HTMLElement,
  hostApi: HostApi,
): ParlometronHandle => {
  let currentHandle: { unmount: () => void } | null = null
  let game: GameState | null = null
  let lastLobbySeed: { players: Player[]; winTarget: WinTarget } | null = null

  const tearDownCurrent = () => {
    if (currentHandle) {
      try {
        currentHandle.unmount()
      } catch (err) {
        console.error("[parlometron] unmount threw:", err)
      }
      currentHandle = null
    }
  }

  // ─── Mode picker ─────────────────────────────────────────────

  const showPicker = () => {
    tearDownCurrent()
    game = null
    container.innerHTML = `
      <div class="pc-pm-root pc-pm-picker">
        <button class="pc-pm-picker-close" data-pm-picker-close
                aria-label="Close Parlometron">×</button>
        <header class="pc-pm-picker-head">
          <h1 class="pc-pm-brand">Parlometron</h1>
          <p class="pc-pm-brand-sub">speak. measure. repeat.</p>
        </header>
        <main class="pc-pm-picker-body">
          <button class="pc-pm-mode-card" data-pm-mode="practice">
            <span class="pc-pm-mode-title">Practice</span>
            <span class="pc-pm-mode-sub">Solo. Repeat phrases in your target language and see what the model heard.</span>
          </button>
          <button class="pc-pm-mode-card" data-pm-mode="friends">
            <span class="pc-pm-mode-title">Play with Friends</span>
            <span class="pc-pm-mode-sub">2–8 players. Same phrase, 3 tries each, highest score wins the round.</span>
          </button>
        </main>
        <footer class="pc-pm-picker-foot">
          <p class="pc-pm-picker-tagline">Pass the device. Best round wins.</p>
        </footer>
      </div>`
    // Close X — same `corpan:exit` event the practice mode fires
    // from its own close button (game.ts `dispatchExit`). The host
    // app listens for this and tears the pack down.
    container
      .querySelector<HTMLButtonElement>("[data-pm-picker-close]")
      ?.addEventListener("click", () => {
        try {
          window.dispatchEvent(new CustomEvent("corpan:exit"))
        } catch (err) {
          console.error("[parlometron] dispatch exit failed:", err)
        }
      })
    container
      .querySelectorAll<HTMLButtonElement>("[data-pm-mode]")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const mode = btn.getAttribute("data-pm-mode")
          try {
            localStorage.setItem(PICKER_STORAGE_KEY, mode ?? "")
          } catch {
            /* localStorage may be wedged on iOS in private mode */
          }
          if (mode === "practice") {
            showPractice()
          } else if (mode === "friends") {
            // For v1, abandon any in-flight game when re-entering the
            // lobby. A "resume your game?" prompt would be a nice v1.1.
            clearGameState()
            showLobby(lastLobbySeed ?? undefined)
          }
        }),
      )
    currentHandle = {
      unmount: () => {
        container.innerHTML = ""
      },
    }
  }

  // ─── Practice (solo) ─────────────────────────────────────────

  const showPractice = () => {
    tearDownCurrent()
    // Practice owns its full container now — no more floating-back
    // overlay. Its built-in header `‹` button uses our `onClose`
    // callback to return here instead of firing `corpan:exit`.
    const practice: GameHandle = mountPractice(container, hostApi, {
      onClose: () => showPicker(),
    })
    currentHandle = practice
  }

  // ─── Lobby ───────────────────────────────────────────────────

  const showLobby = (initial?: {
    players: Player[]
    winTarget: WinTarget
  }) => {
    tearDownCurrent()
    const handle = mountLobby({
      container,
      onBack: () => showPicker(),
      onStart: (g) => {
        game = g
        lastLobbySeed = {
          players: g.players.map((p) => ({ ...p })),
          winTarget: g.winTarget,
        }
        showRound()
      },
      initial,
    })
    currentHandle = handle
  }

  // ─── Round ───────────────────────────────────────────────────

  const showRound = () => {
    if (!game) {
      showPicker()
      return
    }
    tearDownCurrent()
    const handle = mountRound({
      container,
      hostApi,
      game,
      onRoundDone: (round) => {
        if (!game) return
        if (isGameOver(game)) {
          showGameOver()
        } else {
          showBetween(round)
        }
      },
      onQuit: () => {
        clearGameState()
        game = null
        showPicker()
      },
    })
    currentHandle = handle
  }

  // ─── Between rounds ──────────────────────────────────────────

  const showBetween = (round: RoundHistory) => {
    if (!game) {
      showPicker()
      return
    }
    tearDownCurrent()
    const handle = mountBetweenRounds({
      container,
      game,
      round,
      onNextRound: () => showRound(),
      onQuit: () => {
        clearGameState()
        game = null
        showPicker()
      },
    })
    currentHandle = handle
  }

  // ─── Game over ───────────────────────────────────────────────

  const showGameOver = () => {
    if (!game) {
      showPicker()
      return
    }
    tearDownCurrent()
    const handle = mountGameOver({
      container,
      game,
      onPlayAgain: () => {
        // Carry over roster + target; fresh state otherwise.
        const seed = lastLobbySeed
        clearGameState()
        game = null
        showLobby(seed ?? undefined)
      },
      onDone: () => {
        clearGameState()
        game = null
        showPicker()
      },
    })
    currentHandle = handle
  }

  // Kick off model load in the background. Solo's `boot()` does
  // this internally; Multiplayer used to skip it entirely, which
  // made the first stopSession in Multi fail when the user went
  // directly there from the picker. By the time anyone hits Start
  // in the lobby, whisper.cpp has the user's chosen model loaded.
  ensureModelPrepared(hostApi)

  // Always start at the picker. Last-mode memory exists in
  // localStorage for analytics / future "auto-resume" UX, but for
  // v1 we always present the two choices first.
  showPicker()

  return {
    unmount: () => {
      tearDownCurrent()
      container.innerHTML = ""
      // Release the AVAudioSession / AVAudioEngine that practice
      // mode keeps warm across mic presses. Without this, the iOS
      // mic indicator stays orange after the user closes the pack
      // and other audio stays `.duckOthers`-ed until the next
      // process kill. See STTPlugin.swift `releaseAudio`.
      const stt = (hostApi as unknown as {
        stt?: { releaseAudio?: () => Promise<unknown> }
      }).stt
      stt?.releaseAudio?.().catch((err) => {
        console.error("[parlometron] releaseAudio failed:", err)
      })
    },
  }
}
