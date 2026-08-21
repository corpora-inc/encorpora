// DENSITY IS A MEASURED NUMBER, NOT A VIBE.
//
// The design document measured the build the founder played by driving the real
// `Director` for 180 simulated seconds at 60 Hz with a MASHER model — swipes
// continuously at 6 cuts/second, never reads a numeral, takes cascade children
// as they appear. It reported:
//
//     live cuttable objects   median 7 · p90 25 · p99 30 · max 34
//     free cuts per arithmetic decision                     27.4
//     objects on screen at t = 13 s                           16
//
//   "the first time you open it it still has 1 billion things to slice and it is
//    still the same button mashing crap it was before."
//
// This file re-runs the SAME measurement against the shipped director and prints
// the table. A claim of "calmer" that is not a number is not a claim, so the
// numbers are asserted rather than admired, and every threshold is quoted
// against the baseline it has to beat.

import test from "node:test"
import assert from "node:assert/strict"

import { Director, type Market, type Throw } from "../sim/director.ts"
import { Rng } from "../core/rng.ts"
import { BANDS, makeTarget, Order, printedFor } from "../sim/order.ts"

/** THE BASELINE. Every number below is quoted against these. */
const SHIPPED = { median: 7, p90: 25, p99: 30, max: 34, freeCutsPerDecision: 27.4, atThirteen: 16 }

function blank(): Throw {
  return { kind: "gourd", value: 0, glyph: "", delayMs: 0, bandT: 0, apex: 0 }
}

/**
 * `arm` is the flight time before an object is within reach of a blade — it has
 * to rise toward its apex first. Without it a bot at 6 cuts/second deletes every
 * object on the frame it is thrown and the measured density is trivially zero,
 * which would flatter this build rather than measure it.
 */
const ARM_SECONDS = 0.35

type Airborne = { life: number; arm: number; value: number; kind: Throw["kind"]; absurd: boolean }

type RunOptions = {
  seconds?: number
  /** Cuts per second. 6 is the document's masher. 0 never touches the screen. */
  cutsPerSecond?: number
  /** Does the bot read the numeral before it cuts? */
  reads?: boolean
  intensity?: number
  seed?: number
  /** Seconds a thrown object stays cuttable. 1.8 s is the harshest viewport. */
  flight?: number
}

type RunResult = {
  live: number[]
  median: number
  p90: number
  p99: number
  max: number
  atThirteen: number
  emptyFraction: number
  freeCuts: number
  decisions: number
  fills: number
  overshoots: number
  cuts: number
  fillsPerCut: number
  ratio: number
  maxDrySeconds: number
  overCap: number
}

function rungFor(intensity: number): number {
  return Math.max(0, Math.min(BANDS.length - 1, Math.floor(intensity * BANDS.length)))
}

/**
 * Drive the real director and the real order model against a bot.
 *
 * Everything the game itself would do on a cut is done here: helpful advances
 * the order, overshoot rotates it, decoy and absurd change nothing at all.
 */
