/**
 * track — the runtime `Track` (the swap unit) + `TrackManager` (active Track,
 * list, create, switch). The keystone of the scale-out (LANGUAGE_PAIR_STATE §4).
 *
 * A `Track` bundles the per-Track runtime stores (inventory + quest engine, with
 * badges to follow) so they create/tear down as a UNIT. The `TrackManager` owns
 * the active Track, lists headlines from the denormalized registry (no heavy
 * loads), creates new Tracks, and runs the lossless save→load `switchTo` that the
 * orchestrator's `game.ts` rebind sequence drives (LANGUAGE_PAIR_STATE §4.3).
 *
 * DECOUPLING (the ownership boundary): this module does NOT import the inventory
 * or quest factory internals (other slices own parameterizing them with the
 * `{namespace, store}` binding). Instead the manager takes FACTORY CALLBACKS
 * (`TrackFactories`) the orchestrator supplies — each callback receives the
 * Track's `binding` and returns the bound store. So when Slice 1/quest parameterize
 * `createInventory({ binding })` / `createQuestEngine({ binding })`, the
 * orchestrator wires those factories here with ONE additive change, no churn in
 * this file.
 *
 * Only the ACTIVE Track is resident in memory; switching flushes + disposes the
 * old one and lazily loads the target's manifest + stores.
 */

import {
  trackId as mintTrackId,
  parseTrackId,
  TrackState,
  TrackId,
  type TrackHeadline,
  type GeneratedIdentity,
  type AvatarSpec,
} from "@world-plaza/contracts"
import type {
  Track,
  TrackManager,
  TrackStore,
  TrackStoreBinding,
  InventoryStore,
  QuestEngine,
} from "../contracts/runtime"
import { bindingFor } from "../storage/trackStore"
import {
  loadRegistry,
  saveRegistry,
  headlineFor,
  upsertHeadline,
  withActiveTrack,
} from "./registry"
import { manifestKey } from "./migrate"

const LOG = "[wp/track]"

/* ----------------------------------------------------------- factory inputs */

/**
 * What `createTrack`/onboarding hands the manager to stamp a fresh Track's
 * manifest. Mirrors `OnboardingResult` (`{ name, avatar }`) plus the curriculum
 * pointers the default Track needs.
 */
export interface CreateTrackInput {
  identity: GeneratedIdentity
  avatar: AvatarSpec
  /** the Scene this Track is skinned to at create (default: orchestrator's default). */
  activeSceneId?: string
  /** the Quest this Track loads at create (default: orchestrator's default). */
  activeQuestId?: string
  /** immersion default (forced "on" when native===target). */
  immersion?: "off" | "reveal" | "on"
}

/**
 * The orchestrator-supplied builders. The manager passes each its Track's
 * `binding` ({namespace, store}) + manifest so the per-Track store persists under
 * `wp:track:{id}:*`. `disposeInventory`/`disposeQuest` are optional teardown hooks
 * (unsubscribe). The quest builder receives the inventory it must read.
 */
export interface TrackFactories {
  buildInventory: (binding: TrackStoreBinding, state: TrackState) => InventoryStore
  buildQuestEngine: (
    binding: TrackStoreBinding,
    state: TrackState,
    inventory: InventoryStore,
    playerId: string,
  ) => QuestEngine
  /** optional: tear down a store's subscriptions/resources on Track dispose. */
  disposeInventory?: (inv: InventoryStore) => void
  disposeQuest?: (qe: QuestEngine) => void
  /** coarse xp glance for the registry headline (default: questEngine.state().xp). */
  xpOf?: (track: { inventory: InventoryStore; questEngine: QuestEngine }) => number
}

export interface TrackManagerOptions {
  store: TrackStore
  factories: TrackFactories
  /** the global, one-per-device player id (from registry.loadOrMintPlayerId()). */
  playerId: string
  /** host primary language (`languages[0]`) — the native of every Track. */
  hostNative: string
  /** the orchestrator's default scene/quest for a fresh Track manifest. */
  defaultSceneId?: string
  defaultQuestId?: string
}

/* ------------------------------------------------------------- Track object */

function buildTrack(
  state: TrackState,
  store: TrackStore,
  factories: TrackFactories,
  playerId: string,
): Track {
  const binding = bindingFor(state.id, store)
  const inventory = factories.buildInventory(binding, state)
  const questEngine = factories.buildQuestEngine(binding, state, inventory, playerId)

  const flush = async (): Promise<void> => {
    state.lastPlayedAt = Date.now()
    // Persist the small manifest (IndexedDB) ...
    await store.write(manifestKey(state.id), state)
    // ... and refresh the denormalized registry headline (localStorage).
    const xp = factories.xpOf
      ? factories.xpOf({ inventory, questEngine })
      : safeXp(questEngine)
    let reg = loadRegistry()
    reg = upsertHeadline(reg, headlineFor(state, xp))
    saveRegistry(reg)
  }

  const dispose = (): void => {
    try {
      factories.disposeQuest?.(questEngine)
    } catch (err) {
      console.error(`${LOG} disposeQuest threw:`, err)
    }
    try {
      factories.disposeInventory?.(inventory)
    } catch (err) {
      console.error(`${LOG} disposeInventory threw:`, err)
    }
  }

  return { id: state.id, state, inventory, questEngine, flush, dispose }
}

function safeXp(qe: QuestEngine): number {
  try {
    return Math.max(0, Math.floor(qe.state().xp))
  } catch {
    return 0
  }
}

/* --------------------------------------------------------------- the manager */

