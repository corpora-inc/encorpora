// Key art, decided. No pixels here — this is the *specification* of a drawing.
//
// There is no cover art in this repository and no artist is coming, so every
// game's artwork is generated. Two properties are non-negotiable and both are
// held by this module:
//
//   * **Deterministic.** The art is a pure function of the pack id. The same
//     game draws the same picture on every device, on every launch, forever —
//     a card whose artwork reshuffles is a card a child cannot recognise, and
//     recognition is the entire job of a thumbnail.
//   * **Different.** The founder's requirement is that each game look
//     genuinely different, so the art varies on two axes at once: the MOTIF
//     (what is drawn — a balance, a spiral, a snake) and the HUE (which of the
//     twelve lit colours of the arc it is drawn in).
//
// The motif is chosen from a table keyed by pack id, because the drawing has
// to be a picture of *that game*: FORGE is a smelting chain, THE SPLIT cuts a
// factor tree open, COUNTERPOISE is a balance beam. A procedural shape cannot
// know that. What a procedural shape CAN do is be characterful for a game this
// build has never heard of, and that is `sigil` — the fallback, which is a
// seeded rosette rather than a grey box, so game #28 looks like it belongs on
// the day it lands with no code change here at all.
//
// The hue is *not* in the table. It falls out of the id's hash, so a new pack
// is coloured the moment it exists.

import { MOTIF_KEYS, type MotifKey } from "./motifs.ts"

/** How many lit hues the arc offers. Mirrors `--dw-art-1`…`--dw-art-12`. */
export const ART_HUES = 12

/**
 * FNV-1a, 32-bit.
 *
 * Chosen over anything cleverer because it is four lines, has no dependency,
 * and — the property that matters — is *specified*: a hash that differs
 * between two JavaScript engines would give a phone and a tablet two different
 * pictures of the same game.
 */
export function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * mulberry32: a small, fast, well-distributed PRNG over a 32-bit seed.
 *
 * Every motif draws from one of these rather than from `Math.random`, which is
 * how "the same game draws the same picture" survives a re-render.
 */
export function rngFrom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Which game is drawn how.
 *
 * Keyed by pack id and by nothing else — not by skill, not by grade, not by
 * name. A game is a *thing*, and its picture is a picture of the thing.
 *
 * An id missing from this table is not an error and must never render as one:
 * it falls through to `sigil` below.
 */
const MOTIF_BY_PACK: Readonly<Record<string, MotifKey>> = {
  "dynawalla.arena": "orbs",
  "dynawalla.balance": "balance",
  "dynawalla.beam": "beams",
  "dynawalla.claim": "region",
  "dynawalla.coil": "coil",
  "dynawalla.colossus": "tower",
  "dynawalla.counterweight": "steelyard",
  "dynawalla.forge": "anvil",
  "dynawalla.gavel": "auction",
  "dynawalla.foundry": "ring",
  "dynawalla.guilty": "crosshair",
  "dynawalla.horde": "swarm",
  "dynawalla.lattice": "springgrid",
  "dynawalla.merge-idle": "reef",
  "dynawalla.fuse": "well",
  "dynawalla.mosaic": "tiles",
  "dynawalla.polarity": "polarity",
  "dynawalla.pulse": "bar",
  "dynawalla.rhythm": "lanes",
  "dynawalla.runner": "causeway",
  "dynawalla.serpent": "serpent",
  "dynawalla.siege": "wall",
  "dynawalla.skyledger": "astrolabe",
  "dynawalla.slice": "split",
  "dynawalla.stack": "slabs",
  "dynawalla.street": "street",
  "dynawalla.trebuchet": "trebuchet",
  "dynawalla.truedraw": "slate",
}

/** Every pack id this build draws a bespoke picture for. Test-facing. */
export const DRAWN_PACKS: readonly string[] = Object.keys(MOTIF_BY_PACK)

export interface ArtSpec {
  /** 1…12, addressing `--dw-art-N`. */
  readonly hue: number
  readonly motif: MotifKey
  readonly seed: number
}

/** The drawing for a pack id. Total: every string returns a real picture. */
export function artOf(packId: string): ArtSpec {
  const seed = hashOf(packId)
  const known = MOTIF_BY_PACK[packId]
  return {
    // Measured, not assumed. Across the twenty-seven packs this repository
    // ships, the hash's low bits put every one of the twelve hues in use with
    // at most four games sharing one — `>>> 3` first, which looked like the
    // more careful thing to do, collapsed it to ten hues with six on one.
    // `catalog.test.ts` holds the spread so a new pack cannot quietly ruin it.
    hue: (seed % ART_HUES) + 1,
    motif: known ?? "sigil",
    seed,
  }
}

/** The class that carries this card's hue. See `catalog.css`. */
export function hueClass(hue: number): string {
  const index = Number.isFinite(hue) ? Math.min(Math.max(Math.round(hue), 1), ART_HUES) : 1
  return `dw-art-h${index}`
}

/** Guards the table above against naming a motif nothing draws. */
export function isMotifKey(value: string): value is MotifKey {
  return (MOTIF_KEYS as readonly string[]).includes(value)
}
