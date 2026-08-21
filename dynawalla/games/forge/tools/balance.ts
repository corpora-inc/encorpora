// Balance harness. Simulates a real session against the REAL economy — same
// `step`, same costs, same multipliers — and prints the curve.
//
//   node --experimental-strip-types tools/balance.ts [minutes] [secPerAnswer] [buysPerSec]
//
// The question it exists to answer is not "does it work" but "is minute
// nineteen still interesting". An idle game that plateaus at four minutes is a
// four-minute game — and one whose exponent climbs ten orders of magnitude a
// minute is not a game either, because nothing that happens means anything.
//
// The target is roughly ONE order of magnitude per 45-90 seconds through the
// middle, which puts a milestone punch about a minute apart, a FORGE MARK on
// the same cadence, and the first QUENCH somewhere past ten minutes.

import { MICRO, readout, superscript } from "../src/core/bigmath.ts"
import {
  TIERS,
  addHeat,
  addSparks,
  buy,
  canQuench,
  carbonFor,
  isRevealed,
  newEconomy,
  quench,
  sparksPerSecond,
  step,
  tierCount,
} from "../src/core/economy.ts"
import { makeRng } from "../src/core/rng.ts"
import { applyOffer, makeMarkRound } from "../src/game/marks.ts"
import { generate, payoutFor } from "../src/stub/questions.ts"

const minutes = Number(process.argv[2] ?? 20)
const perAnswer = Number(process.argv[3] ?? 3)
const buysPerSec = Number(process.argv[4] ?? 0.7)

const e = newEconomy()
const rng = makeRng(20260726)
let level = 0.05
let combo = 0
let markOom = 3
let marksTaken = 0
let quenches = 0
const events: string[] = []

function show(m: bigint): string {
  const r = readout(m)
  return r.plain ? r.mantissa : `${r.mantissa}x10${superscript(r.exponent)}`
}
function stamp(tick: number): string {
  const t = tick / 60
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`
}

/** A competent ten-year-old: usually right, faster as it gets familiar. */
function strike(): void {
  const q = generate(rng, level)
  if (!rng.chance(88, 100)) {
    combo = 0
    e.heat -= e.heat / 4n
    level = Math.max(0, level - 0.07)
    return
  }
  combo++
  level = Math.min(1, level + 0.03)
  const payout = payoutFor(q.answer)
  addHeat(e, payout, combo)
  const sps = sparksPerSecond(e)
  addSparks(e, ((BigInt(payout) * MICRO + sps) * (2n + BigInt(Math.min(combo, 10)))) / 2n)
}

/** Greedy: buy the deepest station affordable, and crack seals on sight. */
function spend(tick: number): void {
  for (let t = TIERS.length - 1; t >= 0; t--) {
    const tier = e.tiers[t]
    if (!isRevealed(e, t)) continue
    if (!tier.unlocked) {
      if (e.sparks >= tier.cost * MICRO && (t === 0 || e.tiers[t - 1].unlocked)) {
        e.sparks -= tier.cost * MICRO
        tier.unlocked = true
        tier.purchased = 1n
        tier.powNum = TIERS[t].growthNum
        tier.powDen = TIERS[t].growthDen
        tier.cost = (TIERS[t].baseCost * tier.powNum) / tier.powDen
        events.push(`${stamp(tick)}  seal cracked: ${TIERS[t].name}`)
        return
      }
      continue
    }
    if (e.sparks >= tier.cost * MICRO) {
      buy(e, t, 1)
      return
    }
  }
}

const rows: string[] = []
let lastOom = -1
let lastOomTick = 0
const oomGaps: number[] = []
const totalTicks = minutes * 60 * 60
let sinceAnswer = 0
let sinceBuy = 0
const buyEvery = Math.round(60 / buysPerSec)

for (let tick = 0; tick < totalTicks; tick++) {
  step(e, 60n)
  if (++sinceAnswer >= perAnswer * 60) {
    sinceAnswer = 0
    strike()
  }
  if (++sinceBuy >= buyEvery) {
    sinceBuy = 0
    spend(tick)
  }

  const u = e.lifetime / MICRO
  const oom = u > 0n ? u.toString().length - 1 : -1
  if (oom > lastOom) {
    if (lastOom >= 2) oomGaps.push((tick - lastOomTick) / 60)
    lastOom = oom
    lastOomTick = tick
    if (oom >= 4 && oom > markOom) {
      markOom = oom
      const m = makeMarkRound(e, rng)
      applyOffer(e, m.offers[m.better])
      e.marks += 1n
      marksTaken++
    }
  }
  // Quench checks are throttled: `carbonFor` is an isqrt of a very large
  // integer and the live game must never run one per frame.
  if (tick % 30 === 0 && canQuench(e) && carbonFor(e.lifetime) - e.carbon >= 6n) {
    events.push(`${stamp(tick)}  QUENCH  +${carbonFor(e.lifetime) - e.carbon} carbon`)
    quench(e)
    quenches++
    combo = 0
  }

  if (tick % (60 * 60) === 0) {
    rows.push(
      [
        `${String(tick / 3600).padStart(3)}m`,
        `sparks ${show(e.sparks).padEnd(13)}`,
        `rate ${show(sparksPerSecond(e)).padEnd(13)}/s`,
        `heat ${(e.heat / MICRO).toString().padStart(5)}`,
        `stations ${e.tiers.map((t) => tierCount(t) / MICRO).join("/")}`,
        `C${e.carbon} M${e.marks}`,
      ].join("  "),
    )
  }
}

console.log(rows.join("\n"))
console.log("\n" + events.join("\n"))
const mid = oomGaps.slice(Math.floor(oomGaps.length / 3))
const avg = mid.length ? mid.reduce((a, b) => a + b, 0) / mid.length : 0
console.log(
  `\nafter ${minutes}m: lifetime ${show(e.lifetime)} · all-time ${show(e.allTime)} · ` +
    `${marksTaken} marks · ${quenches} quenches · carbon ${e.carbon}\n` +
    `orders of magnitude crossed: ${oomGaps.length}; mean gap (last 2/3): ${avg.toFixed(1)}s`,
)
