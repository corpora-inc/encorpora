// Parlometron multiplayer — results screens.
//
// Two shapes share most of the rendering:
// - **Between rounds**: scoreboard for the round that just ended,
//   cumulative round-win totals, "Next round" / "Quit" buttons.
// - **End of game**: winner crowned, final scoreboard, "Play again"
//   (returns to lobby with same roster + target) / "Done".

import {
  gameWinners,
  type GameState,
  type Player,
  type RoundHistory,
} from "./state"
import { pmConfirm } from "./confirm"

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const playerById = (game: GameState, id: string): Player | undefined =>
  game.players.find((p) => p.id === id)

export type BetweenRoundsOpts = {
  container: HTMLElement
  game: GameState
  round: RoundHistory
  onNextRound: () => void
  onQuit: () => void
}

export type BetweenRoundsHandle = { unmount: () => void }

export const mountBetweenRounds = (opts: BetweenRoundsOpts): BetweenRoundsHandle => {
  const { game, round } = opts
  const winnerNames = round.winnerIds
    .map((id) => playerById(game, id)?.name ?? "—")
    .filter(Boolean)
  const winnerLine =
    winnerNames.length === 0
      ? "No round winner."
      : winnerNames.length === 1
        ? `${winnerNames[0]} wins the round`
        : `${winnerNames.join(" & ")} tie for the round`

  const scoreRows = round.results
    .map((r) => {
      const player = playerById(game, r.playerId)
      const isWinner = round.winnerIds.includes(r.playerId)
      const totalWins = game.roundsWon[r.playerId] ?? 0
      return `
        <tr class="${isWinner ? "winner" : ""}">
          <td class="pc-pm-score-name">${escapeHtml(player?.name ?? "—")}</td>
          <td class="pc-pm-score-pct">${r.bestPercent}%</td>
          <td class="pc-pm-score-heard">${escapeHtml((r.heardText || "—").slice(0, 60))}</td>
          <td class="pc-pm-score-total">${totalWins}</td>
        </tr>`
    })
    .join("")

  opts.container.innerHTML = `
    <div class="pc-pm-root pc-pm-results">
      <header class="pc-pm-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">Round ${round.round} · First to ${game.winTarget}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
          <span class="pc-pm-headline">${escapeHtml(winnerLine)}</span>
          <div class="pc-pm-head-spacer"></div>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <p class="pc-pm-results-phrase">
          <span class="pc-pm-results-phrase-label">Phrase</span>
          <span class="pc-pm-results-phrase-text">${escapeHtml(round.expectedText)}</span>
        </p>
        <table class="pc-pm-scoreboard">
          <thead>
            <tr>
              <th>Player</th>
              <th>Best %</th>
              <th>Heard</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>${scoreRows}</tbody>
        </table>
      </main>

      <footer class="pc-pm-results-foot">
        <button class="pc-pm-pass" data-pm-quit2>Quit</button>
        <button class="pc-pm-start" data-pm-next>Next round →</button>
      </footer>
    </div>`

  const wire = () => {
    const handleQuit = async () => {
      const proceed = await pmConfirm({
        message: "Quit this game?",
        confirmLabel: "Quit",
        cancelLabel: "Keep playing",
        destructive: true,
      })
      if (proceed) opts.onQuit()
    }
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-quit]")
      ?.addEventListener("click", handleQuit)
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-quit2]")
      ?.addEventListener("click", handleQuit)
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-next]")
      ?.addEventListener("click", () => opts.onNextRound())
  }
  wire()

  return {
    unmount: () => {
      opts.container.innerHTML = ""
    },
  }
}

export type GameOverOpts = {
  container: HTMLElement
  game: GameState
  /** Same roster + target, back to the lobby. */
  onPlayAgain: () => void
  /** Back to mode picker. */
  onDone: () => void
}

export type GameOverHandle = { unmount: () => void }

export const mountGameOver = (opts: GameOverOpts): GameOverHandle => {
  const { game } = opts
  const winners = gameWinners(game)
  const winnerHeadline =
    winners.length === 0
      ? "Game over"
      : winners.length === 1
        ? `${winners[0].name} wins!`
        : `${winners.map((p) => p.name).join(" & ")} tie!`

  // Final cumulative scoreboard, sorted descending by wins.
  const sorted = [...game.players].sort(
    (a, b) => (game.roundsWon[b.id] ?? 0) - (game.roundsWon[a.id] ?? 0),
  )
  const rows = sorted
    .map((p, i) => {
      const wins = game.roundsWon[p.id] ?? 0
      const isWinner = winners.some((w) => w.id === p.id)
      // Average best% across rounds played, for the analytics-curious.
      const averages = game.history
        .map((h) => h.results.find((r) => r.playerId === p.id))
        .filter((r): r is NonNullable<typeof r> => !!r)
      const avgPct = averages.length
        ? Math.round(
            averages.reduce((s, r) => s + r.bestPercent, 0) / averages.length,
          )
        : 0
      return `
        <tr class="${isWinner ? "winner" : ""}">
          <td class="pc-pm-score-rank">${i + 1}</td>
          <td class="pc-pm-score-name">${escapeHtml(p.name)}</td>
          <td class="pc-pm-score-total">${wins}</td>
          <td class="pc-pm-score-pct">${avgPct}%</td>
        </tr>`
    })
    .join("")

  opts.container.innerHTML = `
    <div class="pc-pm-root pc-pm-gameover">
      <header class="pc-pm-head pc-pm-gameover-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">${escapeHtml(`Best of ${game.winTarget * 2 - 1}-ish · ${game.history.length} rounds played`)}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <span class="pc-pm-headline pc-pm-winner">${escapeHtml(winnerHeadline)}</span>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <table class="pc-pm-scoreboard pc-pm-scoreboard-final">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Round wins</th>
              <th>Avg %</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </main>

      <footer class="pc-pm-results-foot">
        <button class="pc-pm-pass" data-pm-done>Done</button>
        <button class="pc-pm-start" data-pm-again>Play again</button>
      </footer>
    </div>`

  opts.container
    .querySelector<HTMLButtonElement>("[data-pm-done]")
    ?.addEventListener("click", () => opts.onDone())
  opts.container
    .querySelector<HTMLButtonElement>("[data-pm-again]")
    ?.addEventListener("click", () => opts.onPlayAgain())

  return {
    unmount: () => {
      opts.container.innerHTML = ""
    },
  }
}
