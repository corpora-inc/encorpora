// The economy. Six stations, each one feeding the station below it.
//
//   REACTOR -> FOUNDRY -> ANVIL -> HAMMER -> CRUCIBLE -> BELLOWS -> SPARKS
//
// Buying a REACTOR does not make sparks. It makes the thing that makes the
// thing that makes the thing that makes sparks — so its effect on the spark
// counter is a fifth-order one, and the curve you watch is visibly steeper than
// the one you watched a minute ago. That is a derivative chain a ten-year-old
// can feel in their thumbs, and it is the reason this genre works.
//
// Everything here is BigInt. Not one float. See `bigmath.ts`.

import { MICRO, type Micro, isqrt } from "./bigmath.ts"

export type TierDef = {
  readonly id: number
  readonly name: string
  /** What one unit of this station makes, for the arrow label. */
  readonly makes: string
  readonly baseCost: bigint // whole sparks
  readonly rate: Micro // micro-units produced per second per unit, before multipliers
  readonly growthNum: bigint
  readonly growthDen: bigint
  /** Lifetime sparks at which the row appears at all. */
  readonly revealAt: bigint
  /** Stations 3..6 are chained shut until a seal is cracked. */
  readonly sealed: boolean
}

export const TIERS: readonly TierDef[] = [
  {
    id: 0,
    name: "BELLOWS",
    makes: "SPARKS",
    baseCost: 12n,
    rate: 1_000_000n,
    growthNum: 23n,
    growthDen: 20n,
    revealAt: 0n,
    sealed: false,
  },
  {
    id: 1,
    name: "CRUCIBLE",
    makes: "BELLOWS",
    baseCost: 250n,
    rate: 100_000n,
    growthNum: 6n,
    growthDen: 5n,
    revealAt: 400n,
    sealed: false,
  },
  {
    id: 2,
    name: "HAMMER",
    makes: "CRUCIBLES",
    baseCost: 30_000n,
    rate: 70_000n,
    growthNum: 63n,
    growthDen: 50n,
    revealAt: 12_000n,
    sealed: true,
  },
  {
    id: 3,
    name: "ANVIL",
    makes: "HAMMERS",
    baseCost: 2_000_000n,
    rate: 50_000n,
    growthNum: 33n,
    growthDen: 25n,
    revealAt: 800_000n,
    sealed: true,
  },
  {
    id: 4,
    name: "FOUNDRY",
    makes: "ANVILS",
    baseCost: 300_000_000n,
    rate: 40_000n,
    growthNum: 7n,
    growthDen: 5n,
    revealAt: 100_000_000n,
    sealed: true,
  },
  {
    id: 5,
    name: "REACTOR",
    makes: "FOUNDRIES",
    baseCost: 50_000_000_000n,
    rate: 30_000n,
    growthNum: 3n,
    growthDen: 2n,
    revealAt: 20_000_000_000n,
    sealed: true,
  },
]

/** Purchases per output doubling. The 7/10 ring on every row is this number. */
export const DOUBLE_EVERY = 10n

export type Tier = {
  purchased: bigint
  /** Units produced by the station above, in micro. */
  stock: Micro
  /** Extra doublings won from FORGE MARKs, on top of purchased/10. */
  bonusDoublings: bigint
  unlocked: boolean
  /** Cached cost of the next purchase, in whole sparks. Exact. */
  cost: bigint
  powNum: bigint
  powDen: bigint
  /** Production carry, so a slow station never rounds itself to a standstill. */
  carry: Micro
}

export type Economy = {
  sparks: Micro
  /** Sparks earned this run. Drives reveals and the quench formula. */
  lifetime: Micro
  /** Sparks earned across every run. Never resets. */
  allTime: Micro
  tiers: Tier[]
  /** Whole heat units, in micro. See `heatBonus`. */
  heat: Micro
  carbon: bigint
  marks: bigint
  quenches: bigint
  sparkCarry: Micro
}

function makeTier(def: TierDef): Tier {
  return {
    purchased: 0n,
    stock: 0n,
    bonusDoublings: 0n,
    unlocked: !def.sealed,
    cost: def.baseCost,
    powNum: 1n,
    powDen: 1n,
    carry: 0n,
  }
}

export function newEconomy(): Economy {
  return {
    sparks: 0n,
    lifetime: 0n,
    allTime: 0n,
    tiers: TIERS.map(makeTier),
    heat: 0n,
    carbon: 0n,
    marks: 0n,
    quenches: 0n,
    sparkCarry: 0n,
  }
}

/** Whole units of a station, purchased plus produced. */
export function tierCount(t: Tier): Micro {
  return t.purchased * MICRO + t.stock
}

export function doublings(t: Tier): bigint {
  return t.purchased / DOUBLE_EVERY + t.bonusDoublings
}

/** How many more purchases until this station's output doubles. */
export function toNextDouble(t: Tier): bigint {
  return DOUBLE_EVERY - (t.purchased % DOUBLE_EVERY)
}

/**
 * The global multiplier, as an exact rational.
 *   heat   — (100 + 10*sqrt(heat))/100, earned at the anvil, bleeds when you stop
 *   marks  — (20 + marks)/20,  +5% each, earned by picking the better offer
 *   carbon — (100 + 20*c)/100, the quench payout, permanent
 */
export function heatBonus(e: Economy): bigint {
  // sqrt, not linear: 100 heat is x2.00, 2500 heat is x6.00, 10000 is x11.00.
  // A linear bonus lets a fast player's multiplier run away from the economy
  // inside a minute; a square root keeps twenty minutes of striking worth
  // doing. It is also the second radical in this game, and children who play
  // it long enough do notice that quadrupling the heat only doubles the bonus.
  return isqrt((e.heat / MICRO) * 100n)
}

