// THE ECONOMY, played by bots.
//
// The previous build's economy had one measurable defect and this file's
// ancestor is what found it: a pure-guesser bot scored 31,208 against a skilled
// bot's 31,190 over the same seventy seconds, because score came overwhelmingly
// from slicing and the arithmetic was a ten-second interruption to a slicer.
//
// MATH NINJA answers that at the root rather than by nerfing the slicing:
//
//     SCORE COMES FROM ONE SOURCE ONLY — ADVANCING OR FILLING AN ORDER.
//
// which converts mashing from *punished*, which this product's principles
// forbid, into *worthless*, which is the only sanction it is allowed to apply.
// The bots below are the proof, and they are played against the real pure
// functions and the real order model.
//
// Everything about answering WINDOWS is gone from this file because it is gone
// from the game: nothing in MATH NINJA has a clock on it. What is left of the
// cadence table sizes how long a completed sum is HELD, which is a floor on
// reading time rather than a ceiling on thinking time.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  advanceValue,
  CADENCE,
  comprehensionLoad,
  comprehensionP50Ms,
  comprehensionP90Ms,
  FAVOUR_MAX,
  favourAfter,
  gateHoldSeconds,
  LAMPS,
  lampCost,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  orderValue,
  reportsToCurriculum,
  REVEAL_MIN_SECONDS,
  revealDwellSeconds,
  revealHoldSeconds,
  TIDY_CUTS,
  tidyBonus,
  type Verdict,
} from "../sim/economy.ts"
import { BANDS, makeTarget, Order, printedFor } from "../sim/order.ts"

const DIFFICULTIES = Array.from({ length: MAX_DIFFICULTY }, (_, i) => i + MIN_DIFFICULTY)

// ── the cadence table's one remaining job ───────────────────────────────────

test("the hold a completed sum gets is monotone non-decreasing in difficulty", () => {
  // The fleet invariant, on the one function that still consults the cadence
  // table. A harder sum may never be whipped off the screen sooner than an
  // easier one.
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    let previous = -Infinity
    for (const d of DIFFICULTIES) {
      const v = gateHoldSeconds(d, intensity)
      assert.ok(
        v >= previous - 1e-9,
        `intensity ${intensity}: difficulty ${d} is held for ${v.toFixed(2)}s, less than ${previous.toFixed(2)}s`,
      )
      previous = v
    }
  }
})

test("the gate's sum is always held long enough to be read, at every difficulty", () => {
  const rows = DIFFICULTIES.map((d) => ({
    difficulty: d,
    "p50 (s)": (comprehensionP50Ms(d) / 1000).toFixed(1),
    "held, calm child (s)": gateHoldSeconds(d, 0).toFixed(2),
    "held, fluent child (s)": gateHoldSeconds(d, 1).toFixed(2),
  }))
  console.table(rows)
  for (const d of DIFFICULTIES) {
    for (const i of [0, 0.5, 1]) {
      assert.ok(
        gateHoldSeconds(d, i) >= REVEAL_MIN_SECONDS,
        `difficulty ${d} at intensity ${i} would tear the sum off the screen`,
      )
      assert.ok(gateHoldSeconds(d, i) <= 6.01, "the gate hold ran away past six seconds")
    }
  }
  assert.ok(comprehensionLoad(1) < comprehensionLoad(10), "the cadence axis is flat")
  assert.ok(comprehensionP90Ms(10) > comprehensionP50Ms(10), "p90 is not above p50")
  assert.equal(CADENCE.fact.p50, 2800)
})

test("the reveal is patient at the calm end, brief in the middle, and skipped at the top", () => {
  const rows = [0, 0.2, 0.4, 0.6, 0.8, 1].map((i) => ({
    intensity: i,
    "dwell (s)": revealDwellSeconds(i).toFixed(2),
    "market held (s)": revealHoldSeconds(i).toFixed(2),
  }))
  console.table(rows)
  assert.ok(revealDwellSeconds(0) > 3, `a struggling child is held for only ${revealDwellSeconds(0).toFixed(2)}s`)
  assert.ok(revealDwellSeconds(0) > revealDwellSeconds(1), "the dwell is not adaptive at all")
  let previous = Infinity
  for (let i = 0; i <= 1.0001; i += 0.01) {
    const v = revealDwellSeconds(i)
    assert.ok(v <= previous + 1e-9, `the sum was held LONGER at intensity ${i.toFixed(2)}`)
    assert.ok(v >= REVEAL_MIN_SECONDS - 1e-9, `intensity ${i.toFixed(2)} would tear the sum down`)
    previous = v
  }
  assert.equal(revealHoldSeconds(1), 0, "the top of the range is still held for the reveal")
  assert.ok(revealHoldSeconds(0) > 3, "the calm end is not held for the reveal at all")
  assert.ok(Number.isFinite(revealDwellSeconds(Number.NaN)))
})

