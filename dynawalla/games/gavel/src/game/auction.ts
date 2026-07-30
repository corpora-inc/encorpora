// THE GAVEL — the rules, with no canvas anywhere near them.
//
// A lot stands on the block. Along the gallery, three to five rivals hold up
// tablets, and a tablet carries a *sum* rather than a price: `12 + 5`, `3 × 5`,
// `8 × 1`, `15 − 2`. Above the block hangs the broker's standing offer — what the
// guild will pay for the lot the moment it is yours.
//
// Two gestures and one hammer:
//
//   1. **Mark the tablet you mean to beat.** Free, reversible, costs nothing.
//      This is the child saying *this one is the highest bid in the room*.
//   2. **Set your bid on the paddle.** Digits. Whatever number you like.
//   3. **GAVEL.** The room settles, every tablet turns over, and the money says
//      what happened.
//
//        bid ≤ highest         OUTBID   — a rival takes it
//        highest < bid < offer SOLD     — coins = offer − bid, most at highest+1
//        bid = offer           EVEN     — it sells, there is nothing in it
//        bid > offer           UNSOLD   — you own a thing nobody will buy
//
//   or **FOLD**, which is always safe, and is the only right move on a lot whose
//   offer is not above the room at all.
//
// **The four things a child has to do, and why none of them can be skipped.**
//
//   * *Work out several sums.* The paddle takes a number, so a value has to be
//     produced, not recognised.
//   * *Compare them.* The mark is a separate commitment from the bid, so beating
//     the wrong tablet loses the lot even when the arithmetic on it was perfect —
//     and the host still records that arithmetic as correct, because it was.
//   * *Add one.* `highest + 1` is the bid that earns the most, every time. The
//     bid that equals the highest wins nothing at all.
//   * *Bound it by the offer.* Padding the bid for safety walks into `bid > offer`
//     and buys a thing nobody wants, and the tight margins at the top of the
//     ladder make the padding fatal within two coins.
//
// **What crosses to the host.** One tablet per lot: the marked one, with
// `answered` set to `bid − 1`. Bidding one over a tablet is a statement that the
// tablet is worth exactly `bid − 1`, and that is the value the host judges. Every
// other tablet in the room was read and left, so it is *skipped* — see
// `contract.ts` for why reporting those as wrong would file four misses a round.
//
// **There is no clock.** Not on the bid, not on the mark, not on the lot. The
// only duration in the file is the reveal that plays *after* the hammer, and a tap
// ends it early. `test/antimash.test.ts` plays a seed at eight seconds a lot and at
// a fifth of a second a lot and requires byte-identical coins, tallies and
// reported answers.

import type { Ask, Host, Question } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import {
  CEILING_STEP,
  MAX_BID_DIGITS,
  SPEC,
  ladderScale,
  observe,
  revealHoldMs,
  settleAfterLot,
  tabletCount,
  tryParseBid,
} from "./ladder.ts"
import { LOTS, assembleRoom, isTrap, profitOf, type Room, type Tablet } from "./lot.ts"
import { seedSuccess } from "../../../../packs/shared/game-pacing/index.ts"

/** Lots the broker consigns at a time. */
export const CONSIGNMENT = 5

/**
 * Lots added to the consignment when one does not sell.
 *
 * **This is the whole failure model, and it is COLOSSUS's.** A lot that does not
 * sell stays in the consignment *and* one more joins it, so being wrong costs two
 * more lots of work than being right — visible, countable, and on the strip at the
 * top of the screen. Nothing is taken away: not a coin, not a life, not a turn.
 * There is no buzzer in this pack.
 */
export const EXTRA_ON_MISS = 1

/** The consignment strip never grows past this. Being behind must stay legible. */
export const MAX_CONSIGNMENT = 12

/**
 * Questions drawn, not yet shown, and waiting for a board that suits them.
 *
 * The assembler wants a wide choice — see `lot.ts` — and the bench is what stops that
 * costing ten fresh questions a lot. The cap is what stops it becoming a hoard: a
 * benched question the room never wants is closed rather than held forever, oldest
 * first, so the bench turns over on its own as the ladder moves.
 */
export const BENCH_CAP = 14

/**
 * What the broker pays for being told a lot is not worth bidding on.
 *
 * One coin. It has to be more than nothing, because otherwise the correct move on
 * a trap lot is indistinguishable from giving up, and a child who has read the
 * offer and understood that it is too low has done the harder piece of reasoning
 * in the game. It has to be small, because otherwise folding everything is a
 * living. `test/bots.test.ts` holds both ends.
 */