export function globalMul(e: Economy): { num: bigint; den: bigint } {
  return {
    num: (100n + heatBonus(e)) * (20n + e.marks) * (100n + 20n * e.carbon),
    den: 100n * 20n * 100n,
  }
}

/** Micro-units of the tier below, produced per second by station `i`. */
export function tierOutputPerSecond(e: Economy, i: number): Micro {
  const t = e.tiers[i]
  const def = TIERS[i]
  if (!t.unlocked) return 0n
  const g = globalMul(e)
  const count = tierCount(t)
  const dbl = doublings(t)
  // Multiply everything, divide once — truncation happens at the very end.
  return (count * def.rate * (1n << dbl) * g.num) / (MICRO * g.den)
}

export function sparksPerSecond(e: Economy): Micro {
  return tierOutputPerSecond(e, 0)
}

/**
 * Advance the simulation by exactly 1/tps seconds.
 *
 * `tps` is a parameter rather than a constant because the offline catch-up runs
 * the identical code at 1 Hz — same arithmetic, same result shape, no second
 * "offline formula" that can disagree with the live one.
 */
export function step(e: Economy, tps: bigint): void {
  // Snapshot outputs before anything moves, so a tick is simultaneous rather
  // than a cascade that pays the whole chain in one frame.
  const out: Micro[] = []
  for (let i = 0; i < e.tiers.length; i++) out.push(tierOutputPerSecond(e, i))

  for (let i = e.tiers.length - 1; i >= 1; i--) {
    const t = e.tiers[i]
    const total = out[i] + t.carry
    const gained = total / tps
    t.carry = total % tps
    e.tiers[i - 1].stock += gained
  }

  const totalSparks = out[0] + e.sparkCarry
  const gainedSparks = totalSparks / tps
  e.sparkCarry = totalSparks % tps
  e.sparks += gainedSparks
  e.lifetime += gainedSparks
  e.allTime += gainedSparks

  // Heat bleeds at 1/16 per second, with a floor so it always reaches zero.
  if (e.heat > 0n) {
    const drop = e.heat / (16n * tps)
    e.heat -= drop > 0n ? drop : 1n
    if (e.heat < 0n) e.heat = 0n
  }
}

export function addSparks(e: Economy, amount: Micro): void {
  e.sparks += amount
  e.lifetime += amount
  e.allTime += amount
}

export function recomputeCost(def: TierDef, t: Tier): void {
  t.cost = (def.baseCost * t.powNum) / t.powDen
  if (t.cost < 1n) t.cost = 1n
}

export function canBuy(e: Economy, i: number): boolean {
  const t = e.tiers[i]
  return t.unlocked && e.sparks >= t.cost * MICRO
}

/** Buy up to `n` of station `i`. Returns how many were actually bought. */
export function buy(e: Economy, i: number, n: number): number {
  const t = e.tiers[i]
  const def = TIERS[i]
  if (!t.unlocked) return 0
  let bought = 0
  for (let k = 0; k < n; k++) {
    const price = t.cost * MICRO
    if (e.sparks < price) break
    e.sparks -= price
    t.purchased += 1n
    t.powNum *= def.growthNum
    t.powDen *= def.growthDen
    recomputeCost(def, t)
    bought++
  }
  return bought
}

/** Total cost of the next `n` purchases without spending anything. */
export function peekCost(e: Economy, i: number, n: number): bigint {
  const t = e.tiers[i]
  const def = TIERS[i]
  let num = t.powNum
  let den = t.powDen
  let total = 0n
  for (let k = 0; k < n; k++) {
    let c = (def.baseCost * num) / den
    if (c < 1n) c = 1n
    total += c
    num *= def.growthNum
    den *= def.growthDen
  }
  return total
}

export function isRevealed(e: Economy, i: number): boolean {
  return e.lifetime / MICRO >= TIERS[i].revealAt || e.tiers[i].purchased > 0n
}

/** Heat is gained at the anvil: the answer itself, times the combo. */
export function addHeat(e: Economy, answerValue: number, combo: number): Micro {
  const c = BigInt(Math.min(combo, 10))
  const gain = (BigInt(Math.max(1, answerValue)) * MICRO * (2n + c)) / 2n
  e.heat += gain
  return gain
}

/** A shattered billet costs a quarter of the heat you were sitting on. */
export function loseHeat(e: Economy): Micro {
  const loss = e.heat / 4n
  e.heat -= loss
  return loss
}

// --- Quench (prestige) ------------------------------------------------------

/** Lifetime sparks needed before the quench plate lights up. */
export const QUENCH_FLOOR = 1_000_000_000_000n // 10^12

/** carbon = floor( sqrt( lifetime / 10^12 ) ). Shown to the player as a radical. */
export function carbonFor(lifetime: Micro): bigint {
  const u = lifetime / MICRO
  if (u < QUENCH_FLOOR) return 0n
  return isqrt(u / QUENCH_FLOOR)
}

export function canQuench(e: Economy): boolean {
  return carbonFor(e.lifetime) > e.carbon
}

export function quench(e: Economy): bigint {
  const gained = carbonFor(e.lifetime)
  const delta = gained > e.carbon ? gained - e.carbon : 0n
  e.carbon = gained > e.carbon ? gained : e.carbon
  e.quenches += 1n
  e.sparks = 0n
  e.lifetime = 0n
  e.heat = 0n
  e.sparkCarry = 0n
  e.tiers = TIERS.map(makeTier)
  return delta
}
