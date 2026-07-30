// THE HINT — the tree, unfolded a little at a time.
//
// The founder's report, verbatim, is the specification:
//
// > "Trying to look at 642 − 530 and know that 2×2×2×2×7 = 112 is a pretty
// > heroic task. But, if we could show the factorization tree as a dazzling
// > hint … perhaps in a cool way like leaving some of the leaves blank or …
// > maybe giving a partial like 16*7=112 … right now it's easy to get stuck and
// > overwhelmed but … it could be OK to basically reveal the answer in a really
// > satisfying way."
//
// Two hard steps are stacked in this game and nothing separated them: work out
// `642 − 530`, *then* work out that the answer is four twos and a seven. A child
// who can do the first and not the second is stuck with no way forward and no
// way to ask, and the arena's only response was to keep drifting.
//
// ## The escalation
//
// Six stages for a composite, and each one is a *masking* of the same tree — the
// tree never changes, only how much of it carries a numeral.
//
//   1. **THE SHAPE.** The tree appears with every node blank. It says nothing
//      arithmetical at all and it says the single most useful thing: *how many
//      pieces the hold needs*, and how they come apart. A child hunting for a
//      fourth prime that does not exist is unstuck by this alone.
//   2. **ONE PRIME.** The largest leaf lights. In `112 = 2·2·2·2·7` that is the
//      `7` — the one a child sweeping twos will never stumble into.
//   3. **HALF A SPLIT.** The smaller of the root's two children lights, and its
//      sibling stays blank — the founder's `129 ⟶ 3 and ⟶ ?`. On most trees this
//      is the last picture that does not state the answer.
//
//      On about three composites in ten it is not, and 129 is one of them: its
//      tree is `3 · 43`, and 43 is both the largest leaf (stage 2) and the larger
//      root child, so this stage lights both halves at once. That is why nothing
//      here is keyed to a stage number — `freeStages` walks the tree and
//      `revealsAnswer` reads the picture. See both.
//   4. **THE PARTIAL.** The sibling lights too: `16 × 7`, with the root still
//      blank. The stepping stone. From here the answer is on the screen — in a
//      form the child finishes themselves, which is the point.
//   5. **THE LEAVES.** Every leaf lights. The hold is now spelled out and the
//      child can simply go and get it. Nobody is stuck past this point.
//   6. **THE WHOLE TREE.** Every node, root included. `112` at the top of its
//      own tree, and the sentence closes.
//
// A prime target — the wall — has no tree, so it has two stages: the blank
// silhouette of one lonely node, and then the numeral. That is the correct
// hint for a wall, because the only hold that opens a prime is the single mote
// carrying it and the whole task is knowing which mote to hunt.
//
// ## What a hint costs: nothing, and that had to be checked at the wire
//
// Not a point, not the chain, not the BEST counter, not the ceremony when the
// resonator opens. No counter anywhere says how many hints were taken and no
// string anywhere mentions needing help. The tree simply arrives.
//
// **The version of this that shipped in review got it wrong, and it is worth
// writing down why.** The reasoning was: once the tree states the answer, a
// `correct` report is a claim about the child that is not true, so close the
// question with `host.skip` — "records nothing, moves no ladder, produces no
// outcome" — instead. Honest, and invisible from inside the canvas.
//
// It is not invisible three pixels above it. `game-host` says of `skip`, in as
// many words, that it "does not advance the session progress fraction, because
// that counts answered questions", and the host paints that fraction as a
// full-width hairline across the top of every pack. Measured on a seeded run
// that took the hint to the end five times: five resonators opened, five
// ceremonies, `OPENED 5` — and the progress bar still on nought. **The child who
// leans on the hint is the child this feature exists for, and their progress bar
// was the one that never moved.** That is a punishment, delivered by the one
// persistent indicator on the screen, and it is exactly what the founder ruled
// out. So the report goes to the host as it always did.
//
// What is left of the concern is handled where the game actually owns the
// decision: `arena.enter` does **not** climb its own ladder on a resonator whose
// tree stated the answer. Three rungs of harder arithmetic next time is the one
// thing a hint could still take, and holding position is the absence of a
// penalty rather than one.
//
// ## The clock never crosses the line, and it is not a clock
//
// Hints also arrive on their own, and a struggling child must never see a timer.
// There is no countdown, no ring filling, no "hint in 3", no banner. The tree
// fades in the way the sheet ripples: something happened, and it was warm.
//
// **And the clock stops at `freeStages`** — the last picture that does not state
// the answer. Time alone will show a child the shape of the tree and one prime
// and half of the first split, and then it stops and the control glows. Going
// further is something a child does on purpose, with a thumb. Nothing that
// happens to a child who is merely sitting there can reach the stage that holds
// this pack's own ladder still.
//
// The quiet before the first one is `firstHintMs`, and it is held to the same
// law the fleet holds an answer window to — **a pure function of the item, and
// monotone non-decreasing in the item's difficulty.** No speed, no elapsed time,
// no streak, no reading of how the child is doing goes into it. A harder item
// buys *more* silence, never less, because a hint arriving sooner on a harder
// problem is the game saying it does not think you can do this one.
//
// (THE LATTICE has no answer window and this does not add one. Nothing here is
// ever a deadline: past the last stage the tree simply sits there, complete.)