function run(opts: RunOptions = {}): RunResult {
  const seconds = opts.seconds ?? 180
  const cps = opts.cutsPerSecond ?? 6
  const flight = opts.flight ?? 1.8
  const intensity = opts.intensity ?? 0.5
  const rng = new Rng(opts.seed ?? 12345)
  const d = new Director(rng)
  d.intensity = intensity
  const out = Array.from({ length: 24 }, blank)

  const rung = rungFor(intensity)
  let order = new Order(rung, makeTarget(rung, () => rng.next()))
  const printed = printedFor(rung)

  const air: Airborne[] = []
  const buf: number[] = []
  const market: Market = { live: 0, frontierLive: 0, frontier: buf, printed, residual: 0 }

  const live: number[] = []
  let atThirteen = 0
  let empty = 0
  let frames = 0
  let freeCuts = 0
  let decisions = 0
  let fills = 0
  let overshoots = 0
  let cutDebt = 0
  let cuts = 0
  let dry = 0
  let maxDry = 0
  let overCap = 0

  const refresh = (): void => {
    order.frontier(buf)
    market.residual = order.residual
  }
  refresh()

  const dt = 1 / 60
  for (let i = 0; i < seconds * 60; i++) {
    for (let k = air.length - 1; k >= 0; k--) {
      const a = air[k] as Airborne
      a.life -= dt
      a.arm -= dt
      if (a.life <= 0) air.splice(k, 1)
    }

    market.live = air.length
    market.frontierLive = air.filter(
      (a) => a.kind === "gourd" && !a.absurd && buf.includes(a.value),
    ).length
    const n = d.step(dt, out, market)
    for (let k = 0; k < n; k++) {
      const t = out[k] as Throw
      air.push({
        life: flight,
        arm: ARM_SECONDS,
        value: t.value,
        kind: t.kind,
        absurd: t.kind === "gourd" && t.glyph !== "",
      })
    }
    if (air.length > d.absoluteCap()) overCap++

    // R3, checked every frame: either something useful is up, or something
    // useful is queued.
    const available =
      market.frontierLive > 0 || d.nextFrontierEtaMs(market) < Number.POSITIVE_INFINITY
    if (available) dry = 0
    else {
      dry += dt
      maxDry = Math.max(maxDry, dry)
    }

    // The bot.
    cutDebt += cps * dt
    while (cutDebt >= 1 && air.length > 0) {
      cutDebt -= 1
      const reachable = air.filter((a) => a.arm <= 0)
      if (reachable.length === 0) break
      let pick: Airborne
      if (opts.reads) {
        // A reader takes a frontier value when one is within reach, and lets
        // everything else go past. That is the whole skill this game asks for.
        const found = reachable.find((a) => a.kind === "gourd" && !a.absurd && buf.includes(a.value))
        if (!found) break
        pick = found
      } else {
        pick = reachable[Math.floor(rng.next() * reachable.length)] as Airborne
      }
      cuts++
      const a = air.splice(air.indexOf(pick), 1)[0] as Airborne
      if (a.kind !== "gourd" || a.absurd) {
        freeCuts++
        continue
      }
      const k = order.take(a.value)
      if (k === "helpful") {
        decisions++
        if (order.filled) {
          fills++
          d.settleOrder()
          order = new Order(rung, makeTarget(rung, () => rng.next()))
        }
        refresh()
      } else if (k === "overshoot") {
        decisions++
        overshoots++
        order = new Order(rung, makeTarget(rung, () => rng.next()))
        refresh()
      } else {
        freeCuts++
      }
    }

    live.push(air.length)
    if (air.length === 0) empty++
    if (i === 13 * 60) atThirteen = air.length
    frames++
  }

  const sorted = [...live].sort((a, b) => a - b)
  const at = (q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] as number
  return {
    live,
    median: at(0.5),
    p90: at(0.9),
    p99: at(0.99),
    max: sorted[sorted.length - 1] as number,
    atThirteen,
    emptyFraction: empty / frames,
    freeCuts,
    decisions,
    fills,
    overshoots,
    cuts,
    fillsPerCut: fills / Math.max(1, cuts),
    ratio: freeCuts / Math.max(1, decisions),
    maxDrySeconds: maxDry,
    overCap,
  }
}