export const SCOUT_FEE = 1

/**
 * What a bid of exactly one over the room pays, as a multiple.
 *
 * **This is what makes "add one" load-bearing rather than optimal by a hair.**
 * Without it, a child who never works out a single sum can bid one under the
 * broker's offer, win almost every lot, and take a coin each time — and at the
 * tight end of the ladder, where the offer sits two coins above the room, that
 * blind bid *is* the perfect bid. The game would be solvable by reading one
 * number.
 *
 * The keen bid doubles, so the reward for the arithmetic scales with the margin
 * instead of collapsing to a coin. `test/bots.test.ts` measures it: a bot that
 * reads only the offer earns between a third and a ninth of what computing earns,
 * at every intensity, on every seed.
 *
 * It is also the right *fiction*: a broker who buys at the smallest money the room
 * allows is the one the guild pays for.
 */
export const KEEN_MULTIPLIER = 2

export type Outcome = "sold" | "even" | "outbid" | "unsold" | "folded"

export type Settled = {
  readonly outcome: Outcome
  readonly bid: number | null
  /** Coins this lot put in the strongbox. Never negative. */
  readonly coins: number
  /** Won at exactly one over the room: the keen bid, and it pays double. */
  readonly keen: boolean
  /** The value the child asserted about the tablet they marked, or null. */
  readonly claimed: number | null
  /** Whether that assertion was right. Null when nothing was asserted. */
  readonly arithmetic: boolean | null
  readonly room: Room
  readonly marked: Tablet | null
}

export type AuctionEvent =
  | { kind: "lot"; lot: string; room: Room }
  | { kind: "mark"; tablet: Tablet }
  | { kind: "unmark" }
  | { kind: "digit" }
  | { kind: "settled"; settled: Settled }
  | { kind: "consignment"; number: number; sold: number }
  | { kind: "stalled" }

export type Tally = {
  sold: number
  even: number
  outbid: number
  unsold: number
  folded: number
  /** Lots folded that really were not worth bidding on. */
  scouted: number
  /** Lots that came to the block, settled one way or another. */
  settled: number
}

type Slot = { readonly serial: number; readonly lot: string }

export class Auction {
  private readonly host: Host
  private readonly rng: Rng

  private serial = 1
  private queue: Slot[] = []
  private consignmentNo = 1
  private soldHere = 0

  /** Drawn, unused, unshown. Offered to the next room; see `BENCH_CAP`. */
  private bench: Tablet[] = []

  private roomState: Room | null = null
  private lotName = ""
  private markedAt: number | null = null
  private digitsText = ""

  private phaseName: "bidding" | "settled" = "bidding"
  private elapsed = 0
  private duration = 0
  private lastSettled: Settled | null = null

  /** Wall-clock mark for the lot on the block, shifted forward across a pause. */
  private askedAt = 0
  private paused = false
  private pausedAt = 0

  private intensityValue = SPEC.start
  private successValue = seedSuccess(SPEC)
  /**
   * The hardest rung this game has been able to draw a tablet from, or null.
   *
   * Only ever lowered. A rung whose answers do not fit on a tablet cannot start
   * fitting later — the tablet is a constant — and a ceiling that drifted back up
   * would re-enter the same starve every time the child climbed.
   */
  private drawCeiling: number | null = null
  private pendingFlush = false

  private stalledFlag = false

  coins = 0
  /** Lots bought above the offer and still on the shelf. Countable, and it stays. */
  storeroom = 0
  readonly tally: Tally = {
    sold: 0,
    even: 0,
    outbid: 0,
    unsold: 0,
    folded: 0,
    scouted: 0,
    settled: 0,
  }

  constructor(host: Host, rng: Rng, now: number) {
    this.host = host
    this.rng = rng
    this.askedAt = now
  }

  /** Consign the first five lots and bring the first one to the block. */
  begin(now: number): AuctionEvent[] {
    if (this.roomState !== null || this.stalledFlag) return []
    this.refill()
    return this.bringToBlock(now)
  }

  // ── what the renderer reads ────────────────────────────────────────────────

  get room(): Room | null {
    return this.roomState
  }

  get lot(): string {
    return this.lotName
  }

  get phase(): "bidding" | "settled" {
    return this.phaseName
  }

  get settled(): Settled | null {
    return this.lastSettled
  }

  get marked(): number | null {
    return this.markedAt
  }

  get markedTablet(): Tablet | null {
    return this.markedAt === null ? null : (this.roomState?.tablets[this.markedAt] ?? null)
  }

  get digits(): string {
    return this.digitsText
  }

