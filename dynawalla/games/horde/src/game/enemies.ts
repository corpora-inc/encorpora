/**
 * The swarm. Nine archetypes, each separated on THREE axes at once — shape,
 * colour and motion — so a child reads the threat at a glance and a
 * colour-blind child reads it just as fast.
 */

export const BEHAVIOUR = {
  CHASE: 0,
  DART: 1,
  KEEP: 2,
  CHARGE: 3,
  ORBIT: 4,
  SPLIT: 5,
  WARDEN: 6,
} as const

export type EnemyDef = {
  key: string
  name: string
  hp: number
  speed: number
  radius: number
  /** Contact damage per second while overlapping the player. */
  dps: number
  xp: number
  shape: number
  col: [number, number, number]
  behaviour: number
  /** Minutes into the run before this can spawn. */
  from: number
  /** Relative spawn weight once unlocked. */
  weight: number
  /** Multiplier on the knockback it takes. */
  massInv: number
  spin: number
  elite?: boolean
}

import { SHAPE } from "../gfx/renderer.ts"

export const ENEMIES: EnemyDef[] = [
  {
    key: "drifter", name: "DRIFTER",
    hp: 10, speed: 46, radius: 15, dps: 9, xp: 1,
    shape: SHAPE.CHITIN, col: [0.16, 0.86, 0.98], behaviour: BEHAVIOUR.CHASE,
    from: 0, weight: 100, massInv: 1, spin: 0.4,
  },
  {
    key: "darter", name: "DARTER",
    hp: 7, speed: 104, radius: 11, dps: 7, xp: 1,
    shape: SHAPE.DART, col: [1.0, 0.24, 0.70], behaviour: BEHAVIOUR.DART,
    from: 0.7, weight: 72, massInv: 1.4, spin: 0,
  },
  {
    key: "husk", name: "HUSK",
    hp: 58, speed: 30, radius: 26, dps: 16, xp: 4,
    shape: SHAPE.CHITIN, col: [0.60, 0.34, 1.0], behaviour: BEHAVIOUR.CHASE,
    from: 2.0, weight: 34, massInv: 0.35, spin: 0.18,
  },
  {
    key: "spitter", name: "SPITTER",
    hp: 20, speed: 40, radius: 15, dps: 6, xp: 3,
    shape: SHAPE.RING, col: [0.55, 1.0, 0.34], behaviour: BEHAVIOUR.KEEP,
    from: 3.2, weight: 30, massInv: 1.1, spin: 1.1,
  },
  {
    key: "splitter", name: "SPLITTER",
    hp: 30, speed: 52, radius: 20, dps: 11, xp: 3,
    shape: SHAPE.SHARD, col: [0.86, 1.0, 0.28], behaviour: BEHAVIOUR.SPLIT,
    from: 4.6, weight: 30, massInv: 0.8, spin: 1.9,
  },
  {
    key: "sporeling", name: "SPORE",
    hp: 5, speed: 118, radius: 8, dps: 5, xp: 1,
    shape: SHAPE.DISC, col: [0.74, 1.0, 0.58], behaviour: BEHAVIOUR.CHASE,
    from: 99, weight: 0, massInv: 1.8, spin: 0,
  },
  {
    key: "lancer", name: "LANCER",
    hp: 42, speed: 66, radius: 17, dps: 22, xp: 5,
    shape: SHAPE.SHARD, col: [1.0, 0.42, 0.14], behaviour: BEHAVIOUR.CHARGE,
    from: 6.0, weight: 26, massInv: 0.6, spin: 0,
  },
  {
    key: "leech", name: "LEECH",
    hp: 26, speed: 88, radius: 13, dps: 9, xp: 2,
    shape: SHAPE.GEM, col: [0.30, 1.0, 0.86], behaviour: BEHAVIOUR.ORBIT,
    from: 7.5, weight: 26, massInv: 1.2, spin: 2.4,
  },
  {
    key: "warden", name: "WARDEN",
    hp: 620, speed: 38, radius: 46, dps: 30, xp: 60,
    shape: SHAPE.CHITIN, col: [1.0, 0.80, 0.30], behaviour: BEHAVIOUR.WARDEN,
    from: 99, weight: 0, massInv: 0.08, spin: 0.5, elite: true,
  },
]

export const E_INDEX: Record<string, number> = Object.fromEntries(ENEMIES.map((e, i) => [e.key, i]))

/**
 * The escalation curve. Health and speed climb, but health climbs much faster
 * than speed — a horde that outruns the player at minute 15 is unplayable,
 * a horde that takes four hits instead of one is *the power fantasy working*.
 */
export function hpScale(minutes: number): number {
  return 1 + minutes * 0.42 + minutes * minutes * 0.030
}

export function speedScale(minutes: number): number {
  return Math.min(1.55, 1 + minutes * 0.021)
}

/** Enemies alive the director aims for, at a given minute. */
export function targetPopulation(minutes: number, cap: number): number {
  const t = 26 + minutes * 30 + minutes * minutes * 2.4
  return Math.min(cap, Math.floor(t))
}