test("THE HEADLINE: the field a child faces, measured the way the design doc measured it", () => {
  // Two bots, because one of them alone is misleading. The MASHER is the design
  // document's model and the number the founder's complaint is about; the
  // OBSERVER never touches the screen and reports the raw density the market
  // produces, which is what a child sees in the moment before they swipe.
  const rows: Array<Record<string, string | number>> = []
  const results: RunResult[] = []
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    for (const [who, cps] of [
      ["masher 6/s", 6],
      ["observer 0/s", 0],
    ] as const) {
      const r = run({ intensity, seed: 12345, cutsPerSecond: cps })
      results.push(r)
      rows.push({
        intensity,
        who,
        median: r.median,
        p90: r.p90,
        p99: r.p99,
        max: r.max,
        "t=13s": r.atThirteen,
        "empty %": (r.emptyFraction * 100).toFixed(1),
      })
    }
  }
  rows.push({
    intensity: "SHIPPED 0.3.6",
    who: "masher 6/s",
    median: SHIPPED.median,
    p90: SHIPPED.p90,
    p99: SHIPPED.p99,
    max: SHIPPED.max,
    "t=13s": SHIPPED.atThirteen,
    "empty %": "0.0",
  })
  console.table(rows)

  for (const r of results) {
    assert.ok(r.max <= 13, `the absolute cap of 13 was breached: ${r.max} simultaneous objects`)
    assert.ok(r.p90 < SHIPPED.p90, `p90 ${r.p90} did not beat the shipped ${SHIPPED.p90}`)
    assert.ok(r.p99 < SHIPPED.p99, `p99 ${r.p99} did not beat the shipped ${SHIPPED.p99}`)
    assert.ok(
      r.median <= 9,
      `median ${r.median} is above the design table's live target of 9 at the very top`,
    )
    assert.equal(r.overCap, 0, `the field was over its own absolute cap on ${r.overCap} frames`)
  }
  // The calm end, on the observer, is Fruit Ninja's opening and not a swarm.
  const calm = results[1] as RunResult
  assert.ok(calm.p90 <= 4, `the calm end offers a p90 of ${calm.p90} objects`)
  assert.ok(calm.median <= 3, `the calm end's median is ${calm.median}`)
})

test("THE OPENING IS TWO OR THREE THINGS, not sixteen", () => {
  // The founder, twice: "fruit ninja might have 2 or 3 things pop up to start",
  // and "the first time you open it it still has 1 billion things to slice".
  //
  // A fresh run starts at the flow controller's floor, so this is measured there
  // and not in the middle of the range.
  const first = run({ intensity: 0.04, seconds: 20, cutsPerSecond: 0 })
  const opening = first.live.slice(0, 15 * 60)
  const peak = Math.max(...opening)
  const mean = opening.reduce((a, b) => a + b, 0) / opening.length
  console.log(
    `first fifteen seconds: peak ${peak}, mean ${mean.toFixed(2)}, at t=13s ${first.live[13 * 60]}` +
      ` — the build the founder played had ${SHIPPED.atThirteen} at t=13s`,
  )
  assert.ok(peak <= 4, `the opening peaked at ${peak} simultaneous objects`)
  assert.ok(mean <= 3, `the opening averaged ${mean.toFixed(2)} objects`)
})

test("AN EMPTY SCREEN IS ALLOWED, and at the calm end it happens", () => {
  // This deliberately reverses the old file's "density contract". Emptiness
  // between waves is anticipation, and it is thinking time. It is also the
  // direct cause of the complaint when it is forbidden.
  const calm = run({ intensity: 0, cutsPerSecond: 0, seconds: 60 })
  assert.ok(
    calm.emptyFraction > 0.02,
    `the field was empty on only ${(calm.emptyFraction * 100).toFixed(1)}% of frames — the floor is back`,
  )
})

test("R3 THE OFFER INVARIANT: a useful numeral is never more than offerGap away", () => {
  // The whole reason there is no clock on any arithmetic in this game. A child
  // who needs forty seconds watches the market go by and the number they need is
  // in it, again and again. A bot that never cuts is the harshest case: nothing
  // is ever consumed, so the market has to keep re-offering on its own.
  const rows: Array<Record<string, string | number>> = []
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    for (const seed of [1, 7, 99, 2024]) {
      const r = run({ intensity, seed, cutsPerSecond: 0, seconds: 120 })
      const d = new Director(new Rng(seed))
      d.intensity = intensity
      const bound = d.offerGap() + 1 / 30
      if (seed === 1) {
        rows.push({
          intensity,
          "offerGap (s)": d.offerGap().toFixed(2),
          "worst dry spell (s)": r.maxDrySeconds.toFixed(2),
        })
      }
      assert.ok(
        r.maxDrySeconds <= bound,
        `intensity ${intensity} seed ${seed}: the child had nothing useful for ` +
          `${r.maxDrySeconds.toFixed(2)}s against a bound of ${bound.toFixed(2)}s`,
      )
    }
  }
  console.table(rows)
})

