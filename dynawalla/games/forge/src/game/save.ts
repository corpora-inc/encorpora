// Persistence. BigInts round-trip as decimal strings — exactly, at any size.
// The cost curve is NOT stored: it is recomputed from `purchased` with exact
// integer powers on load, so a save can never disagree with the live formula.

import { ipow } from "../core/bigmath.ts"
import { type Economy, TIERS, newEconomy, recomputeCost } from "../core/economy.ts"

// The `localStorage` slot, versioned so a schema change orphans old saves
// rather than mis-reading them. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `KEY = "<long dotted string>"` as a credential:
// the value clears its entropy floor where `dynawalla.fuse.best` next door does
// not, which is a property of the string's length, not of what it holds. It is
// a storage path, it is on the client, and it is in a public repo on purpose.
const SAVE_SLOT = "dynawalla.forge.save.v1" // gitleaks:allow

type SavedTier = {
  p: string
  s: string
  b: string
  u: boolean
  c: string
}

export type Persisted = {
  v: 1
  t: number
  sparks: string
  lifetime: string
  allTime: string
  heat: string
  carbon: string
  marks: string
  quenches: string
  carry: string
  tiers: SavedTier[]
  markOom: number
  audio: boolean
}

export function serialize(e: Economy, markOom: number, audio: boolean): Persisted {
  return {
    v: 1,
    t: Date.now(),
    sparks: e.sparks.toString(),
    lifetime: e.lifetime.toString(),
    allTime: e.allTime.toString(),
    heat: e.heat.toString(),
    carbon: e.carbon.toString(),
    marks: e.marks.toString(),
    quenches: e.quenches.toString(),
    carry: e.sparkCarry.toString(),
    tiers: e.tiers.map((t) => ({
      p: t.purchased.toString(),
      s: t.stock.toString(),
      b: t.bonusDoublings.toString(),
      u: t.unlocked,
      c: t.carry.toString(),
    })),
    markOom,
    audio,
  }
}

function big(s: unknown, fallback = 0n): bigint {
  if (typeof s !== "string" || !/^-?\d+$/.test(s)) return fallback
  try {
    const v = BigInt(s)
    return v < 0n ? fallback : v
  } catch {
    return fallback
  }
}

export function deserialize(p: Persisted): { e: Economy; markOom: number; audio: boolean } {
  const e = newEconomy()
  e.sparks = big(p.sparks)
  e.lifetime = big(p.lifetime)
  e.allTime = big(p.allTime)
  e.heat = big(p.heat)
  e.carbon = big(p.carbon)
  e.marks = big(p.marks)
  e.quenches = big(p.quenches)
  e.sparkCarry = big(p.carry)
  const saved = Array.isArray(p.tiers) ? p.tiers : []
  for (let i = 0; i < e.tiers.length; i++) {
    const s = saved[i]
    if (!s) continue
    const t = e.tiers[i]
    const def = TIERS[i]
    t.purchased = big(s.p)
    t.stock = big(s.s)
    t.bonusDoublings = big(s.b)
    t.unlocked = s.u === true || !def.sealed
    t.carry = big(s.c)
    const k = Number(t.purchased)
    t.powNum = ipow(def.growthNum, k)
    t.powDen = ipow(def.growthDen, k)
    recomputeCost(def, t)
  }
  return {
    e,
    markOom: typeof p.markOom === "number" ? p.markOom : 3,
    audio: p.audio !== false,
  }
}

/**
 * Where the save actually lives.
 *
 * Synchronous on purpose: `load()` is called from inside `mount`, before the
 * first frame, and `save()` is called from the game loop. Neither may await.
 *
 * `localStorage` is the default because the standalone workbench has one. A
 * pack frame does NOT — it is sandboxed without `allow-same-origin`, so its
 * origin is opaque and every storage API on it either throws or is absent.
 * That is exactly why the SDK has a `storage` capability, and why this is a
 * seam rather than a direct call: FORGE is an incremental game whose whole
 * subject is a number that goes up forever, and one that silently resets on
 * every launch is not the same game. `src/pack.ts` installs a host-backed slot
 * here, hydrated before mount so this stays synchronous.
 */
export type SaveSlot = {
  read(): string | null
  write(value: string): void
}

const browserSlot: SaveSlot = {
  read: () => localStorage.getItem(SAVE_SLOT),
  write: (value) => {
    localStorage.setItem(SAVE_SLOT, value)
  },
}

let slot: SaveSlot = browserSlot

/** Swap the backing store. Called once, before `mount`, or never. */
export function useSaveSlot(next: SaveSlot): void {
  slot = next
}

/** The key a host-backed slot should file this game's save under. */
export const SAVE_KEY = SAVE_SLOT

export function load(): { e: Economy; markOom: number; audio: boolean; elapsedMs: number } | null {
  try {
    const raw = slot.read()
    if (!raw) return null
    const p = JSON.parse(raw) as Persisted
    if (p.v !== 1) return null
    const { e, markOom, audio } = deserialize(p)
    const elapsedMs = Math.max(0, Date.now() - (typeof p.t === "number" ? p.t : Date.now()))
    return { e, markOom, audio, elapsedMs }
  } catch {
    return null
  }
}

export function save(e: Economy, markOom: number, audio: boolean): void {
  try {
    slot.write(JSON.stringify(serialize(e, markOom, audio)))
  } catch {
    /* private mode / quota: the game plays fine, it just will not resume */
  }
}