import { primeFactors } from "./factor.ts"
import type { Placed } from "./tree.ts"

/** Stages a composite target unfolds through. See the list above. */
export const HINT_STAGES = 6

/** Stages a prime target — the wall — unfolds through: the shape, then the numeral. */
export const WALL_STAGES = 2

/**
 * The quiet a child gets with a *new* item before the game offers anything, and
 * what it is allowed to depend on.
 *
 * `HINT_DWELL_MS` is the floor. `PER_TILE` buys silence for a hold with more
 * pieces in it — five motes is more flying than three, and a child mid-sweep is
 * working, not stuck. `PER_RUNG` buys silence for a harder rung on the host's
 * ladder.
 *
 * Both coefficients are **non-negative**, which is the whole proof of the
 * monotonicity law: `firstHintMs` is a sum of non-negative multiples of the
 * item's own difficulty signals, so it cannot decrease when either of them
 * rises. `hint.test.ts` asserts it exhaustively rather than taking the argument
 * on trust.
 *
 * A mid-band item — five primes, two thirds of the way up the game's band — gets
 * about thirty-five seconds of silence. That is roughly seven times what the
 * perfect bot in `pacing.test.ts` needs for a whole round and comfortably longer
 * than a child who is getting on with it, so the first offer lands on a child
 * who has stopped rather than on one who is working.
 */
export const HINT_DWELL_MS = 22_000
export const HINT_DWELL_PER_TILE_MS = 2_000
export const HINT_DWELL_PER_RUNG_MS = 6_000

/**
 * The gap between one stage and the next, as a fraction of the first quiet.
 *
 * **Longer than the first quiet, and that is the opposite of what warmth would
 * suggest.** The clock has only `freeStages` to give — the silhouette, one
 * prime, and usually half of the first split — and once it has given them it
 * stops. Spending them slowly is what makes each one a separate thing that
 * happened rather than a panel unfolding at a child who has looked away.
 * Mid-band that is a silhouette at 35s, a prime at 65s and half a split at 95s,
 * and then the control glows and the rest is the child's to ask for.
 *
 * A child who wants it faster taps, and has the whole tree in four seconds.
 */
export const HINT_STEP_FRACTION = 0.85

/** The item a hint is about. Everything `firstHintMs` is allowed to read. */
export type HintItem = {
  /** The rung that served it, 0..1. Not a claim about the child. */
  readonly difficulty: number
  /** How many primes the answer's hold is. */
  readonly tiles: number
}

/** The item, read off a target and the rung it came from. Pure. */
export function itemOf(target: number, difficulty: number): HintItem {
  return { difficulty, tiles: primeFactors(target).length }
}

/**
 * How long the game stays quiet before the first hint.
 *
 * **Pure in the item, monotone non-decreasing in difficulty and in tiles.**
 * Nothing else is in scope here — not the clock, not the ship's speed, not how
 * many resonators have been refused, not the chain. Two calls with the same item
 * return the same number for the whole life of the process.
 */
