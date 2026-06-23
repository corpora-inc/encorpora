import { Schema, MapSchema, type, view } from "@colyseus/schema"

/**
 * Authoritative Colyseus schema state. These classes MIRROR the wire shapes in
 * `@corpan-city/contracts` (`PresencePlayer` / `PresenceSnapshot`) but are the
 * binary-delta-encoded form Colyseus auto-syncs to every client. Keep them in
 * lock-step with the contract:
 *
 *   contract PresencePlayer { playerId, name, avatar, pos:{x,z,facing}, sceneId, questId }
 *     → PlayerState        { id(sessionId-routing) , playerId, name, avatar(JSON),
 *                            x, z, facing, sceneId, questId }
 *
 * `avatar` is carried as a JSON string (the AvatarSpec is a small structured blob
 * the client re-parses + re-skins into the LOCAL scene). Encoding it as a single
 * leaf field keeps the schema flat + the delta tiny; the avatar never changes
 * after join, so it costs nothing on the movement hot-path.
 */

export class PlayerState extends Schema {
  /** the player's durable PlayerId (branded string on the wire). */
  @type("string") playerId = ""
  /** safe composed display name. */
  @type("string") name = ""
  /** AvatarSpec serialized as JSON (parsed + re-skinned client-side). */
  @type("string") avatar = "{}"
  /** ground-plane position (authoritative). */
  @type("number") x = 0
  @type("number") z = 0
  /** facing yaw in radians. */
  @type("number") facing = 0
  /** which Scene this player sees — lets others place/skin them locally. */
  @type("string") sceneId = ""
  /** active quest (drives how others' clients frame an eventual chat). */
  @type("string") questId = ""
  /** server time (ms) of the last accepted move — clients interpolate from it. */
  @type("number") t = 0

  /* ── Safe profile (PUBLISHED, k-anonymity-safe). Additive; defaults keep an
   *    old client that never publishes a profile fully functional (it just shows
   *    no card). These are the ONLY identity-ish fields synced, and only the
   *    language stack is here — the COUNTRY is deliberately NOT in synced state
   *    (it would broadcast to everyone, defeating k-anonymity). Country lives in
   *    the room's private histogram and is only ever surfaced through the
   *    server-coarsened `profile-card` reply. ── */
  /** target language the player is learning (always safe to show). */
  @type("string") target = ""
  /** native language the player speaks (always safe to show). */
  @type("string") native = ""
}

export class PlazaState extends Schema {
  /** the room's topology id, so clients can assert they share a collision space.
   *  UNtagged → globally visible to every client (no AOI filtering). */
  @type("string") roomId = ""
  /**
   * All present players, keyed by Colyseus sessionId.
   *
   * `@view()` makes this field AREA-OF-INTEREST filtered: a client only receives
   * the PlayerState entries the room has explicitly added to that client's
   * `StateView` (its own cell + neighboring cells — see PlazaRoom + aoi.ts). A
   * far-away player is never encoded into your snapshot at all; as players cross
   * AOI boundaries the room adds/removes them from views, which the existing
   * client surfaces as clean schema `onAdd`/`onRemove` (avatar spawn/despawn).
   *
   * Back-compat: a client with NO StateView (an older runtime that never sets
   * one) still receives the WHOLE map — so this is a pure server-side scaling
   * win that does not require any client change.
   */
  @view() @type({ map: PlayerState }) players = new MapSchema<PlayerState>()
}