  /** The bid on the paddle, or null when there is nothing on it. */
  get bid(): number | null {
    return this.digitsText === "" ? null : tryParseBid(this.digitsText)
  }

  /** Lots left in this consignment, including the one on the block. */
  get remaining(): number {
    return this.queue.length
  }

  get consignmentNumber(): number {
    return this.consignmentNo
  }

  get intensity(): number {
    return this.intensityValue
  }

  get success(): number {
    return this.successValue
  }

  get ceiling(): number | null {
    return this.drawCeiling
  }

  get stalled(): boolean {
    return this.stalledFlag
  }

  get isPaused(): boolean {
    return this.paused
  }

  /** Milliseconds left of the settled room's reveal. Zero while bidding. */
  get holdLeft(): number {
    return this.phaseName === "settled" ? Math.max(0, this.duration - this.elapsed) : 0
  }

  /** Whether the hammer would do anything if it were tapped right now. */
  get armed(): boolean {
    if (this.paused || this.stalledFlag) return false
    if (this.phaseName !== "bidding" || this.roomState === null) return false
    const bid = this.bid
    return this.markedAt !== null && bid !== null && bid >= 1
  }

  // ── what the child does ───────────────────────────────────────────────────

  /**
   * Mark the tablet you mean to beat, or take the mark off it.
   *
   * Free and reversible, like taking hold of a floor in COLOSSUS: exploring the
   * room must never cost anything. Single selection — there is one highest bid.
   */
  tapTablet(index: number): AuctionEvent[] {
    if (!this.open) return []
    const tablet = this.roomState?.tablets[index]
    if (!tablet) return []
    if (this.markedAt === index) {
      this.markedAt = null
      return [{ kind: "unmark" }]
    }
    this.markedAt = index
    return [{ kind: "mark", tablet }]
  }

  pressDigit(digit: number): AuctionEvent[] {
    if (!this.open) return []
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return []
    // A leading zero is not a price. Swallowed rather than refused: a child who
    // meant 10 and hit 0 first should just carry on and hit 1.
    if (this.digitsText === "" && digit === 0) return []
    if (this.digitsText.length >= MAX_BID_DIGITS) return []
    this.digitsText += String(digit)
    return [{ kind: "digit" }]
  }

  backspace(): AuctionEvent[] {
    if (!this.open || this.digitsText === "") return []
    this.digitsText = this.digitsText.slice(0, -1)
    return [{ kind: "digit" }]
  }

  /**
   * THE GAVEL. The one assertion in the game, and the only thing reported.
   *
   * Inert without a mark or without a bid — neither is an assertion, and an
   * unarmed hammer costs nothing. Everything else settles the lot.
   */
  hammer(now: number): AuctionEvent[] {
    if (!this.armed) return []
    const room = this.roomState
    const marked = this.markedTablet
    const bid = this.bid
    if (!room || !marked || bid === null) return []

    // **The question THE GAVEL asks is "what is one more than this tablet?"** and the
    // bid IS the answer to it — typed by the child, digit by digit, with nothing
    // derived on the way. `bid − 1` is that same answer written in the host's terms,
    // because the host's canonical value for this item is the tablet itself.
    //
    // Two consequences, and both are deliberate:
    //
    //   * A child who works this tablet out and bids one over it is reported CORRECT
    //     whatever the money then does — marking the wrong tablet loses the lot, and
    //     losing the lot is not an arithmetic verdict. `test/report.test.ts` holds
    //     that as its first property, because it is the thing TREBUCHET got wrong.
    //   * A child who bids two over, or level with the tablet, is reported wrong.
    //     That is an over-attribution — they may be able to add and simply not have
    //     the rule yet — and it is the direction that is safe: a false wrong steps
    //     the ladder DOWN and serves easier sums, and there is no bid anywhere in
    //     this game that reports a wrong answer as right.
    const claimed = bid - 1
    const arithmetic = claimed === marked.value

    if (marked.id !== "") {
      this.host.report({
        questionId: marked.id,
        correct: arithmetic,
        ms: Math.max(0, now - this.askedAt),
        answered: String(claimed),
      })
    }
    // Everything the child read and did not answer. Closed, not filed as wrong.
    for (const tablet of room.tablets) {
      if (tablet !== marked) this.close(tablet)
    }

    const outcome: Outcome =
      bid <= room.highest
        ? "outbid"
        : bid > room.offer
          ? "unsold"
          : bid === room.offer
            ? "even"
            : "sold"
    const keen = outcome === "sold" && bid === room.highest + 1
    const profit = outcome === "sold" ? Math.max(0, profitOf(room, bid)) : 0
    const coins = keen ? profit * KEEN_MULTIPLIER : profit
    if (outcome === "unsold") this.storeroom += 1

    return this.finish(
      { outcome, bid, coins, keen, claimed, arithmetic, room, marked },
      arithmetic,
    )
  }