test("R3 holds when the child is cutting everything as fast as they can", () => {
  for (const intensity of [0, 0.3, 0.6, 1]) {
    for (const seed of [4242, 77, 3]) {
      const r = run({ intensity, cutsPerSecond: 8, seconds: 180, seed })
      const d = new Director(new Rng(1))
      d.intensity = intensity
      assert.ok(
        r.maxDrySeconds <= d.offerGap() + 1 / 30,
        `intensity ${intensity} seed ${seed}: a masher went ${r.maxDrySeconds.toFixed(2)}s ` +
          `with nothing useful available`,
      )
    }
  }
})

test("MASHING IS WORTHLESS, NOT PUNISHED", () => {
  // The distinction is the whole product. A masher is never scolded, never
  // loses a lamp and never has a point taken off them. They simply do not get
  // anywhere, because **an overshoot rotates the order** — their next
  // indiscriminate slice destroys the order they were accumulating.
  //
  // Both bots are given the SAME six cuts a second, so this is not a comparison
  // between a fast player and a slow one. The reader spends its budget only when
  // something useful is within reach and lets everything else go past.
  const rows: Array<Record<string, string | number>> = []
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    const masher = run({ intensity, cutsPerSecond: 6, reads: false, seed: 8080 })
    const reader = run({ intensity, cutsPerSecond: 6, reads: true, seed: 8080 })
    rows.push({
      intensity,
      "masher cuts": masher.cuts,
      "masher orders": masher.fills,
      "masher wrecked": masher.overshoots,
      "reader cuts": reader.cuts,
      "reader orders": reader.fills,
      "orders ÷": (reader.fills / Math.max(1, masher.fills)).toFixed(1),
      "fills/cut ÷": (reader.fillsPerCut / Math.max(1e-9, masher.fillsPerCut)).toFixed(1),
    })
    assert.ok(
      reader.fills > masher.fills,
      `intensity ${intensity}: a reader filled ${reader.fills} orders against a masher's ` +
        `${masher.fills} at the same cut rate — mashing is still viable`,
    )
    // The anti-mash lock, stated directly: a masher destroys more orders than
    // they finish. It costs them nothing; it just never gets them anywhere.
    //
    // **Exempt at the very floor, on purpose.** Rung 0 is `□ = 4` with a pool of
    // {1, 2, 3}, and there is nothing there to be wrong about — a child at the
    // bottom of the ladder should be able to blunder into a filled order. The
    // lock is a property of the ladder, not of its first step.
    if (intensity > 0.05) {
      assert.ok(
        masher.overshoots > masher.fills,
        `intensity ${intensity}: a masher wrecked ${masher.overshoots} orders and completed ` +
          `${masher.fills} — the anti-mash lock is not holding`,
      )
    }
    assert.ok(
      reader.fillsPerCut > masher.fillsPerCut * (intensity > 0.05 ? 2 : 1),
      `intensity ${intensity}: a reader gets ${reader.fillsPerCut.toFixed(3)} orders per cut ` +
        `against a masher's ${masher.fillsPerCut.toFixed(3)} — swiping more still pays`,
    )
    assert.equal(
      reader.overshoots,
      0,
      "a reader who only takes frontier values overshot, which is impossible",
    )
  }
  console.table(rows)
})

test("FREE CUTS PER ARITHMETIC DECISION: the 27:1 ratio is gone", () => {
  const rows: Array<Record<string, string | number>> = []
  let worst = 0
  for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    const r = run({ intensity, cutsPerSecond: 6, seed: 5150 })
    worst = Math.max(worst, r.ratio)
    rows.push({ intensity, "free cuts": r.freeCuts, decisions: r.decisions, ratio: r.ratio.toFixed(2) })
  }
  rows.push({
    intensity: "SHIPPED 0.3.6",
    "free cuts": "—",
    decisions: "—",
    ratio: SHIPPED.freeCutsPerDecision.toFixed(2),
  })
  console.table(rows)
  assert.ok(
    worst < SHIPPED.freeCutsPerDecision / 10,
    `the worst ratio is ${worst.toFixed(2)} free cuts per decision, against a shipped ` +
      `${SHIPPED.freeCutsPerDecision}`,
  )
})

