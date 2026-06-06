import { z } from "zod"
import { PlayerId } from "./ids"
import { ChallengeSpec, ChallengeResult } from "./challenge"
import { ChallengeToolId } from "./challengeTool"
import { MediatedChatInput, MediatedChatArtifact } from "./chat"
import { SafeProfile, ProfilePublish } from "./profile"

/**
 * mp.ts — the player-to-player INTERACTION wire protocol over Colyseus.
 *
 * Presence + movement (presence.ts) is the always-on schema-synced layer. THIS
 * module is the typed `room.send(name, payload)` / `room.onMessage(name, …)`
 * surface for the *additive* interaction features: profile reveal, AI-mediated
 * chat, challenge invites, and trade. Every payload is a Zod schema validated at
 * BOTH ends — the server never trusts a client, and a client never renders an
 * unvalidated artifact. Nothing here is on the movement hot-path.
 *
 * All routing is server-mediated (no P2P sockets): a sender posts a typed
 * message; the server authorizes, (re)frames, and delivers a typed message to
 * the recipient. There is no channel for raw free text/audio between players —
 * the only expressive surfaces are menu choices and AI-mediated artifacts.
 *
 * MESSAGE NAMES (the string keys) are centralized in `MP_MSG` so client + server
 * can't drift. Client→server names are imperative ("invite"); server→client
 * names are past/notification ("invited").
 */

export const MP_MSG = {
  /** C→S: publish my safe profile (stack + raw country for the k-anon gate). */
  profilePublish: "profile-publish",
  /** C→S: ask for another player's k-anonymity-coarsened profile card. */
  profileRequest: "profile-request",
  /** S→C: a requested SafeProfile card (already coarsened for THIS viewer). */
  profileCard: "profile-card",

  /** C→S: invite another player to chat / challenge / trade. */
  invite: "invite",
  /** S→C: you've been invited (carries the typed offer). */
  invited: "invited",
  /** C→S: accept or decline an invite by id. */
  inviteRespond: "invite-respond",
  /** S→C: the outcome of an invite you sent (accepted/declined/expired). */
  inviteResult: "invite-result",

  /** C→S: a locally-cleaned MediatedChatInput to route to a partner. */
  chatSend: "chat-send",
  /** S→C: a MediatedChatArtifact framed for the recipient. */
  chatDeliver: "chat-deliver",

  /** C→S: my finished challenge result, to route to my peer-challenge partner. */
  peerResult: "peer-result",
  /** S→C: my partner's challenge result (for the shared duel/coop reconcile). */
  peerResultDeliver: "peer-result-deliver",

  /** C→S: a trade lifecycle event (propose/accept/decline/counter/cancel). */
  trade: "trade",
  /** S→C: a trade lifecycle update from the partner / server. */
  tradeUpdate: "trade-update",
} as const
export type MpMsgName = (typeof MP_MSG)[keyof typeof MP_MSG]

/* ----------------------------------------------------------------- profile */

export const ProfileRequest = z.object({ target: PlayerId })
export type ProfileRequest = z.infer<typeof ProfileRequest>

export { SafeProfile, ProfilePublish }

/* ----------------------------------------------------------------- invites */

/**
 * The kind of session an invite proposes. `chat` opens the AI-mediated chat;
 * `challenge` launches a shared minigame (coop or duel) via the existing
 * challenge system; `trade` opens the menus-only trade. The payload carries just
 * enough for the recipient to render a tasteful prompt before accepting.
 */
export const InviteOffer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("chat") }),
  z.object({
    kind: z.literal("challenge"),
    tool: ChallengeToolId,
    /** "coop" | "duel" — head-to-head or cooperative. */
    mode: z.enum(["coop", "duel"]),
    /** the authoritative spec both clients run (built by the inviter). */
    spec: ChallengeSpec,
  }),
  z.object({ kind: z.literal("trade") }),
])
export type InviteOffer = z.infer<typeof InviteOffer>

/** C→S: invite `to` into `offer`. The server stamps `from` from the session. */
export const InviteMessage = z.object({
  inviteId: z.string().min(1),
  to: PlayerId,
  offer: InviteOffer,
})
export type InviteMessage = z.infer<typeof InviteMessage>

/** S→C: delivered to the invitee, with the (trusted) sender id + their name. */
export const InvitedMessage = z.object({
  inviteId: z.string().min(1),
  from: PlayerId,
  fromName: z.string().min(1).max(40),
  offer: InviteOffer,
})
export type InvitedMessage = z.infer<typeof InvitedMessage>

export const InviteRespond = z.object({
  inviteId: z.string().min(1),
  action: z.enum(["accept", "decline"]),
})
export type InviteRespond = z.infer<typeof InviteRespond>

/** S→C: the inviter learns how it went. `sessionId` ties an accepted */
/** challenge/trade to a shared sync channel keyed by the invite. */
export const InviteResult = z.object({
  inviteId: z.string().min(1),
  outcome: z.enum(["accepted", "declined", "expired", "unavailable"]),
})
export type InviteResult = z.infer<typeof InviteResult>

/* -------------------------------------------------------------------- chat */

export { MediatedChatInput, MediatedChatArtifact }

/* ------------------------------------------------------------- challenge sync */

/**
 * A peer's challenge result shared back over the invite channel so both clients
 * can show "you / them" scores and reward both on completion. Wraps the contract
 * `ChallengeResult` with the routing `inviteId`.
 */
export const PeerChallengeResult = z.object({
  inviteId: z.string().min(1),
  result: ChallengeResult,
})
export type PeerChallengeResult = z.infer<typeof PeerChallengeResult>

/* ------------------------------------------------------------------- trade */

/**
 * The trade wire envelope. The economy agent owns the rich `TradeProposal`
 * (items/coins/notes/validation) in `src/economy/trade.ts`; THIS contract is the
 * minimal, serializable transport envelope the Colyseus transport carries. The
 * proposal body is passed as an opaque, size-bounded JSON object so the economy
 * layer can evolve its proposal shape without a contract bump — the transport
 * only routes + sequences it. The server still applies coarse anti-grief
 * (rate/▒size caps) on this envelope.
 */
export const TradeEnvelope = z.object({
  /** stable trade id (the economy proposal's id). */
  tradeId: z.string().min(1),
  to: PlayerId,
  /** propose | accept | decline | counter | cancel — mirrors economy statuses. */
  action: z.enum(["propose", "accept", "decline", "counter", "cancel"]),
  /** the economy proposal body, opaque to the transport (bounded JSON). */
  proposal: z.record(z.string(), z.unknown()),
})
export type TradeEnvelope = z.infer<typeof TradeEnvelope>

/** S→C: a trade envelope from the partner, with the trusted sender id stamped. */
export const TradeUpdateMessage = TradeEnvelope.extend({
  from: PlayerId,
})
export type TradeUpdateMessage = z.infer<typeof TradeUpdateMessage>
