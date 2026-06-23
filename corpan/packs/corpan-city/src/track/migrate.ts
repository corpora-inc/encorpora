/**
 * migrate — one-time, IDEMPOTENT fold of today's single global state into a
 * default Track (LANGUAGE_PAIR_STATE §6).
 *
 * Today there is exactly one global identity (`wp:identity:v1`), one global
 * economy (`wp:economy:v1`), one global quest (`wp:quest:v1`). This folds them
 * into ONE default Track with zero data loss, and old saves stay valid.
 *
 * IDEMPOTENT: keyed on "no registry yet" — runs at most once. Running it twice is
 * a no-op (the registry already exists).
 *
 * LOSSLESS: legacy economy/quest records are COPIED (not moved) into the Track
 * namespace verbatim — the inventory's `[id,qty][]` and quest's
 * `{questId,stepDone,xp,complete}` shapes are re-used under the new key. The old
 * keys are LEFT IN PLACE for one release as a rollback safety net; a later
 * release can GC them.
 *
 * The store-side compatibility (legacy `coins` → default currency, version
 * guards) is owned by the inventory/quest factories; this module only relocates
 * the bytes and stamps the manifest.
 */

import {
  trackId,
  trackNamespace,
  TrackState,
  type TrackId,
  type GeneratedIdentity,
  type AvatarSpec,
} from "@corpan-city/contracts"
import type { TrackStore } from "../contracts/runtime"
import { hasRegistry, loadOrMintPlayerId, saveRegistry, headlineFor } from "./registry"

const LOG = "[wp/track/migrate]"

/** Legacy global keys (today's single-state world). */
const LEGACY_IDENTITY = "wp:identity:v1"
const LEGACY_ECONOMY = "wp:economy:v1"
const LEGACY_QUEST = "wp:quest:v1"

/** The per-Track record suffixes (namespaced under `wp:track:{id}`). */
export const STORE_SUFFIX = {
  manifest: "manifest",
  economy: "economy",
  quest: "quest",
  badges: "badges",
} as const

export const manifestKey = (id: string): string => `${trackNamespace(id)}:${STORE_SUFFIX.manifest}`
export const economyKey = (id: string): string => `${trackNamespace(id)}:${STORE_SUFFIX.economy}`
export const questKey = (id: string): string => `${trackNamespace(id)}:${STORE_SUFFIX.quest}`
export const badgesKey = (id: string): string => `${trackNamespace(id)}:${STORE_SUFFIX.badges}`

/** Legacy identity shape (`{ name: GeneratedIdentity, avatar: AvatarSpec }`). */
interface LegacyIdentity {
  name: GeneratedIdentity
  avatar: AvatarSpec
}

/** Legacy quest record (compact `{ v,q,d,x,c }`) — read only for its questId + xp. */
interface LegacyQuest {
  q?: string // questId
  x?: number // xp
}

export interface MigrationContext {
  /** The per-Track store the migrated bodies are COPIED into (IndexedDB). */
  store: TrackStore
  /** Host primary language (`languages[0]`) — the native of every Track. */
  hostNative?: string
  /** The default quest's learnerPair (fallback for native/target). */
  questPair?: { native: string; target: string }
  /** The hard-coded default quest id + scene id to stamp into the manifest. */
  defaultQuestId?: string
  defaultSceneId?: string
  /**
   * Fallback identity/avatar when the legacy identity record is absent or
   * malformed (the schema requires both). The orchestrator passes
   * `defaultIdentity()` from onboarding so this module imports no UI internals.
   */
  fallbackIdentity: () => { name: GeneratedIdentity; avatar: AvatarSpec }
}

export interface MigrationResult {
  /** "migrated" = folded an existing single-state save; "fresh" = brand-new player;
   *  "skipped" = a registry already existed (idempotent no-op). */
  outcome: "migrated" | "fresh" | "skipped"
  /** The default Track id when an existing save was folded. */
  trackId?: TrackId
}

function readLs<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (err) {
    console.warn(`${LOG} could not read legacy "${key}":`, err)
    return null
  }
}

function legacyExists(): boolean {
  try {
    return (
      localStorage.getItem(LEGACY_IDENTITY) != null ||
      localStorage.getItem(LEGACY_ECONOMY) != null ||
      localStorage.getItem(LEGACY_QUEST) != null
    )
  } catch (err) {
    console.warn(`${LOG} could not probe legacy keys:`, err)
    return false
  }
}

/**
 * Run the one-time migration. Returns what it did. Safe to call on every boot:
 * after the first run a registry exists, so it short-circuits to "skipped".
 */
export async function migrateLegacyToTracks(ctx: MigrationContext): Promise<MigrationResult> {
  // IDEMPOTENT GUARD: a registry already exists → nothing to do.
  if (hasRegistry()) return { outcome: "skipped" }

  // Mint/keep the global, one-per-device player id (promotes "player-local").
  loadOrMintPlayerId()

  if (!legacyExists()) {
    // Brand-new player — no legacy state. Write the empty registry so this guard
    // is satisfied next boot; the picker's first-run path creates the first Track.
    saveRegistry({ tracks: [], schemaV: 1 })
    return { outcome: "fresh" }
  }

  // ---- An existing player: fold their single state into a default Track. ----
  const native =
    ctx.hostNative ?? ctx.questPair?.native ?? "en"
  const target = ctx.questPair?.target ?? native
  const id = trackId(native, target)

  // COPY (not move) the legacy bodies into the Track namespace, verbatim shape.
  // The store factories' own version guards read these unchanged.
  const legacyEconomy = readLs<unknown>(LEGACY_ECONOMY)
  if (legacyEconomy != null) await ctx.store.write(economyKey(id), legacyEconomy)

  const legacyQuestRaw = readLs<unknown>(LEGACY_QUEST)
  if (legacyQuestRaw != null) await ctx.store.write(questKey(id), legacyQuestRaw)

  // Stamp the manifest from the legacy identity (or a safe default).
  const now = Date.now()
  const legacyIdentity = readLs<LegacyIdentity>(LEGACY_IDENTITY)
  const legacyQuest = legacyQuestRaw as LegacyQuest | null
  // The schema requires identity + avatar; a missing/legacy-malformed record
  // falls back to a generated default (noisy) rather than crashing the boot.
  const fallback = ctx.fallbackIdentity()
  const identity = legacyIdentity?.name ?? fallback.name
  const avatar = legacyIdentity?.avatar ?? fallback.avatar
  if (!legacyIdentity) {
    console.warn(`${LOG} legacy identity absent/malformed — stamping a default persona`)
  }

  const manifest = TrackState.parse({
    id,
    native,
    target,
    identity,
    avatar,
    activeQuestId: legacyQuest?.q ?? ctx.defaultQuestId,
    activeSceneId: ctx.defaultSceneId,
    immersion: native === target ? "on" : "off",
    levelIndex: 0,
    createdAt: now,
    lastPlayedAt: now,
    schemaV: 1,
  })
  await ctx.store.write(manifestKey(id), manifest)

  // Write the registry with this Track active + its denormalized headline.
  const xp = Math.max(0, Math.floor(legacyQuest?.x ?? 0))
  saveRegistry({
    activeTrackId: id,
    tracks: [headlineFor(manifest, xp)],
    schemaV: 1,
  })

  console.info(`${LOG} folded legacy single-state into default Track "${id}" (xp=${xp})`)
  return { outcome: "migrated", trackId: id }
}
