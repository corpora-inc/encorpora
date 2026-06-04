/**
 * registry — the ONE genuinely-new GLOBAL record (`wp:tracks:index:v1`) plus the
 * global `wp:player:id`. These are TINY and read once at boot, so they live in
 * localStorage (not IndexedDB) per LANGUAGE_PAIR_STATE §2.1.
 *
 * The registry is DENORMALIZED on purpose: the start-screen picker renders the
 * full Track list (name, level, xp glance) by reading ONLY this record — it never
 * loads any Track's heavy economy/quest/badge stores. It is also the privacy-clean
 * analytics surface (ANALYTICS_PULSE reads `(native,target)` counts only, never
 * the displayName).
 *
 * Corruption-resilient (LANGUAGE_PAIR_STATE §2.4): a malformed registry yields an
 * empty-but-flagged registry rather than crashing the picker; the registry is the
 * source of truth for *existence*, bodies are reconstructible-to-empty.
 */

import {
  TrackRegistry,
  TrackHeadline,
  type TrackId,
  type TrackState,
} from "@world-plaza/contracts"

const LOG = "[wp/track/registry]"

export const REGISTRY_KEY = "wp:tracks:index:v1"
export const PLAYER_ID_KEY = "wp:player:id"

/** Read the registry, or a fresh empty one (corruption-resilient + noisy). */
export function loadRegistry(): TrackRegistry {
  const empty: TrackRegistry = { tracks: [], schemaV: 1 }
  let raw: string | null = null
  try {
    raw = localStorage.getItem(REGISTRY_KEY)
  } catch (err) {
    console.warn(`${LOG} could not read registry:`, err)
    return empty
  }
  if (!raw) return empty
  const parsed = TrackRegistry.safeParse(safeJson(raw))
  if (!parsed.success) {
    console.warn(`${LOG} registry corrupt — starting fresh:`, parsed.error?.issues ?? parsed.error)
    return empty
  }
  return parsed.data
}

/** Persist the registry (tiny; localStorage). Noisy on failure, never throws. */
export function saveRegistry(reg: TrackRegistry): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg))
  } catch (err) {
    console.error(`${LOG} could not persist registry (in-memory only this session):`, err)
  }
}

/** Does ANY registry record exist yet? (the migration's idempotency key). */
export function hasRegistry(): boolean {
  try {
    return localStorage.getItem(REGISTRY_KEY) != null
  } catch (err) {
    console.warn(`${LOG} could not probe registry:`, err)
    return false
  }
}

/**
 * The stable, one-per-DEVICE anonymous player id. Minted on first read and kept
 * forever (global, never per-Track). Multiplayer presence is one human who
 * happens to be on a given Track right now (LANGUAGE_PAIR_STATE §1.3).
 */
export function loadOrMintPlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY)
    if (existing) return existing
    const minted = mintPlayerId()
    localStorage.setItem(PLAYER_ID_KEY, minted)
    return minted
  } catch (err) {
    // localStorage blocked → a stable-enough session id (noisy). Presence still works.
    console.warn(`${LOG} could not read/mint persistent playerId — using session id:`, err)
    return mintPlayerId()
  }
}

function mintPlayerId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `pl-${rnd}`
}

/* ------------------------------------------------------ headline projection */

/**
 * Project a `TrackState` (+ a coarse xp glance) into the denormalized
 * `TrackHeadline` the picker paints from. xp is sourced by the caller (the Track
 * knows its quest xp); we never load the heavy store here.
 */
export function headlineFor(state: TrackState, xp: number): TrackHeadline {
  return TrackHeadline.parse({
    id: state.id,
    native: state.native,
    target: state.target,
    lastPlayedAt: state.lastPlayedAt,
    createdAt: state.createdAt,
    headline: {
      displayName: state.identity.displayName,
      levelIndex: state.levelIndex,
      xp: Math.max(0, Math.floor(xp)),
      immersion: state.immersion,
    },
  })
}

/** Upsert a headline into the registry (replace by id, keep order by lastPlayedAt desc). */
export function upsertHeadline(reg: TrackRegistry, headline: TrackHeadline): TrackRegistry {
  const others = reg.tracks.filter((t) => t.id !== headline.id)
  const tracks = [...others, headline].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
  return { ...reg, tracks }
}

/** Set the active track id on the registry (resume target on next launch). */
export function withActiveTrack(reg: TrackRegistry, id: TrackId): TrackRegistry {
  return { ...reg, activeTrackId: id }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (err) {
    console.warn(`${LOG} JSON parse failed:`, err)
    return null
  }
}