export function createTrackManager(opts: TrackManagerOptions): TrackManager {
  const { store, factories, playerId, hostNative } = opts
  let current: Track | null = null

  /** Load a Track's manifest from IndexedDB (or null if absent/corrupt). */
  async function loadManifest(id: TrackId): Promise<TrackState | null> {
    const raw = await store.read<unknown>(manifestKey(id))
    if (raw == null) return null
    const parsed = TrackState.safeParse(raw)
    if (!parsed.success) {
      console.warn(`${LOG} manifest "${id}" corrupt — treating as absent:`, parsed.error?.issues)
      return null
    }
    return parsed.data
  }

  /** Activate a Track from its (already-loaded) manifest. */
  function activate(state: TrackState): Track {
    const track = buildTrack(state, store, factories, playerId)
    current = track
    return track
  }

  /** Stamp + persist a fresh Track manifest for `(native, target)`. */
  async function create(native: string, target: string, input: CreateTrackInput): Promise<Track> {
    const id = mintTrackId(native, target)
    const now = Date.now()
    const immersion = native === target ? "on" : (input.immersion ?? "off")
    const state = TrackState.parse({
      id,
      native,
      target,
      identity: input.identity,
      avatar: input.avatar,
      activeSceneId: input.activeSceneId ?? opts.defaultSceneId,
      activeQuestId: input.activeQuestId ?? opts.defaultQuestId,
      immersion,
      levelIndex: 0,
      createdAt: now,
      lastPlayedAt: now,
      schemaV: 1,
    })
    await store.write(manifestKey(id), state)
    const track = activate(state)
    // Register + mark active so a relaunch resumes here.
    let reg = loadRegistry()
    reg = withActiveTrack(upsertHeadline(reg, headlineFor(state, 0)), id)
    saveRegistry(reg)
    return track
  }

  return {
    active(): Track {
      if (!current) {
        // A programming error — the orchestrator must activate/create before use.
        throw new Error(`${LOG} active() called before a Track was activated`)
      }
      return current
    },

    list(): TrackHeadline[] {
      // Picker/analytics surface — denormalized headlines only, no heavy loads.
      return loadRegistry().tracks
    },

    async switchTo(id: TrackId): Promise<Track> {
      // No-op if already active.
      if (current && current.id === id) return current
      // 1. flush + dispose the outgoing Track (persist its manifest + headline).
      if (current) {
        try {
          await current.flush()
        } catch (err) {
          console.error(`${LOG} flush of "${current.id}" failed (switching anyway):`, err)
        }
        current.dispose()
        current = null
      }
      // 2. load the target's manifest. A corrupt/absent manifest yields a
      //    fresh-but-flagged Track from its registry headline (resilient).
      let state = await loadManifest(id)
      if (!state) {
        console.warn(`${LOG} no/invalid manifest for "${id}" — reconstructing from headline`)
        state = reconstructFromHeadline(id, hostNative)
        await store.write(manifestKey(id), state)
      }
      // 3. activate + mark active for next-launch resume.
      const track = activate(state)
      saveRegistry(withActiveTrack(loadRegistry(), id))
      return track
    },

    createTrack(native: string, target: string, onboarding: unknown): Promise<Track> {
      const input = onboarding as CreateTrackInput
      return create(native, target, input)
    },

    async archive(id: TrackId): Promise<void> {
      // Power-user nicety (LANGUAGE_PAIR_STATE §2.4): compact the heavy bodies
      // under an :archived key and drop the live ones; KEEP the registry headline
      // so it can be one-tap restored. IndexedDB holds everything cheaply, so this
      // is optional — but we honor an explicit request losslessly.
      const ns = bindingFor(id, store).namespace
      const live = (await store.keys(`${ns}:`)).filter((k) => !k.endsWith(":archived"))
      const blob: Record<string, unknown> = {}
      for (const k of live) {
        const v = await store.read<unknown>(k)
        if (v != null) blob[k] = v
      }
      await store.write(`${ns}:archived`, blob)
      for (const k of live) await store.remove(k)
      console.info(`${LOG} archived Track "${id}" (${live.length} records compacted)`)
    },
  }

  /** Build a minimal valid manifest from a registry headline (corruption fallback). */
  function reconstructFromHeadline(id: TrackId, fallbackNative: string): TrackState {
    const head = loadRegistry().tracks.find((t) => t.id === id)
    const { native, target } = parseTrackId(id)
    const now = Date.now()
    if (head) {
      return TrackState.parse({
        id,
        native: head.native,
        target: head.target,
        identity: {
          playerId: "player-local",
          displayName: head.headline.displayName,
          nameSeed: { adjId: "x", nounId: "x" },
        },
        avatar: { base: "default", layers: [] },
        immersion: head.headline.immersion,
        levelIndex: head.headline.levelIndex,
        createdAt: head.createdAt,
        lastPlayedAt: now,
        schemaV: 1,
      })
    }
    return TrackState.parse({
      id,
      native: native || fallbackNative,
      target: target || native || fallbackNative,
      identity: {
        playerId: "player-local",
        displayName: "Traveler",
        nameSeed: { adjId: "x", nounId: "x" },
      },
      avatar: { base: "default", layers: [] },
      immersion: (native && native === target ? "on" : "off") as "off" | "reveal" | "on",
      levelIndex: 0,
      createdAt: now,
      lastPlayedAt: now,
      schemaV: 1,
    })
  }
}

/** Re-export the canonical id helper for the orchestrator's convenience. */
export { mintTrackId, TrackId }