// ── what a verdict costs ────────────────────────────────────────────────────

test("no verdict costs a lamp — nothing about arithmetic may cost a life", () => {
  for (const v of ["fill", "overshoot"] as Verdict[]) {
    assert.equal(lampCost(v), 0, `a ${v} cost a lamp`)
  }
  assert.equal(LAMPS, 3)
})

test("both verdicts are evidence; a fruit that fell uncut is not a verdict at all", () => {
  assert.equal(reportsToCurriculum("fill"), true)
  assert.equal(reportsToCurriculum("overshoot"), true)
})

test("favour climbs on a fill and falls all the way on an overshoot", () => {
  let f = 1
  for (let i = 0; i < 10; i++) f = favourAfter("fill", f)
  assert.equal(f, FAVOUR_MAX, "favour did not reach its ceiling")
  assert.equal(favourAfter("overshoot", f), 1, "an overshoot did not cost the whole economy")
  assert.equal(favourAfter("overshoot", 1), 1)
})

// ── what an order pays ──────────────────────────────────────────────────────

test("a bigger order is worth more, and an advance is a fraction of the fill", () => {
  let previous = -1
  for (const t of [2, 5, 12, 33, 60, 120, 400, 1000, 3000]) {
    const v = orderValue(t)
    assert.ok(v > previous, `an order for ${t} pays no more than a smaller one`)
    previous = v
    assert.ok(advanceValue(t) > 0, "an advance pays nothing at all")
    assert.ok(advanceValue(t) < v / 2, "an advance pays more than half of the fill")
  }
})

test("three cuts exactly is worth a bonus, and every other count is not", () => {
  assert.equal(TIDY_CUTS, 3)
  for (const cuts of [1, 2, 4, 5, 9]) {
    assert.equal(tidyBonus(33, cuts), 0, `${cuts} cuts paid the three-cut bonus`)
  }
  assert.ok(tidyBonus(33, 3) > 0, "filling in exactly three cuts paid nothing extra")
})

// ── the bots ────────────────────────────────────────────────────────────────

type Bot = {
  name: string
  /** Which airborne value it takes, or -1 for none. */
  choose(order: Order, up: number[], rng: Rng): number
}

/**
 * Play a bot against the real order model and the real scoring for a fixed
 * number of CUTS, so that no bot can win by simply swiping more.
 */
function play(bot: Bot, rung: number, cuts: number, seed: number): { score: number; fills: number; wrecked: number } {
  const rng = new Rng(seed)
  const printed = printedFor(rung)
  let order = new Order(rung, makeTarget(rung, () => rng.next()))
  let score = 0
  let fills = 0
  let wrecked = 0
  let favour = 1
  let combo = 0
  const buf: number[] = []

  for (let n = 0; n < cuts; n++) {
    // Four values in the air, drawn the way the director draws them: uniform
    // over the whole printed set, so helpful and decoy are indistinguishable
    // without doing the arithmetic.
    const up: number[] = []
    for (let i = 0; i < 4; i++) up.push(printed[Math.floor(rng.next() * printed.length)] as number)
    order.frontier(buf)
    // The offer invariant: one of them always advances the order.
    if (!up.some((v) => buf.includes(v)) && buf.length > 0) {
      up[0] = buf[Math.floor(rng.next() * buf.length)] as number
    }

    const v = bot.choose(order, up, rng)
    if (v < 0) continue
    const target = order.target
    const mult = (1 + Math.min(5, Math.floor(combo / 4))) * favour
    const k = order.take(v)
    if (k === "helpful") {
      combo++
      score += Math.round(advanceValue(target) * mult)
      if (order.filled) {
        fills++
        favour = favourAfter("fill", favour)
        score += Math.round((orderValue(target) + tidyBonus(target, order.cuts)) * ((1 + Math.min(5, Math.floor(combo / 4))) * favour))
        order = new Order(rung, makeTarget(rung, () => rng.next()))
      }
    } else if (k === "overshoot") {
      wrecked++
      combo = 0
      favour = favourAfter("overshoot", favour)
      order = new Order(rung, makeTarget(rung, () => rng.next()))
    }
    // A decoy: nothing. Not a point, not a penalty, not a combo break.
  }
  return { score, fills, wrecked }
}

const MASHER: Bot = {
  name: "masher — swipes at whatever is nearest, never reads",
  choose: (_o, up, rng) => up[Math.floor(rng.next() * up.length)] as number,
}

const READER: Bot = {
  name: "reader — takes a value that advances the order, lets the rest go",
  choose: (o, up) => {
    const f = o.frontier([])
    const hit = up.find((v) => f.includes(v))
    return hit ?? -1
  },
}

