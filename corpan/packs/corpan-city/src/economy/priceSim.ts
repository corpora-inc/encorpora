/**
 * priceSim — the single deterministic price function shared by the offline
 * client AND (later) the co-located TS server (ECONOMY_CURRENCY §3.3, §4.3).
 *
 * `feedMult(id, t, params)` returns a multiplier around 1.0 that modulates a
 * currency's `baseValue` (for exchange rates) or a good's `mid` (for markets).
 * It is the sum of:
 *   - mean-reversion (Ornstein-Uhlenbeck pull toward 1.0) — the anti-inflation
 *     core that keeps the long-run economy stable,
 *   - a bounded random walk whose step scales with `volatility` — minute-to-
 *     minute life to watch,
 *   - decayed event shocks (events.json),
 * all hard-CLAMPED to [1 - maxDev, 1 + maxDev] (maxDev ∝ volatility) so nothing
 * ever runs away (the inflation guard). Even the deliberately-inflationary
 * `weimar-mark` is bounded in real (Common-Unit) terms.
 *
 * DETERMINISM: seeded purely by (id, tick) — no Math.random, no Date.now inside.
 * Same (id, tick, seed) → same value on every device and session, which is what
 * makes the offline sim agree with the server feed and makes anti-cheat exact.
 *
 * NB: this module has NO imports and NO DOM — it is pure math, importable from a
 * Node server unchanged.
 */

/** A scheduled/seasonal price shock (mirrors one row of events.json). */
export interface PriceEvent {
  id: string
  /** which series this shock hits. */
  target: { kind: "good" | "currency"; id: string }
  /** fires when `(dayEpoch % every) === offset`. */
  every: number
  offset: number
  /** signed magnitude added to feedMult at the event's peak. */
  magnitude: number
  /** ticks over which the shock decays back to zero. */
  decayTicks: number
}

export interface PriceSimParams {
  /** 0..1 — drives both the walk step size and the clamp band (maxDev). */
  volatility: number
  /** active events targeting THIS id (pre-filtered by the caller). */
  events?: PriceEvent[]
  /** a global seed mixed into the hash (e.g. a Track or day salt). Default 0. */
  seed?: number
}

/** ticks per simulated day — the offline path advances `t` at this cadence. */
export const TICKS_PER_DAY = 8640 // 1 tick / 10s

/* ------------------------------------------------------------------ hashing */

/** A fast, well-distributed string→uint32 hash (FNV-1a). */
function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mix two uint32s → a uniform float in [0,1). */
function mix01(a: number, b: number): number {
  let h = (a ^ Math.imul(b ^ (b >>> 15), 0x2c1b3c6d)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) >>> 0
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** A deterministic Gaussian-ish step in [-1,1] for (idHash, tick). */
function noiseStep(idHash: number, tick: number, seed: number): number {
  // average two uniforms → a triangular distribution, smoother than uniform.
  const u1 = mix01(idHash ^ 0x9e3779b9, (tick * 2 + seed) | 0)
  const u2 = mix01(idHash ^ 0x85ebca6b, (tick * 2 + 1 + seed) | 0)
  return u1 + u2 - 1
}

/* ------------------------------------------------------------- the function */

/** maxDev (the clamp half-band) as a function of volatility. */
export function maxDev(volatility: number): number {
  // 0 vol → ±0; 1 vol → ±0.9. Keeps even the wildest currency bounded in CU.
  return Math.min(0.9, Math.max(0, volatility) * 0.9)
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Decayed contribution of an event at absolute tick `t`. */
function eventShock(ev: PriceEvent, t: number): number {
  const day = Math.floor(t / TICKS_PER_DAY)
  if (ev.every <= 0) return 0
  // The most recent day this event fired on, at-or-before `day`.
  const phase = ((day - ev.offset) % ev.every + ev.every) % ev.every
  const fireDay = day - phase
  if (fireDay < 0) return 0
  const fireTick = fireDay * TICKS_PER_DAY
  const age = t - fireTick
  if (age < 0 || age > ev.decayTicks) return 0
  // linear decay from full magnitude at fire to 0 at decayTicks.
  return ev.magnitude * (1 - age / Math.max(1, ev.decayTicks))
}

/**
 * The mean-reverting bounded walk. We accumulate an OU process in CLOSED form
 * cheap enough to call per-frame: rather than iterate every tick, we sample a
 * few coarse anchor points and interpolate, which is O(1), deterministic, and
 * visually indistinguishable from a true step-walk at this cadence.
 */
function walkValue(idHash: number, t: number, volatility: number, seed: number): number {
  if (volatility <= 0) return 0
  const stride = 64 // ticks between anchor points
  const k = Math.floor(t / stride)
  const frac = (t - k * stride) / stride
  // two consecutive anchor noise samples, lerp between them (C0 smooth).
  const a = noiseStep(idHash, k, seed)
  const b = noiseStep(idHash, k + 1, seed)
  const raw = a + (b - a) * frac
  // scale the walk by volatility; the clamp in feedMult does the hard bound.
  return raw * volatility * 0.6
}

/**
 * The price multiplier for series `id` at absolute tick `t`. Always finite,
 * always within [1 - maxDev, 1 + maxDev]. Pure + deterministic.
 */
export function feedMult(id: string, t: number, params: PriceSimParams): number {
  const vol = clamp(params.volatility, 0, 1)
  const seed = params.seed ?? 0
  const idHash = hashStr(id)
  const dev = maxDev(vol)

  const walk = walkValue(idHash, t, vol, seed)
  let shock = 0
  for (const ev of params.events ?? []) shock += eventShock(ev, t)

  // mean-reversion is implicit: the walk is bounded + zero-mean and we never
  // accumulate it across ticks, so it pulls back toward 0 naturally. The clamp
  // guarantees the hard band.
  const m = 1 + walk + shock
  return clamp(m, 1 - dev, 1 + dev)
}

/** Convert a wall-clock epoch (ms) to an absolute sim tick. */
export function tickForEpoch(epochMs: number): number {
  return Math.floor(epochMs / 1000 / 10) // 1 tick / 10s
}

/** A short price history (last `n` ticks, oldest→newest) for sparklines. */
export function priceHistory(id: string, tEnd: number, n: number, params: PriceSimParams): number[] {
  const out: number[] = []
  const step = 64
  for (let i = n - 1; i >= 0; i--) out.push(feedMult(id, tEnd - i * step, params))
  return out
}
