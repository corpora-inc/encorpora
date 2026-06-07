/**
 * The Track foundation public surface (Slice 1 producer). The orchestrator wires
 * these in `game.ts`; per-Track surfaces (HUD, shop, tracker) read through the
 * active Track.
 */

export {
  createTrackManager,
  mintTrackId,
  TrackId,
  type CreateTrackInput,
  type TrackFactories,
  type TrackManagerOptions,
} from "./track"
export {
  migrateLegacyToTracks,
  manifestKey,
  economyKey,
  questKey,
  badgesKey,
  STORE_SUFFIX,
  type MigrationContext,
  type MigrationResult,
} from "./migrate"
export {
  loadRegistry,
  saveRegistry,
  hasRegistry,
  loadOrMintPlayerId,
  headlineFor,
  upsertHeadline,
  withActiveTrack,
  REGISTRY_KEY,
  PLAYER_ID_KEY,
} from "./registry"
export {
  createTrackStore,
  trackStore,
  bindingFor,
  __resetTrackStoreForTests,
} from "../storage/trackStore"
