/**
 * The idle half: production rates, the offline haul, and what things cost.
 *
 * An idle game lives or dies on whether the curve keeps *feeling* like it is
 * accelerating. The rule used here: every purchase costs about one order of
 * magnitude more than the last, and every vent tier produces about 1.85x more,
 * so the essence counter crosses a power of ten every 60-100 seconds of
 * engaged play — forever. Crossing one is the game's biggest celebration, so
 * the escalation and the fireworks are the same clock.
 *
 * Pure. No time source, no randomness, no rendering. `now` is always passed in.
 */

import { SEEDS, type Strain } from './ladder.ts'

/* ------------------------------------------------------------- production */

/** Essence per second from one vent at `tier`. Tier 1 = 1/s, tier 12 = ~1.4k/s. */
export function ventRate(tier: number): number {
  const t = Math.max(1, tier)
  return Math.round(1.85 ** (t - 1) * 10) / 10
}

/** How often a vent coughs a polyp out on its own, in ms. Floors at 1.5 s. */
export function ventPeriodMs(tier: number): number {
  return Math.max(1500, Math.round(5200 - Math.max(1, tier) * 260))
}

/** How many polyps an eruption throws onto the shelf. */
export function eruptionYield(tier: number): number {
  return Math.min(9, 2 + Math.floor(tier / 2))
}

/** Essence paid for a correct assay. Integer. */
export function assayPayout(polypValue: number, ventTier: number, flow: number): number {
  return Math.max(1, Math.round(polypValue * (1 + ventTier * 0.85) * flow))
}

/** The flow multiplier after `n` consecutive correct assays. Caps, never punishes. */
export function flowAfter(correctRun: number): number {
  return Math.min(6, 1 + correctRun * 0.5)
}

/** Trickle from the living shelf itself — rewards holding a big reef. */
export function reefTrickle(reefMass: number): number {
  if (reefMass <= 0) return 0
  return Math.round(Math.sqrt(reefMass) * 10) / 10
}

/* ---------------------------------------------------------------- offline */

/** Eight hours. Past this the haul stops growing, so nobody feels obliged. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
/** Away time is worth a bit over half of played time. A gift, not a strategy. */
export const OFFLINE_EFFICIENCY = 0.55
/** Below this, no tide gate — coming back after ten seconds must not nag. */
export const OFFLINE_MIN_MS = 45 * 1000

export function offlineHaul(ratePerSec: number, elapsedMs: number): number {
  if (elapsedMs < OFFLINE_MIN_MS) return 0
  const ms = Math.min(elapsedMs, OFFLINE_CAP_MS)
  return Math.floor((ratePerSec * ms * OFFLINE_EFFICIENCY) / 1000)
}

/** A swell completes during play on this cadence; it is the in-session tide. */
export const SWELL_PERIOD_MS = 72 * 1000

/** Tide multiplier by how many tries the gate has taken. Never below 1. */
export function tideMultiplier(attempt: number): number {
  return Math.max(1, 3 - attempt)
}

/* ------------------------------------------------------------------ costs */

/** Cost to awaken vent number `n` (1-indexed; vent 1 is free). */
export function ventCost(n: number): number {
  if (n <= 1) return 0
  return 10 ** (n - 1) * 4
}

/** Cost to grow the shelf for the `n`-th time (1-indexed). */
export function growCost(n: number): number {
  return 10 ** (n + 1) * 3
}

/** Cost of an UPWELL — a paid burst of polyps when you want them now. */
export function upwellCost(bought: number): number {
  return Math.round(60 * 1.7 ** bought)
}

/**
 * DISSOLVE — the escape hatch when the shelf crowds — is **free**, and it pays
 * out the value it dissolves. It has to be: a child who cannot afford the way
 * out of a stuck board is a child who has been given a losing position by a
 * game that promised it had none. The real cost is the one that cannot be
 * bought around — you just spent the small polyps you needed to merge upward.
 */
export function purgeCost(): number {
  return 0
}

/* ------------------------------------------------------- progression bands */

/**
 * The base rung new polyps arrive on. It climbs with the essence magnitude, so
 * at minute one you merge 1s and 3s and at minute twenty you merge 128s and
 * 448s — the arithmetic gets harder because the *world* got bigger, which is
 * the only difficulty ramp that never reads as punishment.
 */
export function baseStepFor(magnitude: number): number {
  return Math.max(0, Math.min(9, Math.floor((magnitude - 1) / 2)))
}

/** Difficulty (1..10) to ask the host for, given the rung we want an answer on. */
export function difficultyForStep(step: number): number {
  const n = Math.round(Number(step))
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(10, n))
}

/** The rung a vent should target, given the current base rung and its tier. */
export function targetStepFor(baseStep: number, ventTier: number): number {
  return baseStep + 2 + Math.min(3, Math.floor(ventTier / 3))
}

/** Value a vent emits while asking for `answer`, so its chain is always walkable. */
export function emitValueFor(strain: Strain, targetStep: number): number {
  const seed = SEEDS[strain] ?? 1
  return seed * 2 ** Math.max(0, targetStep - 2)
}

/**
 * How bright the world is, 0..1, from the essence magnitude. Drives the whole
 * escalation: the abyss starts near black and ends as a blazing reef.
 */
export function bloomLevel(magnitude: number): number {
  return Math.max(0, Math.min(1, (magnitude - 1) / 7))
}
