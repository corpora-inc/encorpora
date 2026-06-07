import { z } from "zod"
import { LanguageCode, PathId, QuestId, SceneId } from "./ids"
import { GeneratedIdentity, AvatarSpec } from "./identity"

/**
 * Track — the per-language-pair save envelope (the keystone of the scale-out).
 *
 * A learner's ENTIRE mode/state is one ordered language pair at a time — a
 * `Track = (native, target)`, e.g. "en:es". Per Track: their own
 * character/avatar, inventory (multi-currency `Wallet`), XP/badges,
 * quests/arc, level/path, and immersion setting. Rooms (Colyseus topology +
 * collision) are SHARED and Track-agnostic; Scene + Quest are the per-player
 * skins; the Track is the outer envelope that owns those per (native → target).
 *
 * Everything that today is a single global singleton (inventory(), the quest
 * engine, wp:identity:v1) becomes one-per-Track, namespaced by `TrackId`,
 * lazy-loaded for the active Track only. See `docs/LANGUAGE_PAIR_STATE.md`.
 *
 * This file owns the DATA shapes (manifest + registry). The injected runtime
 * store interface (`TrackStore`) and the runtime `Track`/`TrackManager` objects
 * live in `src/contracts/runtime.ts` (they carry functions, not serializable
 * data).
 */

/* ----------------------------------------------------------------- TrackId */

/**
 * `TrackId = ${native}:${target}` over BCP-47 corpus codes (the same
 * `LanguageCode` the contracts already use, e.g. "es", "pa-Arab", "sr-Latn").
 * Colon is a safe separator — it never appears in a corpus code. Ordered:
 * "en:es" (English speaker learning Spanish) ≠ "es:en". A single-language stack
 * (immersion / native practice) is `native === target`, e.g. "es:es" — a
 * well-formed TrackId, no special-casing of the id format needed.
 */
export const TrackId = z
  .string()
  .regex(/^[A-Za-z-]{2,}:[A-Za-z-]{2,}$/, "TrackId must be `${native}:${target}` BCP-47 codes")
  .brand("TrackId")
export type TrackId = z.infer<typeof TrackId>

/** Mint a `TrackId` from a (native, target) pair. Throws on a malformed code. */
export const trackId = (native: string, target: string): TrackId =>
  TrackId.parse(`${native}:${target}`)

/** Split a `TrackId` back into its components (no validation — pair with `TrackId.parse`). */
export const parseTrackId = (id: string): { native: string; target: string } => {
  const [native, target] = id.split(":")
  return { native, target }
}

/** A single-language / immersion Track has `native === target`. */
export const isImmersionTrack = (id: string): boolean => {
  const { native, target } = parseTrackId(id)
  return native === target
}

/**
 * The canonical IndexedDB key prefix for one Track's per-store records:
 * `wp:track:{id}` → e.g. `wp:track:en:es:economy`, `wp:track:en:es:quest`,
 * `wp:track:en:es:badges`. Every per-Track store namespaces under this. The
 * registry + tiny globals stay in localStorage; heavy per-Track bodies live in
 * IndexedDB (quota-safe). See `TrackStore` in `src/contracts/runtime.ts`.
 */
export const trackNamespace = (id: string): string => `wp:track:${id}`

/* --------------------------------------------------------------- TrackState */

/**
 * The per-Track manifest/envelope. SMALL on purpose (a few hundred bytes): the
 * economy/quest/badge BODIES are NOT inlined — they keep their own compact
 * records namespaced by `trackNamespace(id)` and stay independently lazy-loaded.
 * This is identity + avatar + which path/scene/quest/immersion + timestamps.
 */
export const TrackState = z.object({
  id: TrackId, // "en:es"
  native: LanguageCode, // redundant-but-explicit (cheap; avoids re-parsing the id)
  target: LanguageCode,

  // ---- identity / avatar (today: wp:identity:v1, ONE global) ----
  identity: GeneratedIdentity, // safe composed name (per-Track persona)
  avatar: AvatarSpec, // paper-doll layers (per-Track look)

  // ---- curriculum / path / level ----
  pathId: PathId.optional(), // which LearningPath this Track is walking
  levelIndex: z.number().int().nonnegative().default(0),
  activeSceneId: SceneId.optional(), // the Scene this Track is currently skinned to
  activeQuestId: QuestId.optional(), // the Quest currently loaded for this Track

  // ---- per-Track presentation ----
  // IMMERSION_TOGGLE owns this value's meaning. Three levels, not a boolean:
  // "off" = native help everywhere; "reveal" = target-first, native on demand;
  // "on" = total immersion. Forced "on" (control hidden) when native===target.
  // Optional + defaulted so legacy/migrated manifests parse.
  immersion: z.enum(["off", "reveal", "on"]).default("off"),

  // ---- lifecycle bookkeeping (for the picker + archival) ----
  createdAt: z.number(), // epoch ms
  lastPlayedAt: z.number(), // epoch ms — drives "recently played" + eviction
  schemaV: z.literal(1),
})
export type TrackState = z.infer<typeof TrackState>

/* ------------------------------------------------------------ TrackRegistry */

/**
 * The ONE genuinely-new global record (`wp:tracks:index:v1`, localStorage). The
 * registry is DENORMALIZED on purpose: the start-screen picker renders the full
 * Track list (name, level, xp glance) by reading ONLY this — it never loads any
 * Track's heavy economy/quest/badge stores. Headlines refresh cheaply on Track
 * deactivation. Also the privacy-clean analytics surface (ANALYTICS_PULSE reads
 * `(native, target)` counts only — never the displayName).
 */
export const TrackHeadline = z.object({
  id: TrackId,
  native: LanguageCode,
  target: LanguageCode,
  lastPlayedAt: z.number(),
  createdAt: z.number(),
  /** Denormalized glance so the picker paints WITHOUT loading the heavy stores. */
  headline: z.object({
    displayName: z.string(),
    levelIndex: z.number().int().nonnegative(),
    xp: z.number().nonnegative(), // coarse, for a progress glance
    immersion: z.enum(["off", "reveal", "on"]),
  }),
})
export type TrackHeadline = z.infer<typeof TrackHeadline>

export const TrackRegistry = z.object({
  activeTrackId: TrackId.optional(), // resume target on next launch
  tracks: z.array(TrackHeadline),
  schemaV: z.literal(1),
})
export type TrackRegistry = z.infer<typeof TrackRegistry>
