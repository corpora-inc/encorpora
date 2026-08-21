/**
 * When the upgrade cards are allowed to open.
 *
 * ── The bug this file exists to end ─────────────────────────────────────────
 *
 * The founder: "sometimes a level up can happen when a math problem is active
 * and you can never activate the answer after that."
 *
 * He is describing a dead CORE. The three numbered orbs are still on the field
 * and still glowing — the renderer draws `this.orbs` whatever the mode is — and
 * swimming into one does nothing at all, for the rest of the run or until
 * another CORE drifts in forty seconds later.
 *
 * The ordering, exactly:
 *
 *   1. The diver swims into a CORE. `openQuestion` sets `mode = "core"`, lays
 *      the ring of orbs down and starts the thinking clock.
 *   2. Time crawls, but the world still runs: gems are still magneted in and
 *      `gain` is still called. That is not a bug — bullet time is the reward
 *      for reaching the core, not a pause.
 *   3. One of those gems crosses a level. `gain` called `levelUp` **straight
 *      out of the middle of the physics step**, and `levelUp` did
 *      `this.mode = "levelup"`.
 *   4. The child picks a card. `pickCard` ends `this.mode = "play"` — because
 *      "play" is the only place it knew to go back to.
 *
 * And "core" is gone. `questTick` is called only in "core", so the ring stops
 * turning and no strike is ever tested; `closeQuestion` returns early unless
 * the mode is "core", so the thinking clock never expires either. The question
 * is still open, the orbs are still drawn, and nothing on earth will collect
 * one. Nothing is reported to the host — not an answer, not a timeout — so the
 * child is at least not marked wrong for it, but a question they were part-way
 * through has silently stopped existing.
 *
 * The same step also loses a card whenever ONE gem crosses TWO levels, which
 * the late game does regularly: `gain`'s `while` loop called `levelUp` twice,
 * and the second `showCards` overwrote the first three cards before the child
 * had touched them.
 *
 * ── What replaces it ────────────────────────────────────────────────────────
 *
 * Earning a level and being shown the cards are two different events. A level
 * is banked the moment it is earned — the number on the HUD goes up at once,
 * because that is what the child just did — and the cards open on the next
 * frame that the game is in ordinary play. A CORE finishes as a CORE: the ring
 * keeps turning, the answer still counts, and the cards are waiting when the
 * question closes.
 *
 * This is not a defensive reset. Nothing is reset: the interrupt simply never
 * happens, so there is no state to restore and no race to lose.
 */

/** `game.ts`'s mode, repeated here so this file needs nothing from it. */
export type Mode = "title" | "play" | "levelup" | "core" | "rift" | "over" | "paused"

/**
 * The only mode in which a level-up may take the screen.
 *
 * Not "core": a question is open and the child is mid-thought. Not "rift":
 * they are dead and answering for their life. Not "levelup": one panel of
 * cards at a time, or the second overwrites the first. Not "paused", "title"
 * or "over", where there is no run to upgrade.
 */
const OPENS_IN: Mode = "play"

export class LevelUps {
  private queued = 0

  /** Levels earned and not yet spent on a panel of cards. */
  get waiting(): number {
    return this.queued
  }

  /** The XP bar came round. The level is the child's from this moment. */
  earned(): void {
    this.queued++
  }

  /**
   * May the cards open now? Takes one level from the queue if they may.
   *
   * Called once a frame with the current mode, so a level earned inside a CORE
   * opens on the first frame after the question closes — and one earned while
   * the cards are already up waits for the card that is on screen to be picked.
   */
  take(mode: Mode): boolean {
    if (this.queued <= 0) return false
    if (mode !== OPENS_IN) return false
    this.queued--
    return true
  }

  /** A new run. Nothing is owed. */
  clear(): void {
    this.queued = 0
  }
}