  /**
   * FOLD. Let the lot go.
   *
   * Always safe and never reported: a child who declined to bid has not asserted a
   * number, and inventing one for them is what `report({ answered: "" })` did in
   * six games until this week. On a lot whose offer is not above the room this is
   * the *right* answer, and the broker pays for it.
   */
  fold(): AuctionEvent[] {
    if (!this.open) return []
    const room = this.roomState
    if (!room) return []
    for (const tablet of room.tablets) this.close(tablet)

    const worthless = isTrap(room)
    const coins = worthless ? SCOUT_FEE : 0
    if (worthless) this.tally.scouted += 1

    // No arithmetic verdict, so the controller hears nothing. A fold says nothing
    // about what the child knows and a guess from it would be a decision this game
    // has no business making.
    return this.finish(
      {
        outcome: "folded",
        bid: null,
        coins,
        keen: false,
        claimed: null,
        arithmetic: null,
        room,
        marked: null,
      },
      null,
    )
  }

  /** A tap during the reveal. Ends it now; it was never a wait for an answer. */
  nudge(): AuctionEvent[] {
    if (this.paused || this.phaseName !== "settled") return []
    this.elapsed = this.duration
    return []
  }

  /**
   * Time passing.
   *
   * **Returns immediately while the child is bidding**, so elapsed time literally
   * cannot accumulate while they are thinking — FOUNDRY STREET's shape, and its
   * comment: "a child who is thinking must never be losing". The only phase with a
   * duration is the reveal, which happens after the hammer has already fallen.
   */
  advance(dt: number, now: number): AuctionEvent[] {
    if (this.paused || this.stalledFlag) return []
    if (this.phaseName === "bidding") return []
    this.elapsed += Math.max(0, dt)
    if (this.elapsed < this.duration) return []
    return this.nextLot(now)
  }

  /** The host put a sheet over us. Stop the clock; stop taking input. */
  pause(now: number): void {
    if (this.paused) return
    this.paused = true
    this.pausedAt = now
  }

  /**
   * The sheet came off. Shift the lot's wall-clock mark forward by the span the
   * child was not here for, so the latency reported is time they actually spent
   * looking at the room.
   */
  resume(now: number): void {
    if (!this.paused) return
    this.paused = false
    this.askedAt += Math.max(0, now - this.pausedAt)
  }

  // ── internals ────────────────────────────────────────────────────────────

  private get open(): boolean {
    return !this.paused && !this.stalledFlag && this.phaseName === "bidding"
  }

  /** Close a question the child read and never answered. */
  private close(tablet: Tablet): void {
    if (tablet.id === "") return
    this.host.skip?.(tablet.id)
  }

  /**
   * Bank the outcome, move the consignment, and hold the settled room up.
   *
   * The controller hears exactly one thing: whether the arithmetic the child
   * asserted was right. Not whether they made money — a child who reads the room
   * perfectly and then pads their bid has done the arithmetic and mispriced the
   * lot, and only one of those two is a fact about what the ladder should serve
   * next.
   */
  private finish(settled: Settled, arithmetic: boolean | null): AuctionEvent[] {
    this.coins += settled.coins
    this.tally.settled += 1
    this.tally[settled.outcome] += 1
    if (settled.outcome === "sold" || settled.outcome === "even") this.soldHere += 1

    if (arithmetic !== null) {
      this.successValue = observe(this.successValue, arithmetic)
    }
    // Once per settled lot, on a nominal step. This is the only line in the game
    // that moves the intensity, and no wall clock reaches it.
    this.intensityValue = settleAfterLot(this.intensityValue, this.successValue)

    const missed = settled.outcome === "outbid" || settled.outcome === "unsold"
    const head = this.queue.shift()
    if (missed && head) {
      // The lot did not sell, so it goes back into the consignment — and the
      // broker adds another. More to work through; nothing taken away.
      this.queue.push(head)
      for (let i = 0; i < EXTRA_ON_MISS && this.queue.length < MAX_CONSIGNMENT; i++) {
        this.queue.push(this.slot())
      }
    }

    this.lastSettled = settled
    this.markedAt = null
    this.digitsText = ""
    this.phaseName = "settled"
    this.elapsed = 0
    this.duration = revealHoldMs(this.intensityValue)
    return [{ kind: "settled", settled }]
  }

