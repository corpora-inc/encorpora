// Parlometron multiplayer — lobby screen.
//
// Pre-game setup: roster the players (2–8, hard cap), pick the
// win target (first to 3 / 5 / 7 round wins), tap Start. On Start
// we construct a fresh `GameState` and hand it to the caller.
//
// Lobby state is local to this module — it's only committed to a
// real GameState when the user starts the game. "Back" returns to
// the mode picker without persisting anything.

import {
  newPlayer,
  newGame,
  type GameState,
  type Player,
  type WinTarget,
} from "./state"

const MIN_PLAYERS = 2
const MAX_PLAYERS = 8

export type LobbyOpts = {
  container: HTMLElement
  /** Tapping the back arrow returns to the Parlometron mode picker. */
  onBack: () => void
  /** Tapping Start hands a freshly-built GameState back to the caller. */
  onStart: (game: GameState) => void
  /** Optional carry-over when a finished game's "Play again" routes
   *  back here — same player roster, same win target preserved. */
  initial?: {
    players: Player[]
    winTarget: WinTarget
  }
}

export type LobbyHandle = {
  unmount: () => void
}

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

export const mountLobby = (opts: LobbyOpts): LobbyHandle => {
  // Working roster — mutated as the user edits names / adds rows.
  // Only committed to a real GameState on Start.
  const draftPlayers: Player[] =
    opts.initial?.players.map((p) => ({ ...p })) ??
    [newPlayer("Player 1"), newPlayer("Player 2")]
  let draftTarget: WinTarget = opts.initial?.winTarget ?? 5

  // Render once at mount; the inputs are wired to mutate
  // `draftPlayers` in place. Adding / removing a row re-renders
  // the roster section only (cheap, n ≤ 8 rows).
  const render = () => {
    const targetButtons = ([3, 5, 7] as const)
      .map(
        (n) => `
        <button type="button"
                class="pc-pm-target ${draftTarget === n ? "active" : ""}"
                data-pm-target="${n}">
          ${n}
        </button>`,
      )
      .join("")

    opts.container.innerHTML = `
      <div class="pc-pm-root pc-pm-lobby">
        <header class="pc-pm-head">
          <div class="pc-pm-head-eyebrow-row">
            <span class="pc-pm-eyebrow">Parlometron</span>
          </div>
          <div class="pc-pm-head-action-row">
            <button class="pc-pm-back" data-pm-back aria-label="Back to mode picker">‹</button>
            <span class="pc-pm-headline">New game</span>
            <div class="pc-pm-head-spacer"></div>
          </div>
        </header>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">Players (${draftPlayers.length} / ${MAX_PLAYERS})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${renderRoster()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${draftPlayers.length >= MAX_PLAYERS ? "disabled" : ""}>
            + Add Player
          </button>
        </section>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">First to win</h3>
          <div class="pc-pm-target-row">
            ${targetButtons}
            <span class="pc-pm-target-suffix">rounds</span>
          </div>
        </section>

        <footer class="pc-pm-foot">
          <button class="pc-pm-start" id="pc-pm-start" disabled>
            Start game
          </button>
        </footer>
      </div>
    `
    wire()
    refreshStartButton()
  }

  const renderRoster = (): string => {
    return draftPlayers
      .map(
        (p, i) => `
        <li class="pc-pm-roster-row" data-pm-row="${p.id}">
          <span class="pc-pm-roster-num">${i + 1}</span>
          <input type="text"
                 class="pc-pm-roster-name"
                 data-pm-name="${p.id}"
                 value="${escapeAttr(p.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${p.id}"
                  aria-label="Remove ${escapeAttr(p.name)}"
                  ${draftPlayers.length <= MIN_PLAYERS ? "disabled" : ""}>×</button>
        </li>`,
      )
      .join("")
  }

  const refreshStartButton = () => {
    const startBtn = opts.container.querySelector<HTMLButtonElement>(
      "#pc-pm-start",
    )
    if (!startBtn) return
    const allNamed = draftPlayers.every((p) => p.name.trim().length > 0)
    startBtn.disabled = !allNamed || draftPlayers.length < MIN_PLAYERS
  }

  const refreshAddButton = () => {
    const addBtn = opts.container.querySelector<HTMLButtonElement>(
      "[data-pm-add]",
    )
    if (!addBtn) return
    addBtn.disabled = draftPlayers.length >= MAX_PLAYERS
  }

  const rerenderRoster = () => {
    const rosterUl = opts.container.querySelector<HTMLUListElement>(
      "#pc-pm-roster",
    )
    if (rosterUl) rosterUl.innerHTML = renderRoster()
    // Header count needs refreshing too.
    const header = opts.container.querySelector<HTMLElement>(
      ".pc-pm-section-title",
    )
    if (header) {
      header.textContent = `Players (${draftPlayers.length} / ${MAX_PLAYERS})`
    }
    wireRosterRows()
    refreshAddButton()
    refreshStartButton()
  }

  const wireRosterRows = () => {
    opts.container
      .querySelectorAll<HTMLInputElement>("[data-pm-name]")
      .forEach((input) => {
        const id = input.getAttribute("data-pm-name") || ""
        input.addEventListener("input", () => {
          const p = draftPlayers.find((p) => p.id === id)
          if (p) p.name = input.value
          refreshStartButton()
        })
      })
    opts.container
      .querySelectorAll<HTMLButtonElement>("[data-pm-remove]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (draftPlayers.length <= MIN_PLAYERS) return
          const id = btn.getAttribute("data-pm-remove") || ""
          const idx = draftPlayers.findIndex((p) => p.id === id)
          if (idx >= 0) {
            draftPlayers.splice(idx, 1)
            rerenderRoster()
          }
        })
      })
  }

  const wire = () => {
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-back]")
      ?.addEventListener("click", () => opts.onBack())
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-add]")
      ?.addEventListener("click", () => {
        if (draftPlayers.length >= MAX_PLAYERS) return
        draftPlayers.push(newPlayer(`Player ${draftPlayers.length + 1}`))
        rerenderRoster()
      })
    opts.container
      .querySelectorAll<HTMLButtonElement>("[data-pm-target]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const v = Number(btn.getAttribute("data-pm-target")) as WinTarget
          if (v === 3 || v === 5 || v === 7) {
            draftTarget = v
            // Just toggle active class — no need to re-render.
            opts.container
              .querySelectorAll<HTMLElement>("[data-pm-target]")
              .forEach((b) => {
                b.classList.toggle(
                  "active",
                  Number(b.getAttribute("data-pm-target")) === v,
                )
              })
          }
        })
      })
    opts.container
      .querySelector<HTMLButtonElement>("#pc-pm-start")
      ?.addEventListener("click", () => {
        const cleaned = draftPlayers
          .map((p) => ({ ...p, name: p.name.trim() }))
          .filter((p) => p.name.length > 0)
        if (cleaned.length < MIN_PLAYERS) return
        const game = newGame(cleaned, draftTarget)
        opts.onStart(game)
      })
    wireRosterRows()
  }

  render()

  return {
    unmount: () => {
      opts.container.innerHTML = ""
    },
  }
}