export function firstHintMs(item: HintItem): number {
  const difficulty = Number.isFinite(item.difficulty)
    ? Math.max(0, Math.min(1, item.difficulty))
    : 0
  const tiles = Number.isFinite(item.tiles) ? Math.max(0, item.tiles) : 0
  return HINT_DWELL_MS + HINT_DWELL_PER_TILE_MS * tiles + HINT_DWELL_PER_RUNG_MS * difficulty
}

/**
 * Which stage the clock alone has reached after `elapsedMs` with this item.
 *
 * `0` is "no hint at all", and it is where a child who is getting on with it
 * spends the whole round. Note what is *not* here: nothing about how fast the
 * child is, nothing about whether they have refused, nothing that could read as
 * the game losing patience.
 */
export function scheduledStage(elapsedMs: number, item: HintItem): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  const first = firstHintMs(item)
  if (elapsedMs < first) return 0
  const step = Math.max(1, first * HINT_STEP_FRACTION)
  return 1 + Math.floor((elapsedMs - first) / step)
}

/** How many stages this tree has. A wall has two; everything else has six. */
export function stageCount(placed: Placed): number {
  return placed.nodes.length <= 1 ? WALL_STAGES : HINT_STAGES
}

/**
 * The last stage the **clock** may reach on its own: the largest one whose
 * picture does not determine the root.
 *
 * Computed from the tree rather than fixed at a number, because which stage
 * crosses the line depends on the shape. Usually it is three — the silhouette,
 * one prime, half of the first split. But when the largest leaf *is* the larger
 * of the root's two children, stage 3 lights both halves of the split and
 * crosses a stage early: `129 → 3 · 43` is one of them, and so is `28 → 4 · 7`.
 * Measured over the whole band — 573 targets the resonator can put up, of which
 * 410 are composite — that is between 112 and 123 of the 410 depending on the
 * seed, so **roughly three composites in ten**. A hardcoded 3 would be wrong for
 * about a third of them.
 *
 * For a wall it is one: the silhouette of a single node, which says "this one
 * does not come apart, go and find it" and is the whole of what a wall's hint
 * can honestly be without simply printing the number.
 */
export function freeStages(placed: Placed): number {
  const cap = stageCount(placed)
  let last = 0
  for (let stage = 1; stage <= cap; stage++) {
    if (revealsAnswer(placed, shownAt(placed, stage))) break
    last = stage
  }
  return last
}

/**
 * Which nodes carry a numeral at `stage`. Everything else is drawn blank.
 *
 * Pure and deterministic — no `Rng`, so the same tree at the same stage is the
 * same picture every time, which is what makes the escalation testable and what
 * stops a redraw shuffling the blanks around under a child's eyes.
 */
export function shownAt(placed: Placed, stage: number): Set<number> {
  const out = new Set<number>()
  if (stage < 2 || placed.nodes.length === 0) return out

  // Stage 2 — the largest leaf. The surprising one: the 7 in 112, the 5 in 60.
  // A child sweeping twos would never have guessed it was in there.
  out.add(largestLeaf(placed))
  if (stage < 3) return out

  const root = placed.nodes[0]
  const kids = root?.kids ?? null
  if (kids) {
    const a = placed.nodes[kids[0]]?.value ?? 0
    const b = placed.nodes[kids[1]]?.value ?? 0
    // Stage 3 — half of the first split, the smaller side. `129 ⟶ 3 and ⟶ ?`.
    out.add(a <= b ? kids[0] : kids[1])
    // Stage 4 — the other half. `16 × 7`, and the root still blank.
    if (stage >= 4) out.add(a <= b ? kids[1] : kids[0])
  }
  if (stage < 5) return out

  // Stage 5 — every leaf. The hold, spelled out. Nobody is stuck past here.
  for (const leaf of placed.leaves) out.add(leaf)
  if (stage < 6) return out

  // Stage 6 — the whole tree, root included. The sentence closes.
  for (let i = 0; i < placed.nodes.length; i++) out.add(i)
  return out
}

/**
 * The index of the biggest leaf, leftmost on a tie.
 *
 * Deterministic on purpose. The first numeral a child is given should be the one
 * they were least likely to find on their own, and in a factorisation that is
 * always the largest prime — the 7 under four twos, the 5 under `2·2·3·5`.
 */