  /** The reveal is over. Wrap the consignment if it is empty, then draw a room. */
  private nextLot(now: number): AuctionEvent[] {
    const events: AuctionEvent[] = []
    if (this.queue.length === 0) {
      const sold = this.soldHere
      events.push({ kind: "consignment", number: this.consignmentNo, sold })
      // A consignment the child sold out of is a stopping point they reached. One
      // they only cleared by having every lot taken off them is not, and a
      // purchase surface must never sit next to a shortfall.
      if (sold > 0) this.host.transition?.("level", `consignment ${String(this.consignmentNo)}`)
      this.consignmentNo += 1
      this.soldHere = 0
      this.refill()
    }
    events.push(...this.bringToBlock(now))
    return events
  }

  private refill(): void {
    for (let i = 0; i < CONSIGNMENT; i++) this.queue.push(this.slot())
  }

  private slot(): Slot {
    return { serial: this.serial++, lot: this.rng.pick(LOTS) }
  }

  /** Draw the room for the lot at the head of the consignment. */
  private bringToBlock(now: number): AuctionEvent[] {
    const head = this.queue[0]
    if (!head) return []

    const want = tabletCount(this.intensityValue)
    const assembly = assembleRoom(
      () => this.draw(),
      want,
      this.intensityValue,
      this.rng,
      (q) => {
        this.capBelow(q)
      },
      this.bench,
    )
    // A question this game can never use is closed at once. One it simply did not want
    // this time waits on the bench, and only the overflow is closed — oldest first, so
    // a value the room keeps passing over does not sit there for the whole session.
    for (const tablet of assembly.discarded) this.close(tablet)
    this.bench = [...assembly.bench]
    while (this.bench.length > BENCH_CAP) {
      const stale = this.bench.shift()
      if (stale) this.close(stale)
    }

    if (!assembly.room) {
      this.stalledFlag = true
      this.roomState = null
      console.error("[gavel] the host served nothing this game can put a tablet up for")
      return [{ kind: "stalled" }]
    }

    this.roomState = assembly.room
    this.lotName = head.lot
    this.markedAt = null
    this.digitsText = ""
    this.phaseName = "bidding"
    this.elapsed = 0
    this.duration = 0
    this.askedAt = now
    return [{ kind: "lot", lot: head.lot, room: assembly.room }]
  }

  /**
   * One question, at what this run is asking for.
   *
   * The flush waits until after `next` has carried the new ceiling onto the wire.
   * `game-host`'s flush ranks the pool with a distance function that reads the
   * host's OWN ceiling, and that is only updated inside `next` — so flushing the
   * instant a ceiling is set ranks every pooled question against the stale one and
   * keeps precisely the rung it meant to discard. Measured in POLARITY at ten
   * consecutive silent questions.
   */
  private draw(): Question {
    const q = this.host.next(this.askShape())
    if (this.pendingFlush) {
      this.pendingFlush = false
      this.host.flush?.()
    }
    return q
  }

  /** What this run asks the host for, difficulty and ceiling both. */
  askShape(): Ask {
    const ask: Ask = { difficulty: ladderScale(this.intensityValue) }
    if (this.drawCeiling !== null) ask.maxDifficulty = ladderScale(this.drawCeiling)
    return ask
  }

  /**
   * Ban the rung an undrawable question came from, and everything above it.
   *
   * Declining an item is per-item and the host serves by RUNG: ask again at the
   * same difficulty and the same rung answers. Without this, a rung whose answers
   * do not fit on a tablet is not a degradation, it is a soft-lock — every room
   * spends its whole draw budget being refused and the child is served a stall.
   */
  private capBelow(q: Question): void {
    // A difficulty that is not a number caps nothing. Without this the ceiling
    // becomes NaN, which the host discards as "not a difficulty" — leaving it inert
    // AND the monotone guard below permanently false, so every later refusal
    // re-logs and re-flushes for the life of the run.
    if (!Number.isFinite(q.difficulty)) return
    const at = Math.min(1, Math.max(0, q.difficulty))
    const capped = Math.max(0, at - CEILING_STEP)
    if (this.drawCeiling !== null && this.drawCeiling <= capped) return
    this.drawCeiling = capped
    this.pendingFlush = true
    console.error(
      `[gavel] a rung THE GAVEL cannot put on a tablet was served at difficulty ${at.toFixed(3)}; ` +
        `capping the stream at ${capped.toFixed(3)} for the rest of this run`,
    )
  }
}
