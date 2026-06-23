// Parlometron multiplayer — state machine.
//
// Holds everything the round / results screens need to render and
// advance the game. No DOM here; this module is the data layer.
// `round.ts` owns a single GameState instance and mutates it via
// the helpers below; the UI re-renders after each mutation.
//
// Persistence: the whole state object is serialized to localStorage
// under `pc:parlometron:game-state` after every mutation so an app
// background / OS kill doesn't lose mid-game progress. The save is
// best-effort — quota exhaustion or JSON errors get swallowed and
// the game continues in-memory.
//
// Player IDs are UUIDs (via crypto.randomUUID, available in every
// modern WebView). The `name` field is what's displayed; the `id`
// is the stable key for score / attempt maps.

export const MAX_ATTEMPTS_PER_PLAYER = 3
export const STORAGE_KEY = "pc:parlometron:game-state"

export type WinTarget = 3 | 5 | 7

export type Player = {
  id: string
  name: string
}

/** A single player's result for a single round. */
export type PlayerRoundResult = {
  playerId: string
  /** 0–100. The best of up to MAX_ATTEMPTS_PER_PLAYER tries. */
  bestPercent: number
  /** Whisper transcript for the best attempt — shown on the round
   *  results screen so everyone can see what the model heard. */
  heardText: string
}

/** Frozen record of a completed round. Appended to `history`. */
export type RoundHistory = {
  round: number
  expectedText: string
  /** Sorted descending by `bestPercent`. */
  results: PlayerRoundResult[]
  /** Could contain >1 entry on a tie at the top score. Each gets
   *  +1 toward their `roundsWon`. */
  winnerIds: string[]
}

export type GameState = {
  players: Player[]
  winTarget: WinTarget

  // ────────────────── current round in-flight ──────────────────
  /** 1-based round number. 0 = not yet started. */
  currentRound: number
  /** Player IDs in play order for this round. Reshuffled at the
   *  start of every round so the same player isn't always first. */
  currentRoundOrder: string[]
  /** Index into `currentRoundOrder` — whose turn it is right now. */
  currentPlayerIdx: number
  /** Attempts remaining per player for the current round. Counts
   *  down 3 → 0. When 0, the player's best is locked in. */
  attemptsLeft: Record<string, number>
  /** Best attempt so far this round per player. nil = hasn't
   *  successfully recorded anything yet (e.g. all attempts errored). */
  bestThisRound: Record<string, PlayerRoundResult | null>
  /** The phrase everyone in this round is trying to say. */
  expectedTextThisRound: string

  // ─────────────────────── cumulative ──────────────────────────
  /** Player ID → number of rounds won so far. */
  roundsWon: Record<string, number>
  /** Append-only log of completed rounds. */
  history: RoundHistory[]
}

// ─── construction ───────────────────────────────────────────────