const HOARDER: Bot = {
  name: "hoarder — reads, and holds out for the exact finisher",
  choose: (o, up) => {
    if (up.includes(o.residual)) return o.residual
    const f = o.frontier([])
    const hit = up.find((v) => f.includes(v))
    return hit ?? -1
  },
}

test("READING BEATS MASHING AT EVERY RUNG, given the same number of cuts", () => {
  const rows: Array<Record<string, string | number>> = []
  for (let rung = 0; rung < BANDS.length; rung++) {
    const m = play(MASHER, rung, 600, 0x51ce + rung)
    const r = play(READER, rung, 600, 0x51ce + rung)
    const h = play(HOARDER, rung, 600, 0x51ce + rung)
    rows.push({
      rung: BANDS[rung]!.name,
      "masher score": m.score,
      "masher orders": m.fills,
      "masher wrecked": m.wrecked,
      "reader score": r.score,
      "reader orders": r.fills,
      "hoarder score": h.score,
      "reader ÷ masher": (r.score / Math.max(1, m.score)).toFixed(1),
    })
    assert.ok(
      r.score > m.score * 2,
      `${BANDS[rung]!.name}: a reader scored ${r.score} against a masher's ${m.score} on the same ` +
        `600 cuts — guessing is still competitive`,
    )
    assert.equal(r.wrecked, 0, "a reader wrecked an order, which is impossible")
  }
  console.table(rows)
})

test("A CUT THAT DOES NOT ADVANCE THE ORDER PAYS NOTHING — the whole anti-mash rule", () => {
  // Stated as a property rather than as a comment. Walk every rung, visiting a
  // wide spread of residuals, and at each state try every printed value: a
  // value that does not advance the order leaves the order bit-for-bit
  // unchanged, and `economy.ts` has no function that takes a non-advancing cut
  // as an argument at all. There is nothing for volume to buy.
  const rng = new Rng(0xdec0)
  let decoys = 0
  let overshoots = 0
  const rows: Array<Record<string, string | number>> = []
  for (let rung = 0; rung < BANDS.length; rung++) {
    const printed = printedFor(rung)
    let rungDecoys = 0
    let rungHelpful = 0
    let rungOver = 0
    for (let run = 0; run < 200; run++) {
      const order = new Order(rung, makeTarget(rung, () => rng.next()))
      const buf: number[] = []
      let guard = 0
      while (!order.filled && guard++ < 30) {
        for (const v of printed) {
          const k = order.classify(v)
          if (k === "helpful") {
            rungHelpful++
            continue
          }
          const before = { residual: order.residual, cuts: order.cuts, plate: order.plate() }
          assert.equal(order.take(v), k)
          assert.equal(order.residual, before.residual, `a ${k} paid its way into the order`)
          assert.equal(order.cuts, before.cuts)
          assert.equal(order.plate(), before.plate)
          if (k === "decoy") rungDecoys++
          else rungOver++
        }
        const f = order.frontier(buf)
        order.take(f[Math.floor(rng.next() * f.length)] as number)
      }
    }
    decoys += rungDecoys
    overshoots += rungOver
    rows.push({
      rung: BANDS[rung]!.name,
      "printed values": printed.length,
      helpful: rungHelpful,
      decoy: rungDecoys,
      overshoot: rungOver,
      "% of cuts that are a real judgement": (
        ((rungDecoys + rungOver) / (rungDecoys + rungOver + rungHelpful)) *
        100
      ).toFixed(0),
    })
    if (rung > 0) {
      assert.ok(rungDecoys > 0, `${BANDS[rung]!.name}: no printed value is ever a decoy`)
    }
    assert.ok(rungOver > 0, `${BANDS[rung]!.name}: no printed value ever overshoots`)
  }
  console.table(rows)
  assert.ok(decoys > 1000 && overshoots > 1000, "the walk did not visit enough states")
})

test("banking a big multiplier and then mashing loses to just reading", () => {
  // The shape of the old build's dominant strategy, retried against the new one:
  // build favour to the ceiling, then cash in on volume. It cannot work, because
  // volume pays nothing and the first overshoot takes the multiplier back to one.
  const OPPORTUNIST: Bot = {
    name: "opportunist — reads until favour is banked, then swipes",
    choose: (o, up, rng) => {
      if (o.cuts === 0) {
        const f = o.frontier([])
        const hit = up.find((v) => f.includes(v))
        return hit ?? -1
      }
      return up[Math.floor(rng.next() * up.length)] as number
    },
  }
  for (let rung = 1; rung < BANDS.length; rung++) {
    const o = play(OPPORTUNIST, rung, 600, 0xbeef + rung)
    const r = play(READER, rung, 600, 0xbeef + rung)
    assert.ok(
      r.score > o.score,
      `${BANDS[rung]!.name}: banking and then swiping scored ${o.score} against a reader's ${r.score}`,
    )
  }
})
