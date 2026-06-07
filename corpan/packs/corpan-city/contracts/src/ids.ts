import { z } from "zod"

/**
 * Branded identifier schemas. Each is a non-empty string at runtime but carries
 * a distinct compile-time brand so a PlayerId can't be passed where a RoomId is
 * expected. Use the exported `*Id` helpers to mint values from raw strings.
 */
const brandedId = <B extends string>(brand: B) => z.string().min(1).brand(brand)

export const PlayerId = brandedId("PlayerId")
export type PlayerId = z.infer<typeof PlayerId>

export const SessionId = brandedId("SessionId")
export type SessionId = z.infer<typeof SessionId>

export const RoomId = brandedId("RoomId")
export type RoomId = z.infer<typeof RoomId>

export const WorldId = brandedId("WorldId")
export type WorldId = z.infer<typeof WorldId>

/** Content identifiers are plain (non-branded) ids — they cross the wire as keys. */
export const SceneId = z.string().min(1)
export type SceneId = z.infer<typeof SceneId>

export const QuestId = z.string().min(1)
export type QuestId = z.infer<typeof QuestId>

export const PathId = z.string().min(1)
export type PathId = z.infer<typeof PathId>

/** BCP-47 language code, matching the existing corpus codes (e.g. "es", "pa-Arab"). */
export const LanguageCode = z.string().min(2)
export type LanguageCode = z.infer<typeof LanguageCode>

/** A learner is always defined by the ordered pair (target they learn, native they know). */
export const LearnerPair = z.object({
  target: LanguageCode,
  native: LanguageCode,
})
export type LearnerPair = z.infer<typeof LearnerPair>