// ── the escalation ──────────────────────────────────────────────────────────

test("NOTHING IN THE DIRECTOR IS A FUNCTION OF ELAPSED TIME", () => {
  // Pacing-audit root cause 3, and this game was one of the seventeen. Twenty
  // minutes at a fixed intensity must produce exactly the same knobs as second
  // one at the same intensity.
  const d = new Director(new Rng(5))
  d.intensity = 0.4
  const out = Array.from({ length: 24 }, blank)
  const m: Market = { live: 6, frontierLive: 2, frontier: [3, 4], printed: [3, 4, 9], residual: 7 }
  const snap = (): Record<string, number> => ({
    target: d.targetCount(),
    cap: d.hardCap(),
    gap: d.waveInterval(),
    offer: d.offerGap(),
    bomb: d.bombChance(),
    absurd: d.absurdChance(),
    difficulty: d.questionDifficulty(),
  })
  const before = snap()
  for (let i = 0; i < 60 * 60 * 20; i++) d.step(1 / 60, out, m)
  assert.ok(d.elapsed > 1190, "the director's clock did not advance, so this proved nothing")
  assert.deepEqual(
    snap(),
    before,
    "twenty minutes changed a knob without any evidence about the child",
  )
})

test("every knob moves with intensity, in the direction the design table states", () => {
  const rows: Array<Record<string, string | number>> = []
  const knobs = [0, 0.25, 0.5, 0.75, 1].map((i) => {
    const d = new Director(new Rng(3))
    d.intensity = i
    rows.push({
      i,
      "live target": d.targetCount(),
      "hard cap": d.hardCap(),
      "wave gap (s)": d.waveInterval().toFixed(2),
      "offer gap (s)": d.offerGap().toFixed(2),
      "bomb P/object": d.bombChance().toFixed(3),
      "absurd P": d.absurdChance().toFixed(2),
      difficulty: d.questionDifficulty(),
    })
    return d
  })
  console.table(rows)
  for (let i = 1; i < knobs.length; i++) {
    const lo = knobs[i - 1] as Director
    const hi = knobs[i] as Director
    assert.ok(hi.targetCount() >= lo.targetCount(), "the target count fell as the world pushed harder")
    assert.ok(hi.hardCap() >= lo.hardCap(), "the cap fell")
    assert.ok(hi.waveInterval() <= lo.waveInterval(), "waves got further apart")
    assert.ok(hi.offerGap() >= lo.offerGap(), "the offer gap did not widen")
    assert.ok(hi.bombChance() >= lo.bombChance(), "bombs got rarer")
    assert.ok(hi.questionDifficulty() >= lo.questionDifficulty(), "the maths got easier")
  }
  const calm = knobs[0] as Director
  assert.equal(calm.bombChance(), 0, "a child at the floor met a bomb")
  assert.equal(calm.absurdChance(), 0, "a child at the floor met an absurd glyph")
  const top = knobs[knobs.length - 1] as Director
  assert.equal(top.hardCap(), 12, "the scheduled cap at the top of the range moved")
  assert.equal(top.absoluteCap(), 13, "the largest field a child can ever face is not the design's 13")
})