function largestLeaf(placed: Placed): number {
  let best = placed.leaves[0] ?? 0
  let bestValue = placed.nodes[best]?.value ?? 0
  for (const index of placed.leaves) {
    const value = placed.nodes[index]?.value ?? 0
    if (value > bestValue) {
      bestValue = value
      best = index
    }
  }
  return best
}

/**
 * Do the revealed nodes pin the root down?
 *
 * True when the root is shown, or when both of its children are determined, all
 * the way down — which is exactly "there is a set of visible numbers on screen
 * whose product is the answer". This is the line `arena.enter` uses to decide
 * whether the host is told anything at all, and it is computed from the picture
 * rather than hardcoded to a stage number, because the stage a tree reaches that
 * line at depends on its shape: a wall crosses it at stage 2.
 */
export function revealsAnswer(placed: Placed, shown: ReadonlySet<number>): boolean {
  if (placed.nodes.length === 0) return false
  const determined = (index: number): boolean => {
    if (shown.has(index)) return true
    const kids = placed.nodes[index]?.kids ?? null
    if (!kids) return false
    return determined(kids[0]) && determined(kids[1])
  }
  return determined(0)
}

/**
 * How slowly a reveal unfolds, in milliseconds between one node lighting and
 * the next.
 *
 * **This is the only thing in the hint system that reads the child at all**, and
 * it reads the chain rather than a clock. At the bottom the reveal is long and
 * calm — a child who is finding this hard gets to watch each piece arrive, and
 * that watching is most of the value. On a chain the same reveal snaps into
 * place in a couple of frames, because a child who is flying does not want a
 * ceremony in front of their arena and skipping it is the reward for mastery.
 *
 * It changes nothing about *what* is revealed or *when* — only how it lands.
 * Monotone non-increasing in the chain, and `hint.test.ts` asserts that.
 */
export const REVEAL_PACE_CALM_MS = 240
export const REVEAL_PACE_FAST_MS = 24
export const REVEAL_PACE_CHAIN = 6

export function revealPaceMs(chain: number): number {
  const c = Number.isFinite(chain) ? Math.max(0, chain) : 0
  const t = Math.min(1, c / REVEAL_PACE_CHAIN)
  return REVEAL_PACE_CALM_MS + (REVEAL_PACE_FAST_MS - REVEAL_PACE_CALM_MS) * t
}

/**
 * Which lit leaves the child is already carrying — the maths moment, as a set.
 *
 * This is the beat the whole hint is for: the tree says `2 · 2 · 2 · 2 · 7`, the
 * child sweeps a 2, and one of the four twos on the tree clicks into place with
 * a spark. The factorisation assembling itself is the celebration, rather than
 * the resonator opening thirty seconds later.
 *
 * A multiset walk and not an `includes`, and that is the whole reason this is a
 * function in this file rather than four lines inside the renderer: a tree with
 * four twos in it and a hold with two twos must collar exactly *two* of them.
 * Collar all four and the picture says the hold is finished when it is half
 * finished, which is a hint that lies — and a child who trusts it flies into the
 * ring and is refused.
 *
 * Blank leaves are never collared. Marking a `?` as "you already have this one"
 * would leak which prime it is, one stage early, for free.
 */
export function heldLeaves(
  placed: Placed,
  shown: ReadonlySet<number>,
  tiles: readonly number[],
): Set<number> {
  const spare = new Map<number, number>()
  for (const tile of tiles) spare.set(tile, (spare.get(tile) ?? 0) + 1)
  const out = new Set<number>()
  for (const index of placed.leaves) {
    if (!shown.has(index)) continue
    const value = placed.nodes[index]?.value ?? 0
    const left = spare.get(value) ?? 0
    if (left <= 0) continue
    spare.set(value, left - 1)
    out.add(index)
  }
  return out
}

/** The hint as it stands, handed to the renderer whole. */
export type HintState = {
  readonly placed: Placed
  /** 0 = nothing drawn. 1 = the blank silhouette. Up to `stages`. */
  readonly stage: number
  readonly stages: number
  /** Indices into `placed.nodes` that carry a numeral. */
  readonly shown: ReadonlySet<number>
  /** Whether what is drawn already determines the answer. */
  readonly given: boolean
}