const uid = (): string => {
  try {
    // `crypto.randomUUID` works in all modern WebViews (iOS 16+ /
    // Android Chrome 92+ — both well below our minOSVersion floor).
    return crypto.randomUUID()
  } catch {
    // Defensive fallback — collision-resistant enough for in-memory
    // player IDs in a session.
    return `p_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
  }
}

export const newPlayer = (name: string): Player => ({ id: uid(), name })

export const newGame = (
  players: Player[],
  winTarget: WinTarget,
): GameState => {
  if (players.length < 2) {
    throw new Error("Parlometron needs at least 2 players")
  }
  return {
    players: players.map((p) => ({ ...p })),
    winTarget,
    currentRound: 0,
    currentRoundOrder: [],
    currentPlayerIdx: 0,
    attemptsLeft: {},
    bestThisRound: {},
    expectedTextThisRound: "",
    roundsWon: Object.fromEntries(players.map((p) => [p.id, 0])),
    history: [],
  }
}

// ─── round lifecycle ────────────────────────────────────────────

/** Fisher–Yates in-place shuffle. */
const shuffle = <T>(arr: T[]): T[] => {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Begin a new round with a fresh phrase. Reshuffles player order,
 *  resets per-round attempt counters, advances `currentRound`. */
export const startRound = (state: GameState, expectedText: string): GameState => {
  state.currentRound += 1
  state.currentRoundOrder = shuffle(state.players.map((p) => p.id))
  state.currentPlayerIdx = 0
  state.attemptsLeft = Object.fromEntries(
    state.players.map((p) => [p.id, MAX_ATTEMPTS_PER_PLAYER]),
  )
  state.bestThisRound = Object.fromEntries(
    state.players.map((p) => [p.id, null]),
  )
  state.expectedTextThisRound = expectedText
  return state
}

/** Record one attempt for the current player. Updates best-of-three,
 *  decrements remaining attempts. Returns the (mutated) state. */
export const recordAttempt = (
  state: GameState,
  percent: number,
  heardText: string,
): GameState => {
  const playerId = state.currentRoundOrder[state.currentPlayerIdx]
  if (!playerId) return state
  // Refuse to consume an attempt past zero. Defends against duplicate
  // callbacks (e.g. silence-watcher firing stopRecording while the
  // user's tap is still in flight) overwriting a locked best-score.
  if ((state.attemptsLeft[playerId] ?? 0) <= 0) return state
  const prev = state.bestThisRound[playerId]
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)))
  if (!prev || clampedPercent > prev.bestPercent) {
    state.bestThisRound[playerId] = {
      playerId,
      bestPercent: clampedPercent,
      heardText,
    }
  }
  state.attemptsLeft[playerId] = Math.max(
    0,
    (state.attemptsLeft[playerId] ?? 0) - 1,
  )
  return state
}

/** Move to the next player in the round order. Locks in whatever
 *  best-score the current player has by zeroing their attemptsLeft.
 *  Returns the (mutated) state. */
export const advancePlayer = (state: GameState): GameState => {
  const playerId = state.currentRoundOrder[state.currentPlayerIdx]
  if (playerId) state.attemptsLeft[playerId] = 0
  state.currentPlayerIdx += 1
  return state
}

/** All players have used their attempts (either organically or by
 *  pass / skip). Round is ready to finalize. */
export const allPlayersFinishedRound = (state: GameState): boolean => {
  return state.currentPlayerIdx >= state.currentRoundOrder.length
}

/** True once any player reaches the win target. After this returns
 *  true, no new rounds should start. */
export const isGameOver = (state: GameState): boolean => {
  return state.players.some(
    (p) => (state.roundsWon[p.id] ?? 0) >= state.winTarget,
  )
}

/** Players currently tied at the top of the round-wins board. >1
 *  only after a tie. Empty array before any round has completed. */
export const gameWinners = (state: GameState): Player[] => {
  let max = -1
  for (const p of state.players) {
    const wins = state.roundsWon[p.id] ?? 0
    if (wins > max) max = wins
  }
  if (max < 1) return []
  return state.players.filter((p) => (state.roundsWon[p.id] ?? 0) === max)
}

/** Finalize the current round — compute round winner(s), update
 *  cumulative `roundsWon`, append a `RoundHistory` entry. Returns
 *  the (mutated) state and the new RoundHistory entry. */
export const finishRound = (
  state: GameState,
): { state: GameState; round: RoundHistory } => {
  const results: PlayerRoundResult[] = state.players
    .map(
      (p) =>
        state.bestThisRound[p.id] ?? {
          playerId: p.id,
          bestPercent: 0,
          heardText: "",
        },
    )
    .sort((a, b) => b.bestPercent - a.bestPercent)

  // Tie-handling: every player whose best exactly matches the top
  // score gets +1 toward `roundsWon`. This is generous on purpose —
  // two players who are equally good shouldn't have to replay.
  const top = results[0]?.bestPercent ?? 0
  // Don't award a round-win to anyone if the entire round was 0%
  // (e.g. mic permission denied, nobody actually recorded). Counts
  // as a no-contest round.
  const winnerIds =
    top > 0 ? results.filter((r) => r.bestPercent === top).map((r) => r.playerId) : []
  for (const wid of winnerIds) {
    state.roundsWon[wid] = (state.roundsWon[wid] ?? 0) + 1
  }
  const round: RoundHistory = {
    round: state.currentRound,
    expectedText: state.expectedTextThisRound,
    results,
    winnerIds,
  }
  state.history.push(round)
  return { state, round }
}

/** Look up the player whose turn it currently is. nil between
 *  rounds (when `currentPlayerIdx` is past the order list). */
export const currentPlayer = (state: GameState): Player | null => {
  const id = state.currentRoundOrder[state.currentPlayerIdx]
  if (!id) return null
  return state.players.find((p) => p.id === id) ?? null
}

// ─── persistence ────────────────────────────────────────────────

export const save = (state: GameState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error("[parlometron/state] save failed:", err)
  }
}

export const load = (): GameState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    return parsed as GameState
  } catch (err) {
    console.error("[parlometron/state] load failed:", err)
    return null
  }
}

export const clear = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.error("[parlometron/state] clear failed:", err)
  }
}