test("nothing at all is launched while the child is being held", () => {
  const d = new Director(new Rng(21))
  d.intensity = 1
  const out = Array.from({ length: 24 }, blank)
  const m: Market = { live: 0, frontierLive: 0, frontier: [2, 3], printed: [2, 3, 9], residual: 5 }
  for (let i = 0; i < 60 * 60; i++) d.step(1 / 60, out, m)

  d.quiet = true
  let launched = 0
  const dryBefore = d.dryFor
  for (let i = 0; i < 60 * 45; i++) launched += d.step(1 / 60, out, m)
  assert.equal(launched, 0, `${launched} objects were thrown at a child reading a completed sum`)
  assert.equal(
    d.dryFor,
    dryBefore,
    "the offer invariant's clock ran during a hold — a hold is the child's own time",
  )
})

test("A MARKET RUSH IS NOT A FREE-FOR-ALL: bombs still spawn in one", () => {
  // The build the founder played returned a hard zero for `bombChance()` for the
  // whole rush, so the highest-scoring phase in the game was the one in which
  // indiscriminate swiping could not be punished, and the banner read "cut
  // everything".
  const d = new Director(new Rng(4))
  d.intensity = 0.9
  const out = Array.from({ length: 24 }, blank)
  const m: Market = { live: 2, frontierLive: 1, frontier: [4], printed: [4, 9, 99], residual: 20 }
  let rushFrames = 0
  let rushBombs = 0
  for (let i = 0; i < 60 * 900; i++) {
    const n = d.step(1 / 60, out, m)
    const inRush = d.rushLeft > 0
    if (inRush) rushFrames++
    for (let k = 0; k < n; k++) if (inRush && (out[k] as Throw).kind === "bomb") rushBombs++
  }
  assert.ok(rushFrames > 60 * 60, `only ${(rushFrames / 60).toFixed(0)}s of rush in fifteen minutes`)
  assert.ok(rushBombs > 0, "a rush is still a phase in which mashing cannot be punished")
  assert.equal(d.sieveOn, d.rushLeft > 0, "the sieve and the rush are not the same phase")
})

test("a rush never opens for a child who is finding it hard", () => {
  const d = new Director(new Rng(4))
  d.intensity = 0.1
  const out = Array.from({ length: 24 }, blank)
  const m: Market = { live: 2, frontierLive: 1, frontier: [2], printed: [2, 3], residual: 5 }
  for (let i = 0; i < 60 * 900; i++) d.step(1 / 60, out, m)
  assert.equal(d.rushCount, 0, "a struggling child was handed a market rush")
})

test("every gourd the director throws is a printed value or an absurd glyph", () => {
  const d = new Director(new Rng(11))
  d.intensity = 0.7
  const out = Array.from({ length: 24 }, blank)
  const printed = printedFor(3)
  const m: Market = { live: 3, frontierLive: 1, frontier: [10, 20], printed, residual: 120 }
  let gourds = 0
  let absurds = 0
  for (let i = 0; i < 60 * 600; i++) {
    const n = d.step(1 / 60, out, m)
    for (let k = 0; k < n; k++) {
      const t = out[k] as Throw
      if (t.kind !== "gourd") continue
      if (t.glyph !== "") {
        absurds++
        assert.equal(t.value, 0, "an absurd gourd also carries a number")
        continue
      }
      gourds++
      assert.ok(printed.includes(t.value), `the director printed ${t.value}, not in the rung's set`)
    }
  }
  assert.ok(gourds > 500, `only ${gourds} gourds in ten minutes`)
  assert.ok(absurds > 20, `only ${absurds} absurd glyphs in ten minutes`)
})

test("a reset really resets, so a restart is not the last run with the numbers rubbed off", () => {
  const d = new Director(new Rng(9))
  d.intensity = 0.8
  const out = Array.from({ length: 24 }, blank)
  const m: Market = { live: 1, frontierLive: 0, frontier: [3], printed: [3, 9], residual: 6 }
  for (let i = 0; i < 60 * 300; i++) d.step(1 / 60, out, m)
  assert.ok(d.elapsed > 200)
  d.reset()
  assert.equal(d.elapsed, 0)
  assert.equal(d.rushCount, 0)
  assert.equal(d.rushLeft, 0)
  assert.equal(d.dryFor, 0)
  assert.equal(d.intensity, 0)
  assert.equal(d.quiet, false)
})
