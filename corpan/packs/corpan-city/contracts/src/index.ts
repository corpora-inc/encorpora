/**
 * @corpan-city/contracts — the typed interface spine for Corpan City.
 *
 * Single source of truth for every boundary (client ↔ Colyseus ↔ Fastify API).
 * Exports both Zod schemas (runtime validation at boundaries) and inferred
 * TypeScript types (compile-time). Schema and type share a name, e.g. `Scene`
 * is both the Zod schema and the type.
 */

export * from "./ids"
export * from "./track"
export * from "./assets"
export * from "./room"
export * from "./scene"
export * from "./challengeTool"
export * from "./identity"
export * from "./economy"
export * from "./badges"
export * from "./challenge"
export * from "./quest"
export * from "./curriculum"
export * from "./presence"
export * from "./interaction"
export * from "./npc"
export * from "./chat"
export * from "./profile"
export * from "./mp"
export * from "./sync"

import { RoomTopology } from "./room"
import { Scene } from "./scene"
import { Quest } from "./quest"
import { TrackState, TrackRegistry } from "./track"
import { LearningPath } from "./curriculum"
import { MovementUpdate, PresenceSnapshot } from "./presence"
import { InteractionRequest, InteractionResponse } from "./interaction"
import { ChallengeSpec, ChallengeResult } from "./challenge"
import { MediatedChatInput, MediatedChatArtifact } from "./chat"
import { NpcIntent } from "./npc"
import { SyncEvent } from "./sync"
import { SafeProfile, ProfilePublish } from "./profile"
import {
  InviteMessage,
  InvitedMessage,
  InviteRespond,
  InviteResult,
  ProfileRequest,
  PeerChallengeResult,
  TradeEnvelope,
  TradeUpdateMessage,
} from "./mp"

/**
 * Convenience strict parsers for the most-crossed boundaries. Each throws a
 * ZodError on invalid input — use at trust boundaries (socket messages, loaded
 * pack JSON, API bodies). For non-throwing checks use the schema's `.safeParse`.
 */
export const parseTrackState = (v: unknown) => TrackState.parse(v)
export const parseTrackRegistry = (v: unknown) => TrackRegistry.parse(v)
export const parseRoomTopology = (v: unknown) => RoomTopology.parse(v)
export const parseScene = (v: unknown) => Scene.parse(v)
export const parseQuest = (v: unknown) => Quest.parse(v)
export const parseLearningPath = (v: unknown) => LearningPath.parse(v)
export const parseMovementUpdate = (v: unknown) => MovementUpdate.parse(v)
export const parsePresenceSnapshot = (v: unknown) => PresenceSnapshot.parse(v)
export const parseInteractionRequest = (v: unknown) => InteractionRequest.parse(v)
export const parseInteractionResponse = (v: unknown) => InteractionResponse.parse(v)
export const parseChallengeSpec = (v: unknown) => ChallengeSpec.parse(v)
export const parseChallengeResult = (v: unknown) => ChallengeResult.parse(v)
export const parseMediatedChatInput = (v: unknown) => MediatedChatInput.parse(v)
export const parseMediatedChatArtifact = (v: unknown) => MediatedChatArtifact.parse(v)
export const parseNpcIntent = (v: unknown) => NpcIntent.parse(v)
export const parseSyncEvent = (v: unknown) => SyncEvent.parse(v)
export const parseSafeProfile = (v: unknown) => SafeProfile.parse(v)
export const parseProfilePublish = (v: unknown) => ProfilePublish.parse(v)
export const parseProfileRequest = (v: unknown) => ProfileRequest.parse(v)
export const parseInviteMessage = (v: unknown) => InviteMessage.parse(v)
export const parseInvitedMessage = (v: unknown) => InvitedMessage.parse(v)
export const parseInviteRespond = (v: unknown) => InviteRespond.parse(v)
export const parseInviteResult = (v: unknown) => InviteResult.parse(v)
export const parsePeerChallengeResult = (v: unknown) => PeerChallengeResult.parse(v)
export const parseTradeEnvelope = (v: unknown) => TradeEnvelope.parse(v)
export const parseTradeUpdateMessage = (v: unknown) => TradeUpdateMessage.parse(v)

/**
 * Contract version. Bump on any breaking schema change; gates client/server.
 *
 * 0.1.0 — Scale-out contract set (ADDITIVE, backward-compatible):
 *   • track.ts: TrackId/TrackState/TrackRegistry + per-Track namespacing.
 *   • economy.ts: Wallet/Currency/Denomination/CurrencyArt/RewardTable/
 *     RewardGrant + EconomyTransaction.delta.currency (multi-currency).
 *   • badges.ts: BadgeId/Badge/BadgeDeposit/BadgeProgress/BadgeTier/family.
 *   • room.ts: Anchor.kind (typed AnchorKind) for topology/special-NPC/map.
 *   No existing field removed or narrowed; old runtimes ignore the new fields.
 *
 * 0.2.0 — Player-to-player INTERACTION layer (ADDITIVE):
 *   • profile.ts: SafeProfile/StackReveal/PlaceReveal/Continent + K_ANON +
 *     resolvePlaceReveal() — the k-anonymity place-disclosure model.
 *   • mp.ts: MP_MSG message names + Invite/Chat/Trade wire envelopes for the
 *     server-mediated interaction protocol. Presence/movement unchanged.
 */
export const CONTRACTS_VERSION = "0.2.0"
